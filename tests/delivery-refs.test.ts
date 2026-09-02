// tests/delivery-refs.test.ts — 交付 ref 共用契約(純函式,fake git runner)
//
// 每個原因碼各一條獨立 it(supervisor plan rev 4):base.missing / base.shape / base.unresolvable /
// base.noncanonical / base.undeclared / ref.syntax / ref.shape / ref.unresolvable / ref.noncanonical /
// ref.nonancestor / ref.undeclared / config.invalid;正對照;多候選原因碼全列不短路。

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
 * fake git:描述 repo 狀態,回答 lib 會問的四種問題。
 * - head:origin/HEAD 目標(null = 未設)
 * - commits:哪些完整 ref 解得出 commit
 * - canon:`origin/<name>` 的正規解析結果(預設 = refs/remotes/origin/<name>;可覆寫成本地遮蔽)
 * - ancestors:哪些 ref 是 base 的祖先
 */
function fakeGit(state: {
  head: string | null;
  commits: string[];
  canon?: Record<string, string>;
  ancestors?: string[];
}): GitRunner {
  return (args) => {
    const [cmd] = args;
    if (cmd === 'symbolic-ref') return state.head;
    if (cmd === 'rev-parse' && args[1] === '--verify') {
      const ref = args[3]!.replace(/\^\{commit\}$/, '');
      return state.commits.includes(ref) ? 'deadbeef' : null;
    }
    if (cmd === 'rev-parse' && args[1] === '--symbolic-full-name') {
      const short = args[2]!;
      const name = short.slice('origin/'.length);
      return state.canon?.[short] ?? `refs/remotes/origin/${name}`;
    }
    if (cmd === 'merge-base') {
      return (state.ancestors ?? []).includes(args[2]!) || args[2] === args[3] ? '' : null;
    }
    throw new Error(`fake git 不認得:${args.join(' ')}`);
  };
}

const healthy = () => fakeGit({ head: MAIN, commits: [MAIN, 'refs/remotes/origin/release'], ancestors: ['refs/remotes/origin/release'] });

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
    const r = resolveDeliveryRefs(fakeGit({ head: null, commits: [MAIN] }), undefined, ['main']);
    expect(r.ok).toBe(false);
    expect(r.refs).toEqual([]);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.missing']);
  });
  it('base.shape:目標不是 refs/remotes/origin/<literal> → 拒', () => {
    const r = resolveDeliveryRefs(fakeGit({ head: 'refs/heads/main', commits: ['refs/heads/main'] }), undefined, ['main']);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.shape']);
    expect(r.refs).toEqual([]);
  });
  it('base.unresolvable:形狀正規、名稱已宣告、但解不出 commit → 拒、refs 空', () => {
    const r = resolveDeliveryRefs(fakeGit({ head: MAIN, commits: [] }), undefined, ['main']);
    expect(r.ok).toBe(false);
    expect(r.refs).toEqual([]);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.unresolvable']);
  });
  it('base.noncanonical:origin/main 正規解析到別的 ref(本地遮蔽)→ 拒', () => {
    const git = fakeGit({ head: MAIN, commits: [MAIN], canon: { 'origin/main': 'refs/heads/origin/main' } });
    const r = resolveDeliveryRefs(git, undefined, ['main']);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.noncanonical']);
    expect(r.refs).toEqual([]);
  });
  it('base.undeclared:origin/HEAD 指向正規、可解、但未宣告的分支;env 空 → 仍拒、refs 空', () => {
    const git = fakeGit({ head: 'refs/remotes/origin/trunk', commits: ['refs/remotes/origin/trunk'] });
    const r = resolveDeliveryRefs(git, undefined, ['main']);
    expect(r.ok).toBe(false);
    expect(r.refs).toEqual([]);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.undeclared']);
  });
  it('正對照:origin/HEAD → 已宣告 main、env 空 → refs = [base]', () => {
    const r = resolveDeliveryRefs(healthy(), undefined, ['main']);
    expect(r).toEqual({ ok: true, refs: [MAIN], rejections: [] });
  });
});

describe('env DELIVERY_REFS 候選', () => {
  const declared = ['main', 'release'];
  it('ref.syntax:白名單外字元 → 拒', () => {
    const r = resolveDeliveryRefs(healthy(), 'origin/main;pwd', declared);
    expect(r.rejections.map((x) => x.code)).toEqual(['ref.syntax']);
    expect(r.refs).toEqual([]);
  });
  it('ref.shape:HEAD / 本地分支 / 其他 remote → 拒', () => {
    for (const bad of ['HEAD', 'main', 'feature/x', 'upstream/main', 'refs/remotes/origin/main']) {
      const r = resolveDeliveryRefs(healthy(), bad, declared);
      expect(r.rejections.map((x) => x.code), bad).toEqual(['ref.shape']);
      expect(r.refs).toEqual([]);
    }
  });
  it('ref.unresolvable:origin/<name> 解不出 commit → 拒', () => {
    const r = resolveDeliveryRefs(healthy(), 'origin/nope', declared);
    expect(r.rejections.map((x) => x.code)).toEqual(['ref.unresolvable']);
  });
  it('ref.noncanonical:origin/release 被本地 ref 遮蔽 → 拒', () => {
    const git = fakeGit({
      head: MAIN,
      commits: [MAIN, 'refs/remotes/origin/release'],
      canon: { 'origin/release': 'refs/heads/origin/release' },
      ancestors: ['refs/remotes/origin/release'],
    });
    const r = resolveDeliveryRefs(git, 'origin/release', declared);
    expect(r.rejections.map((x) => x.code)).toEqual(['ref.noncanonical']);
  });
  it('ref.nonancestor:已宣告、正規、可解,但不是 base 祖先(未合併)→ 拒', () => {
    const git = fakeGit({ head: MAIN, commits: [MAIN, 'refs/remotes/origin/release'], ancestors: [] });
    const r = resolveDeliveryRefs(git, 'origin/release', declared);
    expect(r.rejections.map((x) => x.code)).toEqual(['ref.nonancestor']);
    expect(r.refs).toEqual([]);
  });
  it('ref.undeclared:正規、可解、是祖先,但 <name> 未宣告 → 拒(祖先與宣告是兩道獨立假設)', () => {
    const r = resolveDeliveryRefs(healthy(), 'origin/release', ['main']);
    expect(r.ok).toBe(false);
    expect(r.refs).toEqual([]);
    expect(r.rejections.map((x) => x.code)).toEqual(['ref.undeclared']);
  });
  it('沒有受驗 base 時,env 候選一律 ref.nonancestor(不掩蓋 base.*)', () => {
    const r = resolveDeliveryRefs(fakeGit({ head: null, commits: [MAIN] }), 'origin/main', declared);
    expect(r.rejections.map((x) => x.code)).toEqual(['base.missing', 'ref.nonancestor']);
    expect(r.refs).toEqual([]);
  });
  it('多候選:原因碼全部列出、不短路;任一拒 → refs 全空', () => {
    const r = resolveDeliveryRefs(healthy(), 'origin/release, HEAD ,origin/nope,x;y', declared);
    expect(r.rejections.map((x) => x.code)).toEqual(['ref.shape', 'ref.unresolvable', 'ref.syntax']);
    expect(r.refs).toEqual([]);
  });
  it('正對照:origin/release 已宣告且為祖先 → refs = [base, release];重複去重;逗號空白容忍', () => {
    const r = resolveDeliveryRefs(healthy(), ' origin/release , origin/main,origin/release ', declared);
    expect(r).toEqual({ ok: true, refs: [MAIN, 'refs/remotes/origin/release'], rejections: [] });
  });
});

describe('validateRef 共用(base 與 env 走同一支)', () => {
  it('kind 只影響原因碼前綴', () => {
    const git = fakeGit({ head: MAIN, commits: [] });
    expect(validateRef(git, MAIN, { kind: 'base', declared: ['main'] })?.code).toBe('base.unresolvable');
    expect(validateRef(git, MAIN, { kind: 'ref', declared: ['main'] })?.code).toBe('ref.unresolvable');
  });
});

describe('config 與 formatRejections', () => {
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
  it('config.invalid:harness.config.json 缺 / 壞 → 拒,不猜', () => {
    const missing = loadDeclaredDeliveryBranches(tmp());
    expect('rejection' in missing && missing.rejection.code).toBe('config.invalid');
    const d = tmp();
    writeFileSync(path.join(d, 'scripts/harness.config.json'), '{bad');
    const bad = loadDeclaredDeliveryBranches(d);
    expect('rejection' in bad && bad.rejection.code).toBe('config.invalid');
    expect(resolveDeliveryRefsFromRepo(d, {}).rejections.map((x) => x.code)).toEqual(['config.invalid']);
  });
  it('formatRejections 每條印原因碼與輸入', () => {
    const text = formatRejections([{ code: 'ref.undeclared', input: 'origin/x', detail: 'd' }]);
    expect(text).toContain('[ref.undeclared] origin/x');
    expect(text).toContain('沒有 fallback');
  });
});
