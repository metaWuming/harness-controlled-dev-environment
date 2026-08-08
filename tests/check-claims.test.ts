// `scripts/check-claims.ts` 的守門測試。
//
// 這支工具的價值全押在一件事上:**它抓不抓得到「真的被 review 抓過」的那幾句。**
// 所以除了純函式行為,還有一條**案例鎖**:把真實 review 案例去識別化後的斷言形狀寫死在
// 測試裡,逐句斷言會命中。清單被改窄時那些句型會漏掉 → 轉紅。
//
// ⚠️ 樣本句**寫死在這裡、不從 `CLAIM_PATTERNS` 推導**(斷言若從被測物長出來
//    ——整條 pattern 刪掉時,用 `it.each(patterns)` 產生的斷言會跟著消失,測試照樣全綠)。
//
// ⚠️ 本模板其餘測試都是純函式;唯本檔有一段端到端(拋棄式 git repo 真跑腳本),因為
//    這支工具的招牌安全性質(`--exclude-standard` 防 gitignore 檔內容外流)只能端到端驗。
//    子程序用本地 `tsx` binary 跑(離線、對齊 package.json 的 `check:claims`)。

import { execFileSync, spawnSync } from 'node:child_process';
import { linkSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CLAIM_PATTERNS,
  normalizeForMatch,
  parseAddedLines,
  scanClaims,
  untrackedAsAddedLines,
  type AddedLine,
} from '../scripts/check-claims';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf-8',
}).trim();

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@t',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@t',
};

const created: string[] = [];
afterEach(() => {
  while (created.length) rmSync(created.pop()!, { recursive: true, force: true });
});

describe('parseAddedLines — 從 -U0 的 diff 取新增行與行號', () => {
  it('hunk header 的 +start 就是第一條新增行的行號,之後累加', () => {
    const diff = [
      'diff --git a/x.ts b/x.ts',
      '--- a/x.ts',
      '+++ b/x.ts',
      '@@ -3,0 +4,2 @@',
      '+第一行',
      '+第二行',
    ].join('\n');
    expect(parseAddedLines(diff)).toEqual([
      { file: 'x.ts', line: 4, text: '第一行' },
      { file: 'x.ts', line: 5, text: '第二行' },
    ]);
  });

  it('🔴 `+++ b/` 檔頭不得被當成新增行(它也是 + 開頭)', () => {
    const diff = ['--- a/x.ts', '+++ b/x.ts', '@@ -0,0 +1 @@', '+內容'].join('\n');
    const lines = parseAddedLines(diff);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('內容');
  });

  it('多個 hunk 各自從自己的 +start 起算(不是一路累加)', () => {
    const diff = ['+++ b/x.ts', '@@ -1,0 +2 @@', '+A', '@@ -10,0 +20 @@', '+B'].join('\n');
    expect(parseAddedLines(diff).map((l) => l.line)).toEqual([2, 20]);
  });

  it('多檔案:檔名跟著 `+++` 切換', () => {
    const diff = [
      '+++ b/a.ts',
      '@@ -0,0 +1 @@',
      '+A',
      '+++ b/b.ts',
      '@@ -0,0 +9 @@',
      '+B',
    ].join('\n');
    expect(parseAddedLines(diff)).toEqual([
      { file: 'a.ts', line: 1, text: 'A' },
      { file: 'b.ts', line: 9, text: 'B' },
    ]);
  });

  it('刪除整個檔(+++ /dev/null)不產生新增行', () => {
    const diff = ['--- a/x.ts', '+++ /dev/null', '@@ -1 +0,0 @@', '-沒了'].join('\n');
    expect(parseAddedLines(diff)).toEqual([]);
  });

  it('🔴 就算 diff 畸形(`+++ /dev/null` 後面跟著 `+` 行)也不得把行掛到 /dev/null 上', () => {
    // git 產不出這種輸出(刪除的 hunk 不會有 + 行),但這支是**解析外部輸入**的函式。
    // ⚠️ 沒有這條的話,`/dev/null` 那道守衛就是永遠走不到的死碼——mutation 實測會存活。
    //    與其留一行沒有規格的防禦,不如把行為講清楚。
    const diff = ['+++ /dev/null', '@@ -0,0 +1 @@', '+不該被歸給誰'].join('\n');
    expect(parseAddedLines(diff)).toEqual([]);
  });

  it('空 diff → 空清單(正對照:沒東西時不會憑空生出行)', () => {
    expect(parseAddedLines('')).toEqual([]);
  });

  it('🔴 新增內容本身以 `+++` 開頭時,不得被誤認成檔案 header 而整行跳過', () => {
    // raw diff 那一行會長成 `++++ …`。只看行首是不是 `+++ ` 的話,這一行被當成
    // header 切掉——**那一行的量詞完全不會被掃到,而且靜悄悄的**。
    const diff = ['+++ b/x.md', '@@ -0,0 +1 @@', '++++ 全面保證不會出錯'].join('\n');
    const lines = parseAddedLines(diff);
    expect(lines).toEqual([{ file: 'x.md', line: 1, text: '+++ 全面保證不會出錯' }]);
    expect(scanClaims(lines).length, '這條被跳過＝一個現成的繞過路徑').toBeGreaterThan(0);
  });

  it('`@@ … +a,0 @@`(該 hunk 沒有新增行)不吃掉後面的行', () => {
    const diff = [
      '+++ b/x.ts',
      '@@ -1,2 +1,0 @@',
      '-刪掉的',
      '-也刪掉',
      '@@ -3,0 +3 @@',
      '+新的唯一入口',
    ].join('\n');
    expect(parseAddedLines(diff)).toEqual([{ file: 'x.ts', line: 3, text: '新的唯一入口' }]);
  });
});

describe('scanClaims — 命中判定', () => {
  const line = (text: string): AddedLine => ({ file: 'f.ts', line: 1, text });

  it('命中時回報**是哪個詞**命中(只回布林的話沒辦法逐條處置)', () => {
    const hits = scanClaims([line('// 成立的理由只有這一條')]);
    expect(hits).toHaveLength(1);
    expect(hits[0].matched).toBe('只有');
    expect(hits[0].why).toContain('唯一性');
  });

  it('同一行命中多個詞 → 全部列出', () => {
    const hits = scanClaims([line('兩道各自都足夠,而且永遠不會錯')]);
    expect(hits.map((h) => h.matched).sort()).toEqual(['各自都足夠', '永遠不'].sort());
  });

  it('🔴 bare「不會」不命中——訊噪比極差,收了整支會被當雜訊忽略', () => {
    const legit = [
      '那時**不會亮任何橫幅**',
      '「這條訂閱到底會不會開始」的倒數',
      '項目從待處理集合摘掉(所以它真的不會自己回來)',
    ].map(line);
    expect(scanClaims(legit)).toEqual([]);
  });

  it('沒有量詞的敘述不命中(否則整支變成雜訊,沒人會看)', () => {
    const clean = [
      '// 這條路徑在低機率下仍可能發生,受 lock 競爭影響',
      '// 目前已知的量測:200ms / 2.4s,沒有上界',
      'const READY_TIMEOUT_MS = 15_000;',
    ].map(line);
    expect(scanClaims(clean)).toEqual([]);
  });

  it('🔴 「只有一條／只有一個」也要命中——那是最危險的形狀,不是單純計數', () => {
    // 這條鎖的是 `CLAIM_PATTERNS` 檔頭那個設計決定:第一版寫了 `/只有(?!一)/` 想排掉
    // 「只有一個」這種計數用法,但真正的過度宣稱正是「理由只有…**這一條**」。
    // 沒有這條斷言,把負向前瞻加回去不會有任何測試轉紅(mutation 實測過)。
    for (const text of ['防跳過的機制只有一條', '只有一個入口會走到這裡']) {
      expect(scanClaims([{ file: 'x', line: 1, text }]).length, text).toBeGreaterThan(0);
    }
  });

  it('行號與檔名原樣帶出(清單要能直接跳過去改)', () => {
    const hits = scanClaims([{ file: 'pkg/a.ts', line: 42, text: '唯一的解法' }]);
    expect(hits[0]).toMatchObject({ file: 'pkg/a.ts', line: 42 });
  });

  it('🔴 注入帶 /g 的 stateful regex 不得隔行漏報(每次 exec 前 lastIndex 歸零)', () => {
    // scanClaims 是 exported API:呼叫者可注入 pattern。帶 /g 的 regex 會保留 lastIndex,
    // 上一行命中後下一行就從中間開始搜。沒有 `pattern.lastIndex = 0` 的話,第二行漏報。
    const g = [{ pattern: /always/g, why: '英文全稱' }];
    const lines = [
      { file: 'x', line: 1, text: 'always foo' },
      { file: 'x', line: 2, text: 'always bar' },
    ];
    expect(scanClaims(lines, g)).toHaveLength(2);
  });
});

describe('🔴 markdown 正規化 — 加粗的量詞照樣要抓到', () => {
  // 過度宣稱的句子偏偏最愛加粗。不正規化的話跨記號的 pattern 一條都對不到,
  // **而那正是最該抓的那幾句**。
  it('`**` 夾在量詞中間仍然命中', () => {
    expect(scanClaims([{ file: 'x', line: 1, text: '多掃**不會**誤報' }])).toHaveLength(1);
  });

  it('反引號夾在中間仍然命中', () => {
    expect(
      scanClaims([{ file: 'x', line: 1, text: '理由只有 `條件 A` 這一條' }]).length,
    ).toBeGreaterThan(0);
  });

  it('🔴 回報的 text 是**原文**不是正規化後的(不然清單對不回檔案裡的那一行)', () => {
    const raw = '本次的**全面**掃描';
    expect(scanClaims([{ file: 'x', line: 1, text: raw }])[0].text).toBe(raw);
  });

  it('normalizeForMatch 只拿掉記號、不動其他字元', () => {
    expect(normalizeForMatch('**只有**`a`~b~_c_')).toBe('只有abc');
  });
});

describe('🔴 案例鎖 — 由真實 review 案例抽象化的句型必須命中', () => {
  // 下列句型由既有 review 案例抽象化;為維持模板去識別化,不保留原始程式識別字。
  // **這份清單只准加不准減**:減了就代表某個真實案例的形狀從此漏掉。
  const REAL_OVERCLAIMS: [string, string][] = [
    ['逾時之後走**跟一般失敗完全一樣**的那套', '等同性斷言'],
    ['成立的理由只有「不在待處理清單裡」這一條。', '唯一性斷言(修法引入)'],
    ['**兩道各自都足夠**——⑴ 第一層把項目從待處理清單濾掉,', '多重充分性斷言'],
    ['本次 bug class 的**全面**掃描', '全稱斷言(實際只掃一個檔)'],
    ['repo **每一支** shell 腳本', '全稱斷言'],
    ['多掃**不會**誤報', '否定全稱(需要 markdown 正規化才抓得到)'],
    ['✅ **這不會誤傷排隊中的重試工作**', '否定全稱(被挑戰三次的那句)'],
    ['現行寫入端是單一語句,**不可能**超過寬限', '不可能性斷言(實際是低機率不是不可能)'],
    ['兩個訊號實測同時抵達,所以兩個都等的成本是**零風險**', '空集合斷言(措辭過滿)'],
  ];

  it.each(REAL_OVERCLAIMS)('「%s」要命中(%s)', (sentence) => {
    const hits = scanClaims([{ file: 'x.ts', line: 1, text: sentence }]);
    expect(hits.length, `這句沒命中＝該案例從此漏掉:${sentence}`).toBeGreaterThan(0);
  });

  it('清單不是空的(空清單 → 這支永遠說 0 處,等於沒裝)', () => {
    expect(CLAIM_PATTERNS.length).toBeGreaterThan(0);
  });
});

describe('🔴 逐 pattern 完整性鎖 — 每一條都要有「只有它抓得到」的樣本', () => {
  /**
   * 🔴 為什麼需要這一整段(否則有「保護有備援」的假綠):
   *    上面的案例鎖只證明「那幾句會被抓」,**沒證明是被哪一條 pattern 抓的**。
   *    實測:把英文那條、`/窮舉/`、`/一定會|必然會|保證/` 整條刪掉,測試**一條都不紅**
   *    ——因為樣本句同時命中別的 pattern,被別人頂著了。
   *
   * 做法:每條 pattern 配一個**只會命中它自己**的樣本(斷言 `toHaveLength(1)` ＋ 對到詞),
   *    刪掉任何一條 → 那個樣本 0 命中 → 紅。
   * ⚠️ 樣本表寫死在這裡,並鎖住與 `CLAIM_PATTERNS` 的數量相等;每個樣本還必須在整張
   *    pattern 表中恰好命中一條。樣本不依賴 pattern 的排列順序。
   *    (寫死而不從 `CLAIM_PATTERNS` 推導:推導的話刪掉一條連斷言也一起消失。)
   */
  const PER_PATTERN_SAMPLES: [sample: string, expectedWord: string][] = [
    ['這條路徑只有一個入口', '只有'],
    ['它是唯一的判別式', '唯一'],
    ['兩道防線都足以擋下', '都足以'],
    ['兩邊的行為完全相同', '完全相同'],
    ['我做了全面的核對', '全面'],
    ['這條路徑從不重試', '從不'],
    ['伺服器必然會重送一次', '必然會'],
    ['這種情況不可能出現', '不可能'],
    ['我已經窮舉過那份清單', '窮舉'],
    ['這個改動沒有任何副作用', '沒有任何'],
    ['多掃一次不會誤判', '不會誤判'],
    ['this branch always holds', 'always'],
  ];

  it('樣本數與 pattern 數相等(新增 pattern 卻沒補樣本 → 這裡轉紅)', () => {
    expect(PER_PATTERN_SAMPLES).toHaveLength(CLAIM_PATTERNS.length);
  });

  it.each(PER_PATTERN_SAMPLES)('「%s」**只**由一條 pattern 命中,且對到「%s」', (sample, word) => {
    const hits = scanClaims([{ file: 'x.ts', line: 1, text: sample }]);
    expect(hits, `樣本同時命中多條＝刪掉其中一條也不會紅(備援假綠)`).toHaveLength(1);
    expect(hits[0].matched).toBe(word);
  });
});

describe('🔴 案例鎖(續)', () => {
  it('每一條 pattern 都附了 why(清單要能自我解釋,不然沒人知道為什麼被抓)', () => {
    for (const p of CLAIM_PATTERNS) expect(p.why.length).toBeGreaterThan(5);
  });

  it('🔴 **修對之後的版本要安靜**——否則它就是「永遠紅」,跟沒裝一樣', () => {
    // 一段修對後、不再過度宣稱的文字:應該零命中。
    const fixed = [
      '//    `removeItem()` 會把項目移出 `pendingItems`',
      '//    ——目前核對的派送路徑會讀取這個集合,再把訊息送給其中的項目。',
      '//    因此這條已核對的路徑不再把訊息送給移除後的項目。',
    ].map((text) => ({ file: 'x.ts', line: 1, text }));
    expect(scanClaims(fixed)).toEqual([]);
  });
});

describe('untrackedAsAddedLines — 全新的檔整份都算新增', () => {
  it('行號從 1 起算', () => {
    const r = untrackedAsAddedLines(['new.ts'], () => 'a\nb\nc');
    expect(r).toEqual([
      { file: 'new.ts', line: 1, text: 'a' },
      { file: 'new.ts', line: 2, text: 'b' },
      { file: 'new.ts', line: 3, text: 'c' },
    ]);
  });

  it('二進位(含 NUL)跳過——不然會噴出一堆亂碼命中', () => {
    expect(untrackedAsAddedLines(['bin'], () => 'a\0b')).toEqual([]);
  });

  it('讀不到的檔跳過而不是炸掉(權限／剛被刪／非 regular file)', () => {
    expect(
      untrackedAsAddedLines(['gone'], () => {
        throw new Error('ENOENT');
      }),
    ).toEqual([]);
  });

  it('🔴 結尾換行不製造假空行(`"a\\n"` → 1 行,不是 2)', () => {
    expect(untrackedAsAddedLines(['f'], () => 'a\n')).toEqual([{ file: 'f', line: 1, text: 'a' }]);
  });

  it('空檔算 0 行(不是 1 行空字串)', () => {
    expect(untrackedAsAddedLines(['f'], () => '')).toEqual([]);
  });

  it('中間的空行保留、只砍尾端那一個(`"a\\n\\nb\\n"` → 3 行)', () => {
    expect(untrackedAsAddedLines(['f'], () => 'a\n\nb\n').map((r) => r.text)).toEqual(['a', '', 'b']);
  });
});

describe('🔴 端到端:拋棄式 repo 真跑腳本', () => {
  const tsxBin = join(repoRoot, 'node_modules/.bin/tsx');
  const scriptPath = join(repoRoot, 'scripts/check-claims.ts');

  /** 建立一個兩個 commit 的 repo,回傳 [dir, 第一個 commit 的 SHA]。第二個 commit 讓 base
   * 成為 proper ancestor,並提供非祖先側枝測試所需的父節點。 */
  function makeRepo(baseContent: string): [string, string] {
    const dir = mkdtempSync(join(tmpdir(), 'check-claims-'));
    created.push(dir);
    // `-b fixture-head`:初始分支給中性名稱,default-base 測試才能自由建 develop／main
    // 而不撞到 git init 的預設分支名(不同環境可能是 master 或 main)。
    execFileSync('git', ['init', '-q', '-b', 'fixture-head', dir], { env: GIT_ENV });
    writeFileSync(join(dir, 'f.ts'), baseContent);
    execFileSync('git', ['-C', dir, 'add', '-A'], { env: GIT_ENV });
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'base'], { env: GIT_ENV });
    const sha = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], {
      encoding: 'utf-8',
      env: GIT_ENV,
    }).trim();
    // 讓 HEAD 前進一格,base 才是 proper ancestor(⚠️ `merge-base --is-ancestor` 接受
    // 相等的 commit,所以 base === HEAD **不會**被擋;這裡前進一格是為了讓側枝測試有父節點)
    writeFileSync(join(dir, 'seed.txt'), 'seed\n');
    execFileSync('git', ['-C', dir, 'add', '-A'], { env: GIT_ENV });
    execFileSync('git', ['-C', dir, 'commit', '-q', '-m', 'seed'], { env: GIT_ENV });
    return [dir, sha];
  }

  function run(dir: string, base: string) {
    return spawnSync(tsxBin, [scriptPath, `--base=${base}`], {
      cwd: dir,
      encoding: 'utf-8',
      env: GIT_ENV,
    });
  }

  it('🔴 正對照:沒有量詞的新增內容 → exit 0 並印 ✅', () => {
    // 少了這條,「一律 exit 1」的壞掉版本照樣讓下面那條綠。
    const [dir, base] = makeRepo('// 起點\n');
    writeFileSync(join(dir, 'f.ts'), '// 起點\n// 低機率、受 lock 競爭影響\n');
    const r = run(dir, base);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toMatch(/✅ 量詞自檢/);
  });

  it('🔴 新增行含量詞 → exit 1,且輸出含檔名:行號與命中的詞', () => {
    const [dir, base] = makeRepo('// 起點\n');
    writeFileSync(join(dir, 'f.ts'), '// 起點\n// 成立的理由只有這一條\n');
    const r = run(dir, base);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('f.ts');
    expect(r.stdout).toContain(':2');
    expect(r.stdout).toContain('只有');
    // 措辭要說清楚「命中 ≠ 寫錯」,否則會被當成 CI 那種必須清零的紅
    expect(r.stdout).toMatch(/命中不代表寫錯/);
  });

  it('🔴 **只掃新增行**:既有行的量詞不報(不然第一次跑就淹掉,然後沒人再看它)', () => {
    const [dir, base] = makeRepo('// 這是唯一的解法,只有這條路\n');
    writeFileSync(join(dir, 'f.ts'), '// 這是唯一的解法,只有這條路\n// 新增一行乾淨的\n');
    const r = run(dir, base);
    expect(r.status, `既有行被算進來了:\n${r.stdout}`).toBe(0);
  });

  it('未追蹤的新檔也會被掃(新腳本的檔頭正是最會寫過頭的地方)', () => {
    const [dir, base] = makeRepo('// 起點\n');
    writeFileSync(join(dir, 'brand-new.ts'), '// 這支保證不會出錯\n');
    const r = run(dir, base);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('brand-new.ts');
  });

  it('🔴 未追蹤的**非 ASCII 檔名**也要被掃到(`ls-files` 沒帶 `-z` 就會靜默漏掉)', () => {
    // git 預設把非 ASCII 路徑輸出成含引號與八進位轉義的字串,
    // 那個字串 `readFileSync` 讀不到 → 被 catch 靜默跳過 → 整個檔完全不被掃而工具照樣回 0。
    // ⚠️ 沒有這條,把 `-z` 拿掉不會有任何測試轉紅(實測 mutation 存活)。
    const [dir, base] = makeRepo('// 起點\n');
    writeFileSync(join(dir, '說明.md'), '這個改動沒有任何副作用\n');
    const r = run(dir, base);
    expect(r.status, `非 ASCII 檔名被漏掉了:\n${r.stdout}${r.stderr}`).toBe(1);
    expect(r.stdout).toContain('說明.md');
    expect(r.stdout).toContain('沒有任何');
  });

  it('🔴🔴 被 gitignore 的檔**不得**被掃到——否則會印出命中詞與該行前 90 字摘要', () => {
    // 安全性質:`--exclude-standard` 讓「未追蹤**且被忽略**」的檔不進掃描範圍。
    // 少了它,`.env.local` 這種本機祕密檔的命中詞與內容片段可能被印進 stdout、再被貼進 PR 描述
    // (SOP 要求貼逐條處置)。**這是會外流的路徑,不只是雜訊。**
    const [dir, base] = makeRepo('// 起點\n');
    writeFileSync(join(dir, '.gitignore'), '.env.local\n');
    writeFileSync(join(dir, '.env.local'), 'SECRET=只有這一把鑰匙\n');
    const r = run(dir, base);
    // 斷言 exit 0:區分「正確排除」與「掃描剛好失敗所以沒印」——後者 stdout 也不含 SECRET,
    // 少了這條就分不出來(Codex round 1 P2)。
    expect(r.status, `stdout=${r.stdout} stderr=${r.stderr}`).toBe(0);
    expect(r.stdout, '被忽略的檔內容被印出來了').not.toContain('SECRET');
    expect(r.stdout).not.toContain('.env.local');
  });

  it('🔴🔴 未被 ignore 的 symlink 指向被 ignore 的祕密檔——不得讀穿(lstat 只收 regular file)', () => {
    // 安全性質(Codex round 1 P1):`--exclude-standard` 只排除「路徑本身被 ignore」的檔。
    // 一條**未被 ignore** 的 symlink `notes.txt -> .env.local` 會被 `ls-files` 列出,
    // 而 `readFileSync` 會跟隨 symlink 讀出祕密內容。用 `lstat` 只收 regular file 才堵得住。
    // SECRET 值刻意含量詞「只有」——沒堵住的話它會命中並被印出。
    const [dir, base] = makeRepo('// 起點\n');
    writeFileSync(join(dir, '.gitignore'), '.env.local\n');
    writeFileSync(join(dir, '.env.local'), 'SECRET=只有這一把鑰匙\n');
    symlinkSync('.env.local', join(dir, 'notes.txt')); // notes.txt 本身未被 ignore
    const r = run(dir, base);
    expect(r.status, `stdout=${r.stdout} stderr=${r.stderr}`).toBe(0);
    expect(r.stdout, 'symlink 讀穿了被 ignore 的祕密').not.toContain('SECRET');
    expect(r.stdout).not.toContain('只有這一把鑰匙');
  });

  it('🔴🔴 未被 ignore 的 hard link 指向被 ignore 的祕密檔——不得讀穿(fstat nlink>1 拒絕)', () => {
    // 與 symlink 同型的**無競態**繞道(Codex round 2 P1):hard link 是 regular file,
    // `isFile()` 會放行,只有 `nlink > 1` 這條擋得住。`ls-files --exclude-standard` 會列出
    // 未被 ignore 的 `notes.txt`(它是 `.env.local` 的 hard link),讀它就讀到祕密內容。
    const [dir, base] = makeRepo('// 起點\n');
    writeFileSync(join(dir, '.gitignore'), '.env.local\n');
    writeFileSync(join(dir, '.env.local'), 'SECRET=只有這一把鑰匙\n');
    linkSync(join(dir, '.env.local'), join(dir, 'notes.txt')); // hard link,notes.txt 未被 ignore
    const r = run(dir, base);
    expect(r.status, `stdout=${r.stdout} stderr=${r.stderr}`).toBe(0);
    expect(r.stdout, 'hard link 讀穿了被 ignore 的祕密').not.toContain('SECRET');
    expect(r.stdout).not.toContain('只有這一把鑰匙');
  });

  it('🔴 預設 base:develop 與 main 都在時取 develop(對齊 check-cso-trigger)', () => {
    // 這一刀刻意把來源的 resolveDefaultBase 改成 develop→main;所有其他 E2E 都顯式傳
    // --base,這條專門守「不傳時的預設解析」,否則優先序被誤改也全綠。
    const [dir, base] = makeRepo('// 起點\n');
    const g = (...a: string[]) =>
      execFileSync('git', ['-C', dir, ...a], { env: GIT_ENV, encoding: 'utf-8' });
    g('branch', 'develop', base);
    g('branch', 'main', base);
    const r = spawnSync(tsxBin, [scriptPath], { cwd: dir, encoding: 'utf-8', env: GIT_ENV });
    // 驗 exit 0:選對 base 卻在之後 exit 2(例如印「base=develop 不是祖先」)時,只比字串仍會綠。
    expect(r.status, `stdout=${r.stdout} stderr=${r.stderr}`).toBe(0);
    expect(r.stdout + r.stderr, `status=${r.status}`).toMatch(/base=develop/);
  });

  it('🔴 預設 base:只有 main 時退回 main', () => {
    const [dir, base] = makeRepo('// 起點\n');
    const g = (...a: string[]) =>
      execFileSync('git', ['-C', dir, ...a], { env: GIT_ENV, encoding: 'utf-8' });
    g('branch', 'main', base); // 只建 main、不建 develop
    const r = spawnSync(tsxBin, [scriptPath], { cwd: dir, encoding: 'utf-8', env: GIT_ENV });
    expect(r.status, `stdout=${r.stdout} stderr=${r.stderr}`).toBe(0);
    expect(r.stdout + r.stderr, `status=${r.status}`).toMatch(/base=main/);
  });

  it('🔴 非法 base → exit 2(無法判定,不是 0 也不是 1)', () => {
    const [dir] = makeRepo('// 起點\n');
    const r = run(dir, '--sneaky');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/非法 base/);
  });

  it('🔴 base 不是 HEAD 的祖先 → exit 2(diff 會失真)', () => {
    // ⚠️ **base 必須是「同一個 repo 裡真的存在、但不在 HEAD 祖先鏈上」的 commit**
    //    ——「錯得不對也算通過」:若用**另一個 repo** 的 sha,那個物件本機根本解不到 →
    //    `git diff` 自己就炸了 → 拿掉祖先檢查照樣 exit 2,mutation 實測存活。
    //    改成側枝之後,少了那道檢查就會 exit 0/1 而不是 2。
    const [dir] = makeRepo('// 起點\n');
    const g = (...a: string[]) =>
      execFileSync('git', ['-C', dir, ...a], { env: GIT_ENV, encoding: 'utf-8' });
    const mainRef = g('rev-parse', 'HEAD').trim();
    g('checkout', '-q', '-b', 'sidebranch', `${mainRef}~1`);
    writeFileSync(join(dir, 'side.txt'), 'side\n');
    g('add', '-A');
    g('commit', '-q', '-m', 'side');
    const sideSha = g('rev-parse', 'HEAD').trim();
    g('checkout', '-q', '-'); // 回到原本那條,sideSha 就成了「存在但不是祖先」
    const r = run(dir, sideSha);
    expect(r.status, `stdout=${r.stdout} stderr=${r.stderr}`).toBe(2);
    expect(r.stderr).toMatch(/不是 HEAD 的祖先/);
  });
});
