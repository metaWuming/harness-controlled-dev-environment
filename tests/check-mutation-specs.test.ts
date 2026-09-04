// tests/check-mutation-specs.test.ts — mutation spec 樣本漂移守門(純函式 + 真 CLI / 真 git fixture)
//
// 行為級負對照:樣本消失 / 多處 / JSON 壞 → exit 1;spec 檔或目錄換 symlink、untracked、
// 0 個 spec 檔 → exit 2 且外部檔內容**不得**成為輸入。1 與 2 在 CI 都是紅,分開只為診斷語意。

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkSpecFile, findCaseCollisions, formatReport, discoverSpecFiles, parseRootArg, runCheck, SPEC_DIR, walkSpecDir, type WalkerIO } from '../scripts/check-mutation-specs';
import type { Stats } from 'node:fs';

const REPO = path.resolve(__dirname, '..');
const TSX = path.join(REPO, 'node_modules/.bin/tsx');
const SCRIPT = path.join(REPO, 'scripts/check-mutation-specs.ts');

// FS 大小寫敏感度探測(supervisor Step 3 明列:temp dir 建 + finally 清、不污染 repo)。
// 供 Vitest 註冊期條件 `it.skipIf(!caseSensitive)`(supervisor P2-2 明列:不在 test body 內臨時 skip)。
const caseSensitive: boolean = (() => {
  const probe = mkdtempSync(path.join(tmpdir(), 'msd-case-probe-'));
  try {
    writeFileSync(path.join(probe, 'x.json'), '');
    return !existsSync(path.join(probe, 'X.JSON'));
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
})();

function run(args: string[]): { code: number | null; out: string; err: string } {
  const r = spawnSync(TSX, [SCRIPT, ...args], { cwd: REPO, encoding: 'utf-8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const SRC = 'export function guard(x: number) {\n  if (x < 0) throw new Error("neg");\n  return x;\n}\n';
const GOOD_SPEC = [{ file: 'src/guard.ts', find: 'if (x < 0) throw', replace: 'if (false) throw', label: 'M1 拿掉負數守衛' }];

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

interface RepoOpts {
  /** spec 檔名 → 內容(字串直接寫入);預設一個合法 spec */
  specs?: Record<string, string>;
  src?: string;
  /** 不 git add 的檔 */
  skipTrack?: string[];
  /** 不建立 scripts/mutations 目錄 */
  noDir?: boolean;
}

function makeRepo(opts: RepoOpts = {}): string {
  // macOS 的 tmpdir 是 symlink(/var → /private/var);純函式要吃 realpath(CLI 入口自己會 realpath)
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'msd-')));
  made.push(dir);
  const files: Record<string, string> = { 'src/guard.ts': opts.src ?? SRC };
  if (!opts.noDir) {
    const specs = opts.specs ?? { 'guard.json': JSON.stringify(GOOD_SPEC) };
    for (const [name, text] of Object.entries(specs)) files[`${SPEC_DIR}/${name}`] = text;
  }
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  if (opts.noDir) mkdirSync(path.join(dir, SPEC_DIR), { recursive: true });
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf-8', stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 'e2e@example.test');
  git('config', 'user.name', 'e2e');
  for (const rel of Object.keys(files)) if (!(opts.skipTrack ?? []).includes(rel)) git('add', rel);
  git('commit', '-q', '-m', 'fixture');
  return dir;
}

describe('discoverSpecFiles(目錄邊界)', () => {
  it('真目錄 → 排序後的 .json 清單,README 不算', () => {
    const r = discoverSpecFiles(makeRepo({ specs: { 'b.json': '[]', 'a.json': '[]', 'README.md': '#' } }));
    expect(r.ok).toBe(true);
    expect(r.specs).toEqual([`${SPEC_DIR}/a.json`, `${SPEC_DIR}/b.json`]);
  });
  it('目錄不存在 / 0 個 spec 檔 → 拒判', () => {
    const empty = realpathSync(mkdtempSync(path.join(tmpdir(), 'msd-empty-')));
    made.push(empty);
    expect(discoverSpecFiles(empty).ok).toBe(false);
    const r = discoverSpecFiles(makeRepo({ noDir: true }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('沒有任何 spec 檔');
  });
  it('目錄本身是 symlink → 拒判', () => {
    const dir = makeRepo();
    const real = path.join(dir, SPEC_DIR);
    execFileSync('mv', [real, path.join(dir, 'elsewhere')]);
    symlinkSync(path.join(dir, 'elsewhere'), real);
    const r = discoverSpecFiles(dir);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('symlink');
  });
});

describe('findCaseCollisions(collision key = lowercased 完整 POSIX repo-relative path)', () => {
  it('同層同 basename 不同大小寫 → 1 組衝突', () => {
    const r = findCaseCollisions(['a/foo.json', 'a/FOO.json']);
    expect(r).toEqual([{ key: 'a/foo.json', members: ['a/FOO.json', 'a/foo.json'] }]);
  });
  it('頂層同 basename 不同大小寫 → 1 組衝突', () => {
    const r = findCaseCollisions(['foo.json', 'FOO.json']);
    expect(r).toEqual([{ key: 'foo.json', members: ['FOO.json', 'foo.json'] }]);
  });
  it('不同目錄同 basename → 合法不同 spec、不衝突', () => {
    // supervisor P1-2 明列:sprint-a/guard.json 與 sprint-b/guard.json 是合法不同 spec
    expect(findCaseCollisions(['sprint-a/guard.json', 'sprint-b/guard.json'])).toEqual([]);
  });
  it('多對衝突 → 全列出、依 key 排序', () => {
    const r = findCaseCollisions(['z/foo.json', 'z/Foo.json', 'a/bar.json', 'a/BAR.json']);
    expect(r.map((g) => g.key)).toEqual(['a/bar.json', 'z/foo.json']);
    expect(r[0]!.members).toEqual(['a/BAR.json', 'a/bar.json']);
    expect(r[1]!.members).toEqual(['z/Foo.json', 'z/foo.json']);
  });
  it('單筆 / 空陣列 → 空', () => {
    expect(findCaseCollisions([])).toEqual([]);
    expect(findCaseCollisions(['foo.json'])).toEqual([]);
  });
});

describe('walkSpecDir(可注入 IO 的 traversal fail-closed 邊界)', () => {
  // 建構 mock Stats — 只設定 walker 會問的三個判別式
  function mockStat(kind: 'file' | 'dir' | 'symlink' | 'other'): Stats {
    return {
      isFile: () => kind === 'file',
      isDirectory: () => kind === 'dir',
      isSymbolicLink: () => kind === 'symlink',
    } as Stats;
  }

  it('readdir throw → fail-closed 帶 rel + message', () => {
    const io: WalkerIO = {
      readdir: () => { throw new Error('EACCES: permission denied'); },
      lstat: () => mockStat('file'),
      stat: () => mockStat('file'),
    };
    const r = walkSpecDir('/fake/abs', 'sub', io);
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.reason).toContain('readdir 失敗於 sub');
      expect(r.reason).toContain('permission denied');
    }
  });

  it('readdir throw 在頂層 → rel 用 "." 佔位', () => {
    const io: WalkerIO = {
      readdir: () => { throw new Error('EIO'); },
      lstat: () => mockStat('file'),
      stat: () => mockStat('file'),
    };
    const r = walkSpecDir('/fake/abs', '', io);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toContain('readdir 失敗於 .');
  });

  it('lstat throw → fail-closed 帶 rel + message', () => {
    const io: WalkerIO = {
      readdir: () => ['weird.json'],
      lstat: () => { throw new Error('ENOENT: no such file'); },
      stat: () => mockStat('file'),
    };
    const r = walkSpecDir('/fake/abs', '', io);
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.reason).toContain('lstat 失敗於 weird.json');
      expect(r.reason).toContain('no such file');
    }
  });

  it('symlink 指向 dir → fail-closed(不可靜默略過)', () => {
    // supervisor P1-1:遞迴途中任一 symlink dir 一律 fail-closed
    const io: WalkerIO = {
      readdir: () => ['link-to-dir'],
      lstat: () => mockStat('symlink'),
      stat: () => mockStat('dir'),
    };
    const r = walkSpecDir('/fake/abs', '', io);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toBe('symlink directory:link-to-dir');
  });

  it('symlink 目標 stat throw → fail-closed', () => {
    const io: WalkerIO = {
      readdir: () => ['dangling.json'],
      lstat: () => mockStat('symlink'),
      stat: () => { throw new Error('ENOENT: dangling'); },
    };
    const r = walkSpecDir('/fake/abs', '', io);
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.reason).toContain('symlink 目標無法讀於 dangling.json');
      expect(r.reason).toContain('dangling');
    }
  });

  it('symlink 指向 file(.json)→ 收入(交給 checkTarget 拒 symlink)', () => {
    const io: WalkerIO = {
      readdir: () => ['ok.json'],
      lstat: () => mockStat('symlink'),
      stat: () => mockStat('file'),
    };
    const r = walkSpecDir('/fake/abs', '', io);
    expect(r.ok).toBe(true);
    if (r.ok === true) expect(r.entries).toEqual(['ok.json']);
  });

  it('lstat 回異常型別(非 file / dir / symlink)→ fail-closed', () => {
    const io: WalkerIO = {
      readdir: () => ['socket.json'],
      lstat: () => mockStat('other'),
      stat: () => mockStat('other'),
    };
    const r = walkSpecDir('/fake/abs', '', io);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.reason).toContain('未預期型別於 socket.json');
  });

  it('副檔名 lowercase 收(.JSON / .Json / .json 都收)', () => {
    const io: WalkerIO = {
      readdir: () => ['A.JSON', 'b.Json', 'c.json', 'README.md'],
      lstat: () => mockStat('file'),
      stat: () => mockStat('file'),
    };
    const r = walkSpecDir('/fake/abs', '', io);
    expect(r.ok).toBe(true);
    if (r.ok === true) expect(r.entries).toEqual(['A.JSON', 'b.Json', 'c.json']);
  });

  it('symlink → file 且大寫副檔名 .JSON → 收入(Step 5 F1/W2 補:D2 case-insensitive 覆蓋 symlink 分支)', () => {
    // MSD-D2b mutant 對 line 155 symlink→file 分支拿掉 .toLowerCase() 時本 unit 轉紅
    const io: WalkerIO = {
      readdir: () => ['A.JSON'],
      lstat: () => mockStat('symlink'),
      stat: () => mockStat('file'),
    };
    const r = walkSpecDir('/fake/abs', '', io);
    expect(r.ok).toBe(true);
    if (r.ok === true) expect(r.entries).toEqual(['A.JSON']);
  });
});

describe('checkSpecFile(單檔判定)', () => {
  it('全對 → ok 並回探針數', () => {
    const r = checkSpecFile(makeRepo(), `${SPEC_DIR}/guard.json`);
    expect(r).toMatchObject({ status: 'ok', probes: 1, problems: [] });
  });
  it('樣本消失 → drift,訊息帶 label 與原因', () => {
    const r = checkSpecFile(makeRepo({ src: SRC.replace('x < 0', 'x <= 0') }), `${SPEC_DIR}/guard.json`);
    expect(r.status).toBe('drift');
    expect(r.problems[0]).toContain('M1 拿掉負數守衛');
    expect(r.problems[0]).toContain('src/guard.ts');
  });
  it('樣本出現多處且無 all → drift;加 all → ok', () => {
    const src = SRC + SRC.replace('guard', 'guard2');
    const two = (all: boolean) => JSON.stringify([{ ...GOOD_SPEC[0], all }]);
    expect(checkSpecFile(makeRepo({ src, specs: { 'g.json': two(false) } }), `${SPEC_DIR}/g.json`).status).toBe('drift');
    expect(checkSpecFile(makeRepo({ src, specs: { 'g.json': two(true) } }), `${SPEC_DIR}/g.json`).status).toBe('ok');
  });
  it('find === replace → drift(什麼都沒改)', () => {
    const spec = JSON.stringify([{ ...GOOD_SPEC[0], replace: GOOD_SPEC[0]!.find }]);
    expect(checkSpecFile(makeRepo({ specs: { 'g.json': spec } }), `${SPEC_DIR}/g.json`).status).toBe('drift');
  });
  it('JSON 壞 / 空陣列 / 缺 label → drift(內容層,exit 1 語意)', () => {
    for (const bad of ['{not json', '[]', JSON.stringify([{ file: 'src/guard.ts', find: 'x', replace: 'y' }])]) {
      const r = checkSpecFile(makeRepo({ specs: { 'g.json': bad } }), `${SPEC_DIR}/g.json`);
      expect(r.status).toBe('drift');
      expect(r.problems[0]).toContain('解析失敗');
    }
  });
  // P2#3 defer ⑭:BOM spec 走既有 drift 類別、problem hint 明列 UTF-8 BOM root cause
  it('P2#3 defer ⑭:BOM spec → drift + problems 含 UTF-8 BOM root-cause hint', () => {
    const bomSpec = '﻿' + JSON.stringify(GOOD_SPEC);
    const r = checkSpecFile(makeRepo({ specs: { 'g.json': bomSpec } }), `${SPEC_DIR}/g.json`);
    expect(r.status).toBe('drift');
    expect(r.problems[0]).toContain('UTF-8 BOM');
    expect(r.problems[0]).toContain('EF BB BF');
  });
  it('目標檔不存在 / 未追蹤 / 是 symlink → drift', () => {
    const missing = JSON.stringify([{ ...GOOD_SPEC[0], file: 'src/nope.ts' }]);
    expect(checkSpecFile(makeRepo({ specs: { 'g.json': missing } }), `${SPEC_DIR}/g.json`).status).toBe('drift');
    expect(checkSpecFile(makeRepo({ skipTrack: ['src/guard.ts'] }), `${SPEC_DIR}/guard.json`).status).toBe('drift');
    const dir = makeRepo();
    rmSync(path.join(dir, 'src/guard.ts'));
    writeFileSync(path.join(dir, 'real.ts'), SRC);
    symlinkSync(path.join(dir, 'real.ts'), path.join(dir, 'src/guard.ts'));
    const r = checkSpecFile(dir, `${SPEC_DIR}/guard.json`);
    expect(r.status).toBe('drift');
    expect(r.problems[0]).toContain('symlink');
  });
  it('spec 檔本身未追蹤 → untrusted(不是 drift)', () => {
    const r = checkSpecFile(makeRepo({ skipTrack: [`${SPEC_DIR}/guard.json`] }), `${SPEC_DIR}/guard.json`);
    expect(r.status).toBe('untrusted');
    expect(r.problems[0]).toContain('沒有被 git 追蹤');
  });
});

describe('formatReport / parseRootArg', () => {
  it('untrusted 優先於 drift → code 2;只有 drift → 1;全 ok → 0', () => {
    const ok = { rel: 'a', status: 'ok' as const, probes: 3, problems: [] };
    const drift = { rel: 'b', status: 'drift' as const, probes: 2, problems: ['b[0] L → x'] };
    const un = { rel: 'c', status: 'untrusted' as const, probes: 0, problems: ['spec 檔 c:symlink'] };
    expect(formatReport([ok]).code).toBe(0);
    expect(formatReport([ok]).text).toContain('3 條探針');
    expect(formatReport([ok, drift]).code).toBe(1);
    expect(formatReport([ok, drift, un]).code).toBe(2);
    expect(formatReport([drift, un]).text).toContain('b[0] L → x');
  });
  it('空 results → code 2 defense-in-depth(P2#3 defer ⑩;M7 direct killer)', () => {
    // discoverSpecFiles 前置 0-spec 守門是第一道防線(M2);formatReport([]) fail-closed
    // 是第二道防線(M7)。此 unit 精確驗 formatReport 對 [] 的判定契約、只依賴
    // 純函式行為、不透過 runCheck / CLI e2e(避免與第一道混淆)。
    const r = formatReport([]);
    expect(r.code).toBe(2);
    expect(r.text).toContain('結果集為空');
  });
  it('argv 只收單一 --root=<dir>', () => {
    expect(parseRootArg([])).toEqual({ ok: true, root: null });
    expect(parseRootArg(['--root=/x'])).toEqual({ ok: true, root: '/x' });
    expect(parseRootArg(['--root='])).toMatchObject({ ok: false });
    expect(parseRootArg(['--root=/x', '--root=/y'])).toMatchObject({ ok: false });
    expect(parseRootArg(['--all'])).toMatchObject({ ok: false });
  });
  // invokedAsMain 本地實作已抽出到 scripts/lib/invoked-as-main.ts,unit test 覆蓋
  // 見 tests/invoked-as-main.test.ts;此處不重複(P2#3 defer ①②)
  it('root 不存在 → code 2', () => {
    expect(runCheck(path.join(tmpdir(), 'msd-does-not-exist-' + Date.now())).code).toBe(2);
  });
});

describe('CLI e2e(真子程序、真 git fixture)', () => {
  it('① 全對 → exit 0', () => {
    const r = run([`--root=${makeRepo()}`]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('1 條探針');
  });
  it('② 改一行原始碼 → exit 1 並點名探針', () => {
    const r = run([`--root=${makeRepo({ src: SRC.replace('x < 0', 'x <= 0') })}`]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('M1 拿掉負數守衛');
  });
  it('③ spec JSON 壞 → exit 1', () => {
    const r = run([`--root=${makeRepo({ specs: { 'g.json': '{oops' } })}`]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('解析失敗');
  });
  // P2#3 defer ⑭:BOM spec CLI e2e、走既有 drift 類別、stderr 明列 UTF-8 BOM root cause
  it('③.5 P2#3 defer ⑭:BOM spec → exit 1 + stderr 含 UTF-8 BOM root-cause hint', () => {
    const bomSpec = '﻿' + JSON.stringify(GOOD_SPEC);
    const r = run([`--root=${makeRepo({ specs: { 'g.json': bomSpec } })}`]);
    expect(r.code).toBe(1);
    expect(r.err).toContain('UTF-8 BOM');
  });
  it('④ 0 個 spec 檔 → exit 2', () => {
    const r = run([`--root=${makeRepo({ noDir: true })}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('沒有任何 spec 檔');
  });
  it('⑤ tracked spec 換成指向 repo 外的 symlink → exit 2、特定診斷、外部檔內容未成為輸入', () => {
    // P2#3 defer ⑫:斷言穩定化 — unique marker + 必然 drift
    // evil.json 為 JSON/shape 合法但必然 drift(EVIL_SENTINEL 對 src/guard.ts 內不存在);
    // 若防線回歸(外部檔被讀入),acceptance 路徑必走:
    //   checkSpecFile → applyMutation 找不到 EVIL_SENTINEL → problems.push(含 EVIL_LABEL)
    //   → formatReport 回 code=1 → CLI main 走 console.error(report.text) → EVIL_LABEL 在 stderr。
    // 主要斷言 r.err.not.toContain(EVIL_LABEL);r.out.not.toContain(EVIL_LABEL) 為 defensive no-leak check(雙通道防衛)。
    const EVIL_LABEL = 'DEFER12_EVIL_EXTERNAL_MARKER_MUST_NOT_APPEAR';
    const EVIL_SENTINEL = 'DEFER12_EVIL_FIND_SENTINEL_NEVER_IN_SRC';
    const EVIL_SPEC = [{ file: 'src/guard.ts', find: EVIL_SENTINEL, replace: 'PLACEHOLDER', label: EVIL_LABEL }];
    const dir = makeRepo();
    const outside = realpathSync(mkdtempSync(path.join(tmpdir(), 'msd-outside-')));
    made.push(outside);
    writeFileSync(path.join(outside, 'evil.json'), JSON.stringify(EVIL_SPEC));
    const specPath = path.join(dir, SPEC_DIR, 'guard.json');
    rmSync(specPath);
    symlinkSync(path.join(outside, 'evil.json'), specPath);
    const r = run([`--root=${dir}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain(`spec 檔 ${SPEC_DIR}/guard.json:目標是 symlink`);
    expect(r.err).not.toContain(EVIL_LABEL);
    expect(r.out).not.toContain(EVIL_LABEL);
  });
  it('⑥ scripts/mutations 目錄換成 symlink → exit 2', () => {
    const dir = makeRepo();
    const real = path.join(dir, SPEC_DIR);
    execFileSync('mv', [real, path.join(dir, 'elsewhere')]);
    symlinkSync(path.join(dir, 'elsewhere'), real);
    const r = run([`--root=${dir}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('symlink');
  });
  it('⑦ spec 檔未追蹤 → exit 2', () => {
    const r = run([`--root=${makeRepo({ skipTrack: [`${SPEC_DIR}/guard.json`] })}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('沒有被 git 追蹤');
  });
  it('⑧ argv 錯 → exit 2', () => {
    expect(run(['--bogus']).code).toBe(2);
  });
  it('⑨ 本 repo 自身 → exit 0(gate 上線不會立刻紅)', () => {
    expect(run([]).code).toBe(0);
  });
  it('⑩ 經 symlink 目錄呼叫腳本 → main 仍執行(argv 錯要 exit 2,不得靜默 exit 0)', () => {
    const linkDir = path.join(realpathSync(mkdtempSync(path.join(tmpdir(), 'msd-link-'))), 'repo');
    made.push(path.dirname(linkDir));
    symlinkSync(REPO, linkDir);
    const r = spawnSync(TSX, [path.join(linkDir, 'scripts/check-mutation-specs.ts'), '--bogus'], { cwd: REPO, encoding: 'utf-8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('參數錯誤');
  });

  // ─────────── P2#3 defer ⑤ 新增 e2e:遞迴 / 大小寫 / symlink 子目錄 fail-closed / 深巢狀 / collision ───────────

  it('⑪ 子目錄 spec 對得上 → exit 0、印子目錄相對路徑', () => {
    const r = run([`--root=${makeRepo({ specs: { 'sub/x.json': JSON.stringify(GOOD_SPEC), 'top.json': JSON.stringify(GOOD_SPEC) } })}`]);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`${SPEC_DIR}/sub/x.json`);
    expect(r.out).toContain(`${SPEC_DIR}/top.json`);
  });

  it('⑫ 子目錄 spec 有 drift → exit 1、點名子目錄探針 label', () => {
    const r = run([`--root=${makeRepo({ src: SRC.replace('x < 0', 'x <= 0'), specs: { 'sub/nested.json': JSON.stringify(GOOD_SPEC) } })}`]);
    expect(r.code).toBe(1);
    expect(r.err).toContain(`${SPEC_DIR}/sub/nested.json`);
    expect(r.err).toContain('M1 拿掉負數守衛');
  });

  it('⑬ 大寫副檔名(.JSON / .Json)對得上 → exit 0', () => {
    const r = run([`--root=${makeRepo({ specs: { 'A.JSON': JSON.stringify(GOOD_SPEC) } })}`]);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`${SPEC_DIR}/A.JSON`);
  });

  it('⑭ symlink 子目錄 fail-closed(即使同時有合法 top-level spec 也仍 exit 2)', () => {
    // supervisor P1-1 明列:遞迴途中 symlink dir 不能被合法 spec 掩蓋
    const dir = makeRepo({ specs: { 'top.json': JSON.stringify(GOOD_SPEC) } });
    const linkTarget = mkdtempSync(path.join(tmpdir(), 'msd-linktarget-'));
    made.push(linkTarget);
    mkdirSync(path.join(dir, SPEC_DIR, 'sub-link-parent'), { recursive: true });
    symlinkSync(linkTarget, path.join(dir, SPEC_DIR, 'sub-link-parent', 'sub'));
    const r = run([`--root=${dir}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('symlink directory:sub-link-parent/sub');
  });

  it('⑮ 深巢狀 a/b/c/x.json → exit 0(遞迴無深度上限)', () => {
    const r = run([`--root=${makeRepo({ specs: { 'a/b/c/x.json': JSON.stringify(GOOD_SPEC) } })}`]);
    expect(r.code).toBe(0);
    expect(r.out).toContain(`${SPEC_DIR}/a/b/c/x.json`);
  });

  it('⑰ hardlink spec + target(nlink=2 tracked)→ exit 0(P2#3 defer ⑥、純讀 caller 走 readCheckedTarget、跳過 nlink=1 拒判)', () => {
    // fixture:兩份 spec 檔互為 hardlink(同 inode、nlink=2、同 tracked);
    // target src/guard.ts 也建 hardlink alias src/guard-alias.ts。
    // 舊行為(checkTarget nlink=1 拒)= exit 2;新行為(readCheckedTarget 純讀不擋)= exit 0。
    const dir = makeRepo({ specs: { 'guard.json': JSON.stringify(GOOD_SPEC) } });
    // spec 檔本身建 hardlink alias(同目錄、tracked)
    execFileSync('ln', [path.join(dir, `${SPEC_DIR}/guard.json`), path.join(dir, `${SPEC_DIR}/guard-alias.json`)]);
    execFileSync('git', ['-C', dir, 'add', `${SPEC_DIR}/guard-alias.json`], { stdio: 'ignore' });
    // target 也建 hardlink alias
    execFileSync('ln', [path.join(dir, 'src/guard.ts'), path.join(dir, 'src/guard-alias.ts')]);
    execFileSync('git', ['-C', dir, 'add', 'src/guard-alias.ts'], { stdio: 'ignore' });
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'add hardlink aliases'], { stdio: 'ignore' });
    const r = run([`--root=${dir}`]);
    expect(r.code).toBe(0);
    // 兩份 spec 都被檢查、樣本對得上
    expect(r.out).toContain('guard.json — 1 條探針樣本都對得上');
    expect(r.out).toContain('guard-alias.json — 1 條探針樣本都對得上');
    // 不應出現 nlink 拒判訊息(hardlink 不會拒)
    expect(r.err).not.toContain('hardlink');
  });

  it.skipIf(!caseSensitive)('⑯ collision 在 case-sensitive FS(sub/foo.json + sub/FOO.json)→ exit 2 帶「同名衝突」', () => {
    // Vitest 註冊期條件(supervisor P2-2 明列:不在 test body 內臨時 skip)。
    // 這條**不是** collision 唯一證據;deterministic pure findCaseCollisions unit 才是必要覆蓋。
    const dir = makeRepo({ specs: { 'sub/foo.json': JSON.stringify(GOOD_SPEC), 'sub/FOO.json': JSON.stringify(GOOD_SPEC) } });
    const r = run([`--root=${dir}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('同名衝突');
  });
});
