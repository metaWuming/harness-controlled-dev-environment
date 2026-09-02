// tests/check-baseline-governance.e2e.test.ts — PR A3 baseline 治理旁路機器守門(真 git fixture、subprocess)
//
// plan §2.4 的 16 條 e2e,各一個 it。fixture 形狀:
//   A(initial,config baseline = "")→ B(main,config baseline = A)→ feature 分支從 B 開 PR commit。
//   merge-base(main, feature) = B。

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { isAllowedBaselineChangePath, stripTemplatePrefix } from '../scripts/check-baseline-governance';

const REPO = path.resolve(__dirname, '..');
const TSX = path.join(REPO, 'node_modules/.bin/tsx');
const SCRIPT = path.join(REPO, 'scripts/check-baseline-governance.ts');
const CONFIG = 'scripts/source-term-baseline.json';
const ADR = 'docs/architecture/' + 'source-term-history-baseline.md';

function run(args: string[], env: Record<string, string> = {}): { code: number | null; out: string; err: string } {
  const r = spawnSync(TSX, [SCRIPT, ...args], { cwd: REPO, encoding: 'utf-8', env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const cfg = (v: string) => JSON.stringify({ schemaVersion: 1, sourceTermHistoryBaseline: v });

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

interface Fx {
  dir: string;
  A: string;
  B: string;
  git: (...a: string[]) => string;
  write: (rel: string, text: string) => void;
  commit: (msg: string) => string;
}
function fixture(): Fx {
  const dir = mkdtempSync(path.join(tmpdir(), 'a3-bg-'));
  made.push(dir);
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (rel: string, text: string) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  };
  const commit = (msg: string) => {
    git('add', '-A');
    git('commit', '-q', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'e2e@example.test');
  git('config', 'user.name', 'e2e');
  write(CONFIG, cfg(''));
  write(ADR, '# ADR\n\n## Provenance\n');
  write('README.md', 'readme\n');
  const A = commit('A');
  write(CONFIG, cfg(A));
  const B = commit('B: set baseline = A');
  git('checkout', '-q', '-b', 'feature');
  return { dir, A, B, git, write, commit };
}
const ok = (r: { code: number | null; out: string; err: string }) => `${r.code}\n${r.out}\n${r.err}`;

describe('純函式', () => {
  it('stripTemplatePrefix / isAllowedBaselineChangePath(allowlist 由 check-bookkeeping-commit 匯入)', () => {
    expect(stripTemplatePrefix('template:abc')).toBe('abc');
    expect(stripTemplatePrefix('abc')).toBe('abc');
    for (const p of [CONFIG, ADR, 'TODOS.md', '.claude/memory/progress.md', '.claude/memory/progress-archive/progress-2026-09.md']) {
      expect(isAllowedBaselineChangePath(p), p).toBe(true);
    }
    for (const p of ['.claude/memory/LESSONS.md', 'scripts/x.ts', 'CLAUDE.md', '.claude/memory/progress-archive/README.md']) {
      expect(isAllowedBaselineChangePath(p), p).toBe(false);
    }
  });
});

describe('check:baseline-governance e2e(16 條)', () => {
  it('(1) unchanged:PR 只動 README → exit 0 BASELINE_UNCHANGED', () => {
    const f = fixture();
    f.write('README.md', 'changed\n');
    f.commit('C');
    const r = run([`--root=${f.dir}`, '--base=main']);
    expect(r.code, ok(r)).toBe(0);
    expect(r.out).toMatch(/^BASELINE_UNCHANGED/);
  });
  it('(2) 合法推進:baseline A → B(= merge-base),只動 config + ADR + progress + TODOS → exit 0', () => {
    const f = fixture();
    f.write(CONFIG, cfg(f.B));
    f.write(ADR, '# ADR\n\n## Provenance\n\nbaseline 推進\n');
    f.write('.claude/memory/progress.md', 'entry\n');
    f.write('TODOS.md', 'todo\n');
    f.commit('C: advance baseline');
    const r = run([`--root=${f.dir}`, '--base=main']);
    expect(r.code, ok(r)).toBe(0);
    expect(r.out).toMatch(/^BASELINE_GOVERNANCE_OK/);
  });
  it('(3) 同 PR 改 baseline + 加碼 scripts/x.ts → exit 2 path.disallowed', () => {
    const f = fixture();
    f.write(CONFIG, cfg(f.B));
    f.write('scripts/x.ts', 'export {}\n');
    f.commit('C');
    const r = run([`--root=${f.dir}`, '--base=main']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[path.disallowed:scripts/x.ts]');
  });
  it('(4) 加 LESSONS.md(治理內容,不在 bookkeeping allowlist)→ exit 2', () => {
    const f = fixture();
    f.write(CONFIG, cfg(f.B));
    f.write('.claude/memory/LESSONS.md', 'lesson\n');
    f.commit('C');
    const r = run([`--root=${f.dir}`, '--base=main']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[path.disallowed:.claude/memory/LESSONS.md]');
  });
  it('(5) 新值 = merge-base 本身(邊界)→ exit 0;新值帶 template: 前綴亦同', () => {
    const f = fixture();
    f.write(CONFIG, cfg(`template:${f.B}`));
    f.commit('C');
    const r = run([`--root=${f.dir}`, '--base=main']);
    expect(r.code, ok(r)).toBe(0);
  });
  it('(6) 新值 = PR 內 commit(洗白形狀)→ exit 2 not-ancestor-of-merge-base', () => {
    const f = fixture();
    f.write('README.md', 'c1\n');
    const C1 = f.commit('C1');
    f.write(CONFIG, cfg(C1));
    f.commit('C2: baseline -> C1');
    const r = run([`--root=${f.dir}`, '--base=main']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[value.not-ancestor-of-merge-base]');
  });
  it('(7) 新值倒退(舊值 A 的祖先 = 用一個更早的 commit)→ exit 2 not-forward', () => {
    // main 再推一個 B2(baseline = B),feature2 把它倒退成 A(B 的祖先)
    const g = fixture();
    g.git('checkout', '-q', 'main');
    g.write(CONFIG, cfg(g.B));
    const B2 = g.commit('B2: baseline = B');
    g.git('checkout', '-q', '-b', 'feature2');
    g.write(CONFIG, cfg(g.A));
    g.commit('C: baseline back to A');
    expect(B2).not.toBe(g.A);
    const r = run([`--root=${g.dir}`, '--base=main']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[value.not-forward]');
  });
  it('(8) 新值不在 history → exit 2 value.unresolvable;非 40-hex → value.shape', () => {
    const f = fixture();
    f.write(CONFIG, cfg('0'.repeat(39) + '1'));
    f.commit('C');
    let r = run([`--root=${f.dir}`, '--base=main']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[value.unresolvable]');
    const g = fixture();
    g.write(CONFIG, cfg('not-a-sha'));
    g.commit('C');
    r = run([`--root=${g.dir}`, '--base=main']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[value.shape]');
  });
  it('(9) 缺 --base → exit 2;env 有值也不讀', () => {
    const f = fixture();
    f.write('README.md', 'c\n');
    f.commit('C');
    const r = run([`--root=${f.dir}`], { BASELINE_BASE: 'main', DELIVERY_REFS: 'main' });
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/--base=<ref> 必填/);
  });
  it('(10) 重複 --base → exit 2', () => {
    const f = fixture();
    expect(run([`--root=${f.dir}`, '--base=main', '--base=main']).code).toBe(2);
  });
  it('(11) 空 --base= → exit 2', () => {
    const f = fixture();
    expect(run([`--root=${f.dir}`, '--base=']).code).toBe(2);
  });
  it('(12) 形狀非法 --base=main;x → exit 2 base.shape', () => {
    const f = fixture();
    const r = run([`--root=${f.dir}`, '--base=main;x']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[base.shape]');
  });
  it('(13) 形狀非法 --base=--foo → exit 2;未知參數 → exit 2', () => {
    const f = fixture();
    expect(run([`--root=${f.dir}`, '--base=--foo']).code).toBe(2);
    expect(run([`--root=${f.dir}`, '--base=main', '--bsae=x']).code).toBe(2);
  });
  it('(14) 解不開的 ref(origin/<default> 未 fetch 的情境)→ exit 2 base.unresolvable', () => {
    const f = fixture();
    const r = run([`--root=${f.dir}`, '--base=origin/main']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[base.unresolvable]');
  });
  it('(15) merge-base == HEAD(base 就是 HEAD)→ exit 2', () => {
    const f = fixture();
    const r = run([`--root=${f.dir}`, '--base=HEAD']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[merge-base.equals-head]');
  });
  it('(16) shallow clone 無 merge-base → exit 2', () => {
    const f = fixture();
    f.write('README.md', 'c\n');
    f.commit('C');
    const shallow = mkdtempSync(path.join(tmpdir(), 'a3-bg-shallow-'));
    made.push(shallow);
    execFileSync('git', ['clone', '-q', '--depth', '1', '--branch', 'feature', `file://${f.dir}`, shallow]);
    execFileSync('git', ['-C', shallow, 'fetch', '-q', '--depth', '1', 'origin', 'main:refs/remotes/origin/main']);
    const r = run([`--root=${shallow}`, '--base=origin/main']);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/merge-base\.unavailable|merge-base\.equals-head|base\.unresolvable/);
  });
  it('E-self:本 repo 對 frozen base 未動 baseline → exit 0 UNCHANGED', () => {
    const r = run(['--base=5832d9ed7b57c471dcb1a298ddf9245100529bb4']);
    expect(r.code, ok(r)).toBe(0);
    expect(r.out).toMatch(/^BASELINE_UNCHANGED/);
  });
});
