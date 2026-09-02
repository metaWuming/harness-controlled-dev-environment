// tests/check-baseline-governance.e2e.test.ts — PR A3 baseline 治理旁路機器守門(真 git fixture、subprocess)
//
// plan §2.4 的 16 條 e2e + Step 5 r1 補的 (17)–(20),各一個 it。fixture 形狀:
//   A(initial,config baseline = "")→ B(main,config baseline = A)→ feature 分支從 B 開 PR commit。
//   merge-base(main, feature) = B。

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { evaluateBaselineGovernance, isAllowedBaselineChangePath, stripTemplatePrefix } from '../scripts/check-baseline-governance';

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
    // env 不得影響 base 的解析:給一個解不開的 --base、同時 env 指向合法 main → 仍必須 2(BG-M5 探針)
    const r2 = run([`--root=${f.dir}`, '--base=origin/nope'], { DELIVERY_REFS: 'main', BASELINE_BASE: 'main' });
    expect(r2.code).toBe(2);
    expect(r2.out).toContain('[base.unresolvable]');
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
  it('(17) C1:舊值 template: 前綴在本 history 解不開(下游新歷史)+ 新值 = merge-base、只動 config → exit 0(視為首次設定)', () => {
    const f = fixture();
    f.git('checkout', '-q', 'main');
    f.write(CONFIG, cfg('template:' + 'f'.repeat(40)));
    const M = f.commit('M: template legacy value');
    f.git('checkout', '-q', '-b', 'feature3');
    f.write(CONFIG, cfg(M));
    f.commit('C: first real baseline');
    const r = run([`--root=${f.dir}`, '--base=main']);
    expect(r.code, ok(r)).toBe(0);
    expect(r.out).toContain('template 遺產');
  });
  it('(18) 非 template 前綴的舊值解不開 → exit 2 old-unresolvable(不放行)', () => {
    const f = fixture();
    f.git('checkout', '-q', 'main');
    f.write(CONFIG, cfg('f'.repeat(40)));
    const M = f.commit('M: bogus old');
    f.git('checkout', '-q', '-b', 'feature3');
    f.write(CONFIG, cfg(M));
    f.commit('C');
    const r = run([`--root=${f.dir}`, '--base=main']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[value.old-unresolvable]');
  });
  const HC = JSON.stringify({ schemaVersion: 2, mode: 'template', projectId: '__TEMPLATE__', templatePackageName: 'x', protectedBranches: ['develop', 'main'], deliveryBranches: ['main'], requiredAgentAdapters: ['claude'], githubGovernanceRequired: false, mergeStrategy: 'squash' });
  it('(19) C3:--head ∈ merge-base 的 protectedBranches(promotion PR)→ SKIPPED exit 0;--head=feature 不跳過;任意名不假紅;mb 無 config → 不豁免', () => {
    const f = fixture();
    f.git('checkout', '-q', 'main');
    f.write('scripts/harness.config.json', HC); // 政策在 merge-base(main)那側
    f.commit('cfg on main');
    f.git('checkout', '-q', '-b', 'feature2');
    f.write(CONFIG, cfg(f.git('rev-parse', 'main')));
    f.write('scripts/x.ts', 'export {}\n'); // 若不跳過會 path.disallowed
    f.commit('C');
    let r = run([`--root=${f.dir}`, '--base=main', '--head=develop']);
    expect(r.code, ok(r)).toBe(0);
    expect(r.out).toMatch(/^BASELINE_GOVERNANCE_SKIPPED/);
    r = run([`--root=${f.dir}`, '--base=main', '--head=feature']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[path.disallowed:scripts/x.ts]');
    // C-2:任意 git 合法分支名(含 # @ + = 非 ASCII)不得假紅——不相等就不豁免、照常判定
    for (const h of ['fix/#123', 'user@feat', 'feat+x', 'release=1', '_wip', '中文分支', 'chore(deps)/x']) {
      r = run([`--root=${f.dir}`, '--base=main', `--head=${h}`]);
      expect(r.code, h).toBe(2);
      expect(r.out, h).toContain('[path.disallowed:scripts/x.ts]');
      expect(r.out, h).not.toContain('head.shape');
    }
    expect(run([`--root=${f.dir}`, '--base=main', '--head=']).code).toBe(2);
    expect(run([`--root=${f.dir}`, '--base=main', '--head=a', '--head=b']).code).toBe(2);
    const g = fixture(); // merge-base 無 harness.config → 不豁免、照常判定
    g.write(CONFIG, cfg(g.B));
    g.write('scripts/x.ts', 'export {}\n');
    g.commit('C');
    r = run([`--root=${g.dir}`, '--base=main', '--head=develop']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[path.disallowed:scripts/x.ts]');
    expect(r.out).toContain('不套用 promotion 豁免');
  });
  it('(21) r3 CRITICAL:攻擊 PR 自己把分支名加進 protectedBranches → 不得 SKIPPED(政策讀 merge-base)', () => {
    const f = fixture();
    f.git('checkout', '-q', 'main');
    f.write('scripts/harness.config.json', HC);
    f.commit('cfg on main');
    f.git('checkout', '-q', '-b', 'feature2');
    f.write('README.md', 'c1\n');
    const C1 = f.commit('C1');
    f.write(CONFIG, cfg(C1)); // 推到 PR 內 commit
    f.write('scripts/x.ts', 'forbidden\n');
    f.write('scripts/harness.config.json', HC.replace('"protectedBranches":["develop","main"]', '"protectedBranches":["develop","main","feature2"]'));
    f.commit('C2: launder + self-exempt');
    const r = run([`--root=${f.dir}`, '--base=main', '--head=feature2']);
    expect(r.code).toBe(2);
    expect(r.out).not.toContain('SKIPPED');
    expect(r.out).toContain('[path.disallowed:scripts/x.ts]');
  });
  it('(22) I-4:兩端 ls-tree 都失敗(git 錯誤)→ UNDETERMINED,不得 UNCHANGED(純函式注入)', () => {
    const io = {
      git: (args: string[]) => {
        const k = args.join(' ');
        if (k.startsWith('rev-parse --verify --quiet main')) return 'a'.repeat(40);
        if (k.startsWith('rev-parse --verify --quiet HEAD')) return 'b'.repeat(40);
        if (k.startsWith('merge-base ')) return 'a'.repeat(40);
        if (k.startsWith('ls-tree ')) return null; // git 失敗
        return null;
      },
    };
    const r = evaluateBaselineGovernance('main', io);
    expect(r.status).toBe('UNDETERMINED');
    expect(r.findings[0]!.code).toBe('config.head.invalid');
  });
  it('(20) C3:GitFlow 三步 —— bump→develop 合法;release develop→main 以 --head=develop 跳過', () => {
    const f = fixture();
    f.git('checkout', '-q', 'main');
    f.write('scripts/harness.config.json', HC);
    f.commit('cfg');
    f.git('checkout', '-q', '-b', 'develop');
    f.write('feat.txt', 'feature\n');
    const D1 = f.commit('develop feature');
    f.git('checkout', '-q', '-b', 'bump');
    f.write(CONFIG, cfg(D1));
    f.commit('bump baseline to develop tip');
    let r = run([`--root=${f.dir}`, '--base=develop', '--head=bump']);
    expect(r.code, ok(r)).toBe(0);
    f.git('checkout', '-q', 'develop');
    f.git('merge', '-q', '--no-ff', 'bump', '-m', 'merge bump');
    r = run([`--root=${f.dir}`, '--base=main', '--head=develop']);
    expect(r.code, ok(r)).toBe(0);
    expect(r.out).toMatch(/^BASELINE_GOVERNANCE_SKIPPED/);
    r = run([`--root=${f.dir}`, '--base=main']); // fork 形狀(無 --head)→ 不跳過 → 紅(刻意)
    expect(r.code).toBe(2);
  });
  it('E-self(template mode):以 config 首次加入的 commit 為 base → UNCHANGED;單 commit / 非 template / 找不到就跳過', () => {
    // Step 5 r1 C2:不硬編任何 SHA(下游新歷史沒有模板的 commit)。config 首次加入的 commit 在任何 history 都存在;
    // 若它就是 HEAD(全新 template repo 只有 1 commit)或 mode 不是 template,刻意跳過而不假裝驗過。
    const mode = JSON.parse(readFileSync(path.join(REPO, 'scripts/harness.config.json'), 'utf-8')).mode;
    const firstAdd = execFileSync('git', ['-C', REPO, 'log', '--diff-filter=A', '--format=%H', '--', CONFIG], { encoding: 'utf-8' }).trim().split('\n').filter(Boolean).pop() ?? '';
    const head = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
    if (mode !== 'template' || firstAdd === '' || firstAdd === head) return;
    // I-5:本 repo 日後合法推進 baseline 後,首次加入 commit 的值就不等於現值,這條自證會在正確行為下轉紅;
    // 值不同時刻意跳過(那是 Baseline Governance Check 對推進 PR 本身該驗的事,不是自證的職責)。
    const atBase = execFileSync('git', ['-C', REPO, 'show', `${firstAdd}:${CONFIG}`], { encoding: 'utf-8' });
    const now = readFileSync(path.join(REPO, CONFIG), 'utf-8');
    if (JSON.parse(atBase).sourceTermHistoryBaseline !== JSON.parse(now).sourceTermHistoryBaseline) return;
    const r = run([`--base=${firstAdd}`]);
    expect(r.code, ok(r)).toBe(0);
    expect(r.out).toMatch(/^BASELINE_UNCHANGED/);
  });
});
