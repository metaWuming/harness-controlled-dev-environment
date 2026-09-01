// @vitest-environment node
// Tests for scripts/check-doc-refs.ts(doc-ref checker)
//
// 驗 pure functions:
//   - extractRefs:@import / markdown link / 純路徑;跳過 fenced code / 外部 / 路由 / 佔位符
//   - checkRefs:doc-dir vs repo-root 解析、../ 逃出 repo 跳過、gitignored / planned 跳過、缺檔報 violation

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractRefs, checkRefs, type Ref } from '../scripts/check-doc-refs';
import {
  extractPrRefsFromLine,
  FULL_EXCLUDES,
  stripExcludeMagic,
} from '../scripts/check-no-source-terms';

describe('extractRefs', () => {
  it('@import 整行', () => {
    expect(extractRefs('@AGENTS.md\n@GUIDE.md')).toEqual([
      { type: 'import', rawPath: 'AGENTS.md', line: 1 },
      { type: 'import', rawPath: 'GUIDE.md', line: 2 },
    ]);
  });

  it('markdown 本地連結(有副檔名)→ 去 anchor', () => {
    const refs = extractRefs('see [x](docs/SECURITY.md#sec-3) and [y](TODOS.md)');
    expect(refs).toEqual([
      { type: 'link', rawPath: 'docs/SECURITY.md', line: 1 },
      { type: 'link', rawPath: 'TODOS.md', line: 1 },
    ]);
  });

  it('跳過外部連結 / 絕對路由 / 純 anchor / 無副檔名', () => {
    const refs = extractRefs('[a](https://x.com) [b](/privacy) [c](#anchor) [d](mailto:x@y.z) [e](../foo)');
    expect(refs).toEqual([]);
  });

  it('純文字路徑提及', () => {
    const refs = extractRefs('see scripts/check-doc-refs.ts and tests/sample.test.ts here');
    expect(refs).toEqual([
      { type: 'plain', rawPath: 'scripts/check-doc-refs.ts', line: 1 },
      { type: 'plain', rawPath: 'tests/sample.test.ts', line: 1 },
    ]);
  });

  it('.tsx 純路徑不被截斷成 .ts(副檔名 alternation longest-match-first)', () => {
    // regression:`ts` 若排在 `tsx` 前會把 foo.tsx 截成 foo.ts → 對真實 .tsx 檔假陽性
    const refs = extractRefs('see stack/nextjs-prisma/components/widget.tsx and docs/example.tsx');
    expect(refs).toEqual([
      { type: 'plain', rawPath: 'stack/nextjs-prisma/components/widget.tsx', line: 1 },
      { type: 'plain', rawPath: 'docs/example.tsx', line: 1 },
    ]);
  });

  it('動態 segment `[foo]` 不被截斷(Next.js / SvelteKit / Astro 動態路由通用)', () => {
    // regression:字元類不含 `[` `]` 會在 `[` 處斷、抽出半截路徑或漏驗整條
    const refs = extractRefs('see stack/nextjs-prisma/app/[token]/page.tsx and docs/[locale]/README.md');
    expect(refs).toEqual([
      { type: 'plain', rawPath: 'stack/nextjs-prisma/app/[token]/page.tsx', line: 1 },
      { type: 'plain', rawPath: 'docs/[locale]/README.md', line: 1 },
    ]);
  });

  it('glob `**/pattern` 的後半截不被誤收(兩層守門:字元類無 `*` + prev-char 檢查)', () => {
    // regression:SOP 的清單常寫 `**/tests/*.test.ts` 這類 glob。兩層守門:
    //   (a) PLAIN_PATH_RE 字元類不含 `*` → 含 `*` 的 pattern(如 `**/tests/*.test.ts`)
    //       整條 match 不到、根本不會被考慮
    //   (b) prev-char 守門 → 對 `**/scripts/foo.ts` 這種只有前置斜線的 glob(不含尾段
    //       `*`)、regex 從 `scripts/` 起匹配,把 `**/` 留在外面 → prev 是 `/` skip
    // 本 case 兩半各自驗一種:第一半靠 (a)、第二半靠 (b)。若未來為支援 glob 把 `*`
    // 加進字元類且拿掉 prev-char 檢查、第二半會轉紅、抓到 regression。
    const refs = extractRefs('清單:`**/tests/*.test.ts`、`**/scripts/foo.ts`');
    expect(refs).toEqual([]);
  });

  it('`./` 前綴的相對路徑要被抽出(Codex R1 F1 regression)', () => {
    // regression:前字元檢查會把 `.`/`/` 當「更長 token 的一部分」而 skip,
    // 讓 `./scripts/foo.ts` 這種常見寫法逃過驗證 = fail-open。修法:PLAIN_PATH_RE
    // 前綴加 `(?:\.\/)?`,rawPath 保留 `./`(path.posix.normalize 後續會消掉)。
    const refs = extractRefs('see ./scripts/definitely-missing.ts and ./docs/x.md');
    expect(refs).toEqual([
      { type: 'plain', rawPath: './scripts/definitely-missing.ts', line: 1 },
      { type: 'plain', rawPath: './docs/x.md', line: 1 },
    ]);
  });

  it('跳過 fenced code block 內容', () => {
    const content = '```\nscripts/in-fence.ts\n```\nscripts/out.ts';
    expect(extractRefs(content)).toEqual([{ type: 'plain', rawPath: 'scripts/out.ts', line: 4 }]);
  });

  it('混用 ``` 與 ~~~ 的 fence 不洩漏(同款 marker 才能關)', () => {
    // ~~~ 開 fence,內層 ``` 是內容不該關它 → 中間路徑仍被跳過(只有同款 ~~~ 能關)
    const content = '~~~\ncode\n```\nscripts/leaked.ts\n~~~\nscripts/real.ts';
    expect(extractRefs(content)).toEqual([{ type: 'plain', rawPath: 'scripts/real.ts', line: 6 }]);
  });

  it('跳過佔位符(scripts/xxx.ts / 角括號 / 省略號)', () => {
    expect(extractRefs('scripts/xxx.ts 與 [a](docs/<name>.ts) 與 docs/a...md')).toEqual([]);
  });

  it('md-link 與純路徑指向同一目標 → 不重複', () => {
    expect(extractRefs('[x](docs/a.md) 又提一次 docs/a.md')).toEqual([
      { type: 'link', rawPath: 'docs/a.md', line: 1 },
    ]);
  });
});

describe('checkRefs', () => {
  const existsIn = (set: Set<string>) => (p: string) => set.has(p);

  it('import 相對 doc 目錄存在 → 無 violation', () => {
    const refs: Ref[] = [{ type: 'import', rawPath: 'AGENTS.md', line: 1 }];
    expect(checkRefs(refs, 'CLAUDE.md', existsIn(new Set(['AGENTS.md'])))).toEqual([]);
  });

  it('link 缺檔 → violation', () => {
    const refs: Ref[] = [{ type: 'link', rawPath: 'docs/gone.md', line: 5 }];
    expect(checkRefs(refs, 'TODOS.md', existsIn(new Set()))).toEqual([
      { doc: 'TODOS.md', line: 5, type: 'link', rawPath: 'docs/gone.md' },
    ]);
  });

  it('link 寫 repo-root-relative(從 .claude/memory)→ 存在不報', () => {
    const refs: Ref[] = [{ type: 'link', rawPath: 'scripts/check-doc-refs.ts', line: 1 }];
    expect(
      checkRefs(refs, '.claude/memory/LESSONS.md', existsIn(new Set(['scripts/check-doc-refs.ts'])))
    ).toEqual([]);
  });

  it('link 寫 doc-dir-relative(從 docs/)→ 存在不報', () => {
    const refs: Ref[] = [{ type: 'link', rawPath: 'ADOPTION.md', line: 1 }];
    expect(checkRefs(refs, 'docs/README.md', existsIn(new Set(['docs/ADOPTION.md'])))).toEqual([]);
  });

  it('plain:doc 目錄 或 repo root 擇一存在即可', () => {
    const refs: Ref[] = [{ type: 'plain', rawPath: 'docs/x.md', line: 1 }];
    expect(checkRefs(refs, 'TODOS.md', existsIn(new Set(['docs/x.md'])))).toEqual([]);
  });

  it('../ 逃出 repo root → 跳過(非 violation)', () => {
    const refs: Ref[] = [{ type: 'link', rawPath: '../outside.html', line: 1 }];
    expect(checkRefs(refs, 'CLAUDE.md', existsIn(new Set()))).toEqual([]);
  });

  it('gitignored 路徑(.env* / settings.local.json)→ 跳過,避免硬 gate 在 CI 假陽性', () => {
    // regression:本機有、CI checkout 無的 gitignored 檔(CLAUDE.md 禁區清單會提到)
    const refs: Ref[] = [{ type: 'plain', rawPath: '.claude/settings.local.json', line: 264 }];
    const isIgnored = (p: string) => p === '.claude/settings.local.json';
    // 即使 fileExists 回 false(模擬 CI),isIgnored 命中 → 不報 violation
    expect(checkRefs(refs, 'CLAUDE.md', existsIn(new Set()), isIgnored)).toEqual([]);
    // 預設 isIgnored(不傳)→ 仍會報(確認跳過是 isIgnored 造成,非預設行為)
    expect(checkRefs(refs, 'CLAUDE.md', existsIn(new Set()))).toEqual([
      { doc: 'CLAUDE.md', line: 264, type: 'plain', rawPath: '.claude/settings.local.json' },
    ]);
  });

  it('planned 路徑(模板尚在建置的檔)→ 跳過;檔案存在後 isPlanned 不再命中則正常驗', () => {
    const refs: Ref[] = [{ type: 'link', rawPath: 'docs/ADOPTION.md', line: 7 }];
    const isPlanned = (p: string) => p === 'docs/ADOPTION.md';
    // 檔案不存在 + planned 命中 → 不報
    expect(checkRefs(refs, 'README.md', existsIn(new Set()), () => false, isPlanned)).toEqual([]);
    // 預設 isPlanned(不傳)→ 仍會報(確認跳過是 isPlanned 造成,非預設行為)
    expect(checkRefs(refs, 'README.md', existsIn(new Set()))).toEqual([
      { doc: 'README.md', line: 7, type: 'link', rawPath: 'docs/ADOPTION.md' },
    ]);
  });
});

// ══════════ PR A1.1 F2:canonical ADR 引用治理(位置 + 數量型守門) ══════════
//
// 為什麼放這裡:這是 **doc reference governance**,不是 source-term 掃描行為。
// `tests/check-no-source-terms.test.ts` 只留掃描行為與效能 / mutation 契約。
//
// ⚠️ 字面拆碎(`EXT_PLAN_*`):本檔要斷言「repo 內已無外部私人 plan 的檔名引用」,
//    若把該檔名整串寫進 source,這個測試自己就會變成一個 hit(自我命中),
//    只能靠豁免清單繞開 —— 那正是要禁止的做法。改用執行期 concat。
//    **本測試不使用任何全域 value allowlist 自我豁免。**

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf-8',
}).trim();

/**
 * canonical ADR 的 repo-relative 路徑。
 * ⚠️ 同樣拆碎:整串寫進 source 會讓本檔自己變成第 6 個引用點,
 *    G2 的數量斷言就得靠自我豁免才能過 —— 那正是要禁止的做法。
 */
const ADR_PATH = 'docs/architecture/' + 'source-term-history-baseline.md';

/** 外部私人規劃文件的檔名 / 路徑片段(拆碎,避免自我命中)。 */
const EXT_PLAN_FILE = 'HARNESS_' + 'OPTIMIZATION_' + 'IMPLEMENTATION_' + 'PLAN.md';
const EXT_PLAN_DIR = 'Documents' + '/Codex';

/**
 * canonical 引用的**預期位置與數量**。
 * 改動 = 有意識的治理決定,必須同步改這張表(這正是位置+數量型守門的用意)。
 */
const EXPECTED_ADR_REFS: Array<[string, number]> = [
  ['.github/workflows/ci.yml', 2],
  ['scripts/source-term-baseline.json', 1],
  ['tests/check-no-source-terms.test.ts', 1],
  ['.claude/memory/progress.md', 1],
  // progress 歸檔是唯讀歷史 snapshot;被搬走的 sprint entry 連同它的引用一起進來。
  // 這一筆是 archive 動作造成的、有意識登錄的位置(G2 原本就擋下了這個搬移)。
  ['.claude/memory/progress-archive/progress-2026-08.md', 1],
];
const EXPECTED_ADR_REF_TOTAL = 6;

function trackedFiles(): string[] {
  return execFileSync('git', ['-C', REPO, 'ls-files', '-z'], { encoding: 'utf-8' })
    .split('\0')
    .filter(Boolean);
}

function readTracked(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf-8');
}

/** 掃全部 tracked 檔的文字內容,回傳 `rel -> 命中次數`(跳過讀不到的二進位檔)。 */
function countInTracked(needle: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const rel of trackedFiles()) {
    let text: string;
    try {
      text = readTracked(rel);
    } catch {
      continue;
    }
    let n = 0;
    let i = text.indexOf(needle);
    while (i !== -1) {
      n++;
      i = text.indexOf(needle, i + needle.length);
    }
    if (n > 0) out.set(rel, n);
  }
  return out;
}

/** 抽 ADR 的 H2 標題(引用要指到穩定標題,不是章節編號)。 */
function adrHeadings(): string[] {
  return readTracked(ADR_PATH)
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => l.slice(3).trim());
}

describe('PR A1.1 F2 — canonical ADR 引用治理', () => {
  it('🔴 G1:canonical ADR 存在且被 git 追蹤', () => {
    expect(fs.existsSync(path.join(REPO, ADR_PATH))).toBe(true);
    expect(trackedFiles()).toContain(ADR_PATH);
    // 必要段落齊備(F2 要求的治理內容)
    const h = adrHeadings();
    for (const need of [
      '決策',
      '政策邊界:source-term 掃描 vs gitleaks 秘密掃描',
      '掃描範圍與三種 repo 情境',
      'baseline 變更授權',
      '導入步驟(下游採用者)',
      '效能與 scale 契約',
      '已知限制',
      'Provenance',
    ]) {
      expect(h, `ADR 缺必要段落「${need}」`).toContain(need);
    }
  });

  it('🔴 G1b:ADR 記錄 provenance(PR 引用 + 首次 baseline SHA)', () => {
    const text = readTracked(ADR_PATH);
    // ⚠️ 刻意**不要求**裸的「PR 井號+數字」字面:那是 CA pattern,而 working tree
    //    掃描不受 baseline 影響 → 下游採用者開箱即被自己的 ADR 擋紅(Step 5 CRITICAL)。
    //    provenance 改以 repo 既有的「井號」寫法記錄。
    expect(text).toMatch(/井號\+\d+/);
    expect(text).toContain('641065227924184b058b3f64c1c9f9971a3a17b4');
  });

  it('🔴 G2:canonical 引用的位置與數量固定,且每處都指到穩定標題', () => {
    const hits = countInTracked(ADR_PATH);
    // 位置 + 數量
    for (const [rel, n] of EXPECTED_ADR_REFS) {
      expect(hits.get(rel) ?? 0, `${rel} 的 ADR 引用數`).toBe(n);
    }
    const total = [...hits.values()].reduce((a, b) => a + b, 0);
    expect(total, 'ADR 引用總數(新增引用要同步更新 EXPECTED_ADR_REFS)').toBe(
      EXPECTED_ADR_REF_TOTAL
    );
    expect([...hits.keys()].sort()).toEqual(
      EXPECTED_ADR_REFS.map(([r]) => r).sort()
    );

    // 每一處引用附近(同行或前後 2 行)要出現 ADR 的某個穩定 H2 標題,
    // 而不是只丟一個裸路徑。標題可能因換行落在鄰行,故取視窗。
    //
    // 🔴 Step 5 INFORMATIONAL:錨點必須帶「」括號。ADR 的 H2 之一是**兩個字**的
    //    「決策」,中文散文裡「治理決策」「拍板決策」隨處可見——只比對裸標題時,
    //    引用就算改成裸路徑、指錯章節,只要鄰近句子含那兩個字仍會通過,契約
    //    讀起來比它實際守的強得多。六處引用本來就都寫成「<標題>」,所以連括號
    //    一起比對不放寬任何既有寫法,只是把漏洞關掉。
    const headings = adrHeadings();
    for (const [rel] of EXPECTED_ADR_REFS) {
      const lines = readTracked(rel).split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i]!.includes(ADR_PATH)) continue;
        const win = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
        expect(
          headings.some((h) => win.includes(`\u300c${h}\u300d`)),
          `${rel}:${i + 1} 的 ADR 引用未以「<穩定標題>」形式指到章節`
        ).toBe(true);
      }
    }
  });

  it('🔴 G3:tracked files 已無外部私人 plan 的檔名 / 路徑引用(0 hit)', () => {
    expect([...countInTracked(EXT_PLAN_FILE).keys()]).toEqual([]);
    expect([...countInTracked(EXT_PLAN_DIR).keys()]).toEqual([]);
  });

  it('🔴 G4:progress.md 不含個人絕對路徑(0 hit)', () => {
    const text = readTracked('.claude/memory/progress.md');
    expect(text).not.toContain('/Users/');
    expect(text).not.toContain('~/Documents');
  });

  it('🔴 G6:tracked 內容不得含任何 PR/pull 引用(下游可攜性)', () => {
    // 🔴 Step 5 CRITICAL。CA(context-aware)判定靠 allowedPrs 放行,而 allowedPrs
    //    是**本 repo 的** squash subject 推出來的。任何寫進 tracked 檔的 PR 引用,
    //    在本 repo 綠、到下游(全新 history、allowedPrs 不含該號)就紅——而且
    //    **working tree 掃描不受 baseline 影響**,template-fallback 也救不了,
    //    等於每個採用者開箱即被模板自己的檔擋住。
    //    所以這裡不是「本 repo 掃得過就好」,而是**數量必須為 0**。
    //    要寫 PR 號請用 repo 既有的「井號」寫法或「(井號+N)」括號格式。
    const ex = new Set(FULL_EXCLUDES.map(stripExcludeMagic));
    const offenders: string[] = [];
    for (const rel of trackedFiles()) {
      if (ex.has(rel)) continue;
      let text: string;
      try {
        text = readTracked(rel);
      } catch {
        continue;
      }
      text.split('\n').forEach((line, i) => {
        if (extractPrRefsFromLine(line).length > 0) {
          offenders.push(`${rel}:${i + 1}`);
        }
      });
    }
    expect(offenders, 'tracked 內容含 PR 引用 → 下游開箱會被自己的檔擋紅').toEqual([]);
  });

  it('🔴 G5:docs/architecture 已納入 doc-ref 掃描範圍,且 checker 對本 repo 綠', () => {
    const src = readTracked('scripts/check-doc-refs.ts');
    expect(src).toContain("'docs/architecture'");
    const r = execFileSync(
      path.join(REPO, 'node_modules/.bin/tsx'),
      [path.join(REPO, 'scripts/check-doc-refs.ts')],
      { cwd: REPO, encoding: 'utf-8' }
    );
    // 🔴 Step 5 INFORMATIONAL:原本是 toContain('0') —— '0' 在「掃 20 份」「共驗
    //    268 個」裡都命中,無論結果如何都會過,等於空斷言。改斷言那句結論全文。
    expect(r).toContain('0 個失效引用');
  });
});
