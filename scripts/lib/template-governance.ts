// scripts/lib/template-governance.ts
//
// **模板作者自己的簿記檢查**(PR A2 從 tests/check-doc-refs.test.ts 的 G2 / G4 搬來)。
//
// 為什麼搬:這兩條是「本模板出貨前」的自我檢查,原本放在 vitest 裡會隨模板複製、
// 由採用者的 `npm test` 執行 —— 採用者改寫自己的 progress、或在 macOS 寫自己的路徑
// 就紅,而 checker 是綠的(A1.1 Step 5 r2 I4 / r3 C2)。現在由
// `scripts/check-adoption-readiness.ts` 只在 `mode === "template"`(顯式宣告)時執行
// (T8 / T9);adopted repo 不會跑到。
//
// 純函式 + 注入 I/O;不碰 git、不碰 fs。

export interface GovernanceIo {
  /** repo 內 tracked 檔清單(repo-relative)。 */
  trackedFiles(): string[];
  /** 讀 repo-relative 文字檔;讀不到回 null。 */
  readText(rel: string): string | null;
}

/**
 * canonical ADR 的 repo-relative 路徑。
 * ⚠️ 拆碎:整串寫進本檔,本檔(tracked)就會變成一個引用點,T9 的數量斷言只能靠
 *    自我豁免才過 —— 那正是要禁止的做法。
 */
export const ADR_PATH = 'docs/architecture/' + 'source-term-history-baseline.md';

/**
 * canonical 引用的**預期位置與數量**(位置＋數量型守門)。
 * 改動 = 有意識的治理決定,必須同步改這張表。
 */
export const EXPECTED_ADR_REFS: ReadonlyArray<readonly [string, number]> = [
  ['.github/workflows/ci.yml', 2],
  ['scripts/source-term-baseline.json', 1],
  ['tests/check-no-source-terms.test.ts', 1],
  // progress 歸檔是唯讀歷史 snapshot;被搬走的 sprint entry 連同它的引用一起進來。
  // PR A3 Phase 0:A1.1 entry(含 1 處引用)從 progress.md 搬到 progress-2026-09.md,
  // 主檔現無引用。之後的 sprint entry 不得再引用 ADR 路徑(否則要回來改這張表)。
  ['.claude/memory/progress-archive/progress-2026-08.md', 1],
  ['.claude/memory/progress-archive/progress-2026-09.md', 1],
  // PR A3:control catalog 把 ADR 登錄為人工控制(CTRL-GOV-002)的實作路徑;JSON 正本與
  // 渲染檔各 1 處(渲染檔的引用數必然等於 JSON 的引用數,渲染器不增刪路徑)。
  // CTRL-GOV-002(baseline 變更授權)與 CTRL-GOV-003(長命分支清理程序)各 1 處。
  ['scripts/control-catalog.json', 2],
  ['docs/CONTROL-CATALOG.md', 2],
];
export const EXPECTED_ADR_REF_TOTAL = 10;

/** 原 G4:progress.md 不得含個人絕對路徑。回傳違規描述清單(空 = 通過)。 */
export function checkNoPersonalPaths(text: string): string[] {
  const out: string[] = [];
  for (const needle of ['/Users/', '~/Documents']) {
    if (text.includes(needle)) out.push(`含個人絕對路徑片段 ${JSON.stringify(needle)}`);
  }
  return out;
}

function countIn(text: string, needle: string): number {
  let n = 0;
  let i = text.indexOf(needle);
  while (i !== -1) {
    n++;
    i = text.indexOf(needle, i + needle.length);
  }
  return n;
}

/**
 * 原 G2:canonical ADR 引用的位置與數量固定,且每處引用附近(同行或前後 2 行)
 * 都以「<穩定 H2 標題>」形式指到章節(帶「」括號,避免兩字標題「決策」被散文誤中)。
 * 回傳違規描述清單(空 = 通過)。
 */
export function checkAdrRefPlacement(io: GovernanceIo): string[] {
  const out: string[] = [];
  const adr = io.readText(ADR_PATH);
  if (adr === null) return [`${ADR_PATH} 讀不到`];
  const headings = adr
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => l.slice(3).trim());

  const hits = new Map<string, number>();
  for (const rel of io.trackedFiles()) {
    const text = io.readText(rel);
    if (text === null) continue;
    const n = countIn(text, ADR_PATH);
    if (n > 0) hits.set(rel, n);
  }
  for (const [rel, n] of EXPECTED_ADR_REFS) {
    const got = hits.get(rel) ?? 0;
    if (got !== n) out.push(`${rel} 的 ADR 引用數 ${got} ≠ 預期 ${n}`);
  }
  const total = [...hits.values()].reduce((a, b) => a + b, 0);
  if (total !== EXPECTED_ADR_REF_TOTAL) {
    out.push(`ADR 引用總數 ${total} ≠ 預期 ${EXPECTED_ADR_REF_TOTAL}(新增引用要同步更新 EXPECTED_ADR_REFS)`);
  }
  const expectedFiles = EXPECTED_ADR_REFS.map(([r]) => r).sort();
  const gotFiles = [...hits.keys()].sort();
  if (JSON.stringify(expectedFiles) !== JSON.stringify(gotFiles)) {
    out.push(`ADR 引用出現的檔案集合 ${JSON.stringify(gotFiles)} ≠ 預期 ${JSON.stringify(expectedFiles)}`);
  }
  for (const [rel] of EXPECTED_ADR_REFS) {
    const text = io.readText(rel);
    if (text === null) continue;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i]!.includes(ADR_PATH)) continue;
      const win = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
      if (!headings.some((h) => win.includes(`「${h}」`))) {
        out.push(`${rel}:${i + 1} 的 ADR 引用未以「<穩定標題>」形式指到章節`);
      }
    }
  }
  return out;
}
