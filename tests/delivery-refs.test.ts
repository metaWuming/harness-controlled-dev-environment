// tests/delivery-refs.test.ts — 交付 ref 共用契約(純函式,fake git runner + 一條真 git fixture)
//
// 每個原因碼各一條獨立 it:base.missing / base.shape / base.unresolvable / base.noncanonical /
// base.undeclared / config.invalid;正對照;以及「不讀 env」等價測試(單參數入口對 process.env.DELIVERY_REFS
// save / set / restore,兩次結果逐位元相同)。行為級的 env 忽略證明另由兩個 consumer 的 CLI e2e 承擔。

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  formatRejections,
  loadDeclaredDeliveryBranches,
  remoteBranchName,
  resolveDeliveryRefs,
  resolveDeliveryRefsFromRepo,
  validateRef,
  type GitRunner,
} from '../scripts/lib/delivery-refs';

const MAIN = 'refs/remotes/origin/main';

/**
 * fake git:描述 repo 狀態,回答 lib 會問的三種問題。
 * - head:origin/HEAD 目標(null = 未設)
 * - commits:哪些完整 ref 解得出 commit
 * - canon:`origin/<name>` 的正規解析結果(預設 = refs/remotes/origin/<name>;可覆寫成本地遮蔽)
 */
function fakeGit(state: { head: string | null; commits: string[]; canon?: Record<string, string> }): GitRunner {
  return (args) => {
    const [cmd] = args;
    if (cmd === 'symbolic-ref') return state.head;
    if (cmd === 'rev-parse' && args[1] === '--verify') {
      const ref = args[3]!.replace(/\^\{commit\}$/, '');
      return state.commits.includes(ref) ? 'deadbeef' : null;
    }
    if (cmd === 'rev-parse' && args[1] === '--symbolic-full-name') {
      const short = args[2]!;
      return state.canon?.[short] ?? `refs/remotes/origin/${short.slice('origin/'.length)}`;
    }
    throw new Error(`fake git 不認得(本契約不該問這個):${args.join(' ')}`);
  };
}

describe('remoteBranchName', () => {
  it('只接受 refs/remotes/origin/<字面分支名>', () => {
    expect(remoteBranchName(MAIN)).toBe('main');
    expect(remoteBranchName('refs/remotes/origin/release/1.0')).toBe('release/1.0');
    expect(remoteBranchName('refs/heads/main')).toBeNull();
    expect(remoteBranchName('refs/remotes/upstream/main')).toBeNull();
    expect(remoteBranchName('refs/remotes/origin/')).toBeNull();
    expect(remoteBranchName('refs/remotes/origin/-x')).toBeNull();
    expect(remoteBranchName('refs/remotes/origin/a..b')).toBeNull();
  });
});

describe('權威 base(origin/HEAD)受驗', () => {
  it('base.missing:origin/HEAD 未設 → 拒、refs 空', () => {
    const r = resolveDeliveryRefs(fakeGit({ head: null, commits: [MAIN] }), ['main']);
    expect(r.ok).toBe(false);
    expect(r.refs).toEqual([]);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.missing']);
  });
  it('base.shape:目標不是 refs/remotes/origin/<literal> → 拒', () => {
    const r = resolveDeliveryRefs(fakeGit({ head: 'refs/heads/main', commits: ['refs/heads/main'] }), ['main']);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.shape']);
    expect(r.refs).toEqual([]);
  });
  it('base.unresolvable:形狀正規、名稱已宣告、但解不出 commit → 拒、refs 空', () => {
    const r = resolveDeliveryRefs(fakeGit({ head: MAIN, commits: [] }), ['main']);
    expect(r.ok).toBe(false);
    expect(r.refs).toEqual([]);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.unresolvable']);
  });
  it('base.noncanonical:origin/main 正規解析到別的 ref(本地遮蔽)→ 拒;空字串也算', () => {
    const git = fakeGit({ head: MAIN, commits: [MAIN], canon: { 'origin/main': 'refs/heads/origin/main' } });
    const r = resolveDeliveryRefs(git, ['main']);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.noncanonical']);
    expect(r.refs).toEqual([]);
    const amb = resolveDeliveryRefs(fakeGit({ head: MAIN, commits: [MAIN], canon: { 'origin/main': '' } }), ['main']);
    expect(amb.rejections[0]!.code).toBe('base.noncanonical');
    expect(amb.rejections[0]!.detail).toContain('(無 / 歧義)');
  });
  it('base.undeclared:origin/HEAD 指向正規、可解、但未宣告的分支 → 拒、refs 空', () => {
    const git = fakeGit({ head: 'refs/remotes/origin/trunk', commits: ['refs/remotes/origin/trunk'] });
    const r = resolveDeliveryRefs(git, ['main']);
    expect(r.ok).toBe(false);
    expect(r.refs).toEqual([]);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.undeclared']);
  });
  it('正對照:origin/HEAD → 已宣告 main → refs = [base],恰一個元素', () => {
    const r = resolveDeliveryRefs(fakeGit({ head: MAIN, commits: [MAIN] }), ['main']);
    expect(r).toEqual({ ok: true, refs: [MAIN], rejections: [] });
  });
  it('validateRef 順序:形狀 → 存在 → 正規 → 宣告(第一個失敗即回)', () => {
    const git = fakeGit({ head: MAIN, commits: [] });
    expect(validateRef(git, 'refs/heads/x', ['main'])?.code).toBe('base.shape');
    expect(validateRef(git, MAIN, ['main'])?.code).toBe('base.unresolvable');
    expect(validateRef(fakeGit({ head: MAIN, commits: [MAIN] }), MAIN, ['trunk'])?.code).toBe('base.undeclared');
    expect(validateRef(fakeGit({ head: MAIN, commits: [MAIN] }), MAIN, ['main'])).toBeNull();
  });
});

describe('config / formatRejections / 不讀 env', () => {
  const made: string[] = [];
  afterAll(() => {
    for (const d of made) rmSync(d, { recursive: true, force: true });
  });
  const tmp = () => {
    const d = realpathSync(mkdtempSync(path.join(tmpdir(), 'dr-')));
    made.push(d);
    mkdirSync(path.join(d, 'scripts'));
    return d;
  };
  const CONFIG = JSON.stringify({
    schemaVersion: 2,
    mode: 'template',
    projectId: '__TEMPLATE__',
    templatePackageName: 'harness-controlled-dev-environment',
    protectedBranches: ['main'],
    deliveryBranches: ['main'],
    requiredAgentAdapters: ['claude'],
    githubGovernanceRequired: false,
    mergeStrategy: 'squash',
  });

  it('config.invalid:harness.config.json 缺 / 壞 → 拒,不猜', () => {
    const missing = loadDeclaredDeliveryBranches(tmp());
    expect('rejection' in missing && missing.rejection.code).toBe('config.invalid');
    const d = tmp();
    writeFileSync(path.join(d, 'scripts/harness.config.json'), '{bad');
    const bad = loadDeclaredDeliveryBranches(d);
    expect('rejection' in bad && bad.rejection.code).toBe('config.invalid');
    expect(resolveDeliveryRefsFromRepo(d).rejections.map((x) => x.code)).toEqual(['config.invalid']);
  });

  it('formatRejections 每條印原因碼與輸入,並明說不讀 env', () => {
    const text = formatRejections([{ code: 'base.undeclared', input: MAIN, detail: 'd' }]);
    expect(text).toContain(`[base.undeclared] ${MAIN}`);
    expect(text).toContain('不讀任何 env');
  });

  it('🔴 不讀 env:單參數入口對 process.env.DELIVERY_REFS 完全無感(真 git fixture;save / set / restore)', () => {
    // fixture:origin/HEAD=main;另有未合併的 origin/unmerged(含獨立 commit)。
    // 舊契約(#48)設 DELIVERY_REFS=origin/unmerged 會 exit 2(ref.nonancestor);更舊會把它算進來。
    // 本契約:結果與不設 env 逐位元相同,refs 只含 base。
    const wrap = tmp();
    const dir = path.join(wrap, 'repo');
    mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    writeFileSync(path.join(dir, 'scripts/harness.config.json'), CONFIG + '\n');
    const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 't');
    git('add', '-A');
    git('commit', '-qm', 'init');
    const origin = path.join(wrap, 'origin.git');
    execFileSync('git', ['init', '--bare', '-q', origin], { stdio: 'ignore' });
    git('remote', 'add', 'origin', origin);
    git('push', '-q', 'origin', 'main:refs/heads/main');
    git('checkout', '-q', '-b', 'unmerged');
    git('commit', '--allow-empty', '-qm', 'feat (#77)');
    git('push', '-q', 'origin', 'unmerged:refs/heads/unmerged');
    git('checkout', '-q', 'main');
    git('fetch', '-q', 'origin');
    git('remote', 'set-head', 'origin', 'main');

    const saved = process.env.DELIVERY_REFS;
    delete process.env.DELIVERY_REFS;
    let without: string;
    let withEnv: string;
    try {
      without = JSON.stringify(resolveDeliveryRefsFromRepo(dir));
      process.env.DELIVERY_REFS = 'origin/unmerged';
      withEnv = JSON.stringify(resolveDeliveryRefsFromRepo(dir));
    } finally {
      if (saved === undefined) delete process.env.DELIVERY_REFS;
      else process.env.DELIVERY_REFS = saved;
    }
    expect(withEnv).toBe(without);
    expect(JSON.parse(without)).toEqual({ ok: true, refs: [MAIN], rejections: [] });
  });
});
