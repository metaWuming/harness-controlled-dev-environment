// scripts/check-doc-refs.ts
//
// Harness 一致性維護 — 跨 harness 文件「檔案引用」失效自動偵測。
//
// 掃 harness 文件清單,抽出三類「指向檔案」的引用,驗證被引用的檔案是否存在:
//   1. frontmatter `@FILENAME` import(CLAUDE.md 頂部,整行 `@path`)— 相對該檔目錄
//   2. markdown 本地連結 `[text](path)` — 相對該檔目錄(只驗有檔案副檔名者;
//      跳過 http(s):// / mailto / 純 #anchor / `/route` 絕對路由)
//   3. 純文字路徑提及 `(docs|scripts|tests|stack|.claude|.github)/...副檔名`
//      — repo root 或該檔目錄擇一存在即可(best-effort,降低誤判)
//
// 設計界線:
//   - 只驗「檔案是否存在」。**不驗** #anchor / §x.y 章節錨點(語意層 → 留人工季 retro)
//   - 跳過 fenced code block(``` / ~~~)內容,避免範例 code 誤報
//   - 跳過解析後落在 repo root 之外(`../`)的引用 — 無法可靠驗證
//   - 跳過 gitignored 路徑(`.env*` / `.claude/settings.local.json` 等)— 本機有、CI checkout 無,
//     刻意不進版控,不在「repo 檔是否存在」驗證範圍(否則硬 gate 在 CI 必假陽性)
//   - 跳過 PLANNED_PATHS 清單內、尚未建立的模板檔(見下方註解)
//   - **前瞻文件 vs 歷史敘事的分離**(採用者的紀律建議):
//     - **前瞻文件要掃**:TODOS / PLAN / spec 這類「說接下來要做什麼」的清單,
//       路徑爛掉會誤導下一棒 → 硬 gate
//     - **歷史敘事不該掃**:progress log / LESSONS / retro 這類「說過去發生什麼」
//       的紀錄,會(正當地)提到「當時存在、後來被刪」的檔案 → 硬 gate 掃它們
//       等於逼人改寫歷史。
//     ⚠️ **本模板目前的實作仍會遞迴掃 `.claude/memory`**(見下方 `SCAN_DIRS_RECURSIVE`),
//     所以 `.claude/memory/progress.md` / `LESSONS.md` / `progress-archive/` /
//     `LESSONS-archive/` 都會被掃。採用此分離策略時,須先調整 `SCAN_DIRS_RECURSIVE`
//     或 `collectDocFiles()` 排除歷史檔。這條紀律是**採用者要落實的**,不是模板現況。
//   - 只讀 `.md`。`docs/*.html` runbook 內的路徑引用**不在覆蓋範圍**(要解析 HTML
//     才做得到),這是誠實的缺口、不是漏做
//
// 找到失效引用 → exit 1,印 file:line + type + 缺失路徑。CI gate。
//
// ⚠️ 已知 false-positive 面 + escape hatch:
//   本 checker 連「純文字路徑提及(plain)」也驗 → 在 harness 文件**散文裡**提到一個
//   *尚未建立 / 計畫中 / 已改名* 的真實路徑(如「未來會加 `scripts/foo.ts`」),會被當失效引用
//   擋 CI。要寫這類「計畫中 / 範例」路徑,用下列任一 escape hatch 避開:
//     1. placeholder 形式:路徑含 `xxx` / `<...>` / `{...}` / `...`(isPlaceholder 跳過)
//     2. 裸檔名(不帶頂層目錄前綴):寫 `foo.ts` 而非 `scripts/foo.ts`(PLAIN_PATH_RE 需前綴)
//     3. 放進 fenced code block(``` / ~~~)— 整塊跳過
//   注意:**4-space 縮排 code block(CommonMark indented code)目前不跳過**,只跳 fenced;
//   範例路徑請用 fenced block 包,別用縮排 code。
//
// 設計原則(pure function 易測):
//   - extractRefs(content):純解析 → Ref[]
//   - checkRefs(refs, docRelPath, fileExists):純驗證(fileExists 注入)→ Violation[]
//   - main():file IO + 編排
//
// Usage:
//   npx tsx scripts/check-doc-refs.ts
//
// CI:
//   .github/workflows/ci.yml 加 step「Doc Refs Check」

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// CWD-independent root resolution(git 不可用時退回本檔位置的上一層)
const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  }
})();

// 要掃的 harness 文件:固定 root 檔 + 掃描目錄。ROOT_DOCS 缺檔會被 main() 明報
// (改名/刪除要同步從清單移除、不允許靜默略過)。採用者可自行 append(如 AGENTS.md、
// DESIGN.md、PROJECT_VISION.md 等專案專屬治理文件)。
const ROOT_DOCS = ['CLAUDE.md', 'README.md', 'TODOS.md'];
// 非遞迴掃描目錄(目錄下 *.md)
const SCAN_DIRS = ['docs', '.claude/sop'];
// 遞迴掃描目錄(目錄下 **/*.md;記憶層含 archive 子目錄)
const SCAN_DIRS_RECURSIVE = ['.claude/memory'];

// ⚠️ 模板尚在建置的檔案(文件已預先引用、檔案之後才會落地)。
// 這些路徑「檔案不存在」時跳過驗證、**檔案建立後自動開始驗證**。
// 對應檔案 land 之後,請把該條從清單移除(避免清單腐爛成永久豁免)。
const PLANNED_PATHS = new Set([
  'docs/ADOPTION.md',
  'docs/DEGRADATION.md',
  'docs/PLUGIN_EVALUATION.md',
  'stack/nextjs-prisma/README.md',
  'stack/nextjs-prisma/scripts/check-prisma-schema-refs.ts',
  '.github/workflows/ci.yml',
]);

// 有檔案副檔名的 link 才驗(route 連結 / 外部連結沒副檔名 → 跳過,杜絕誤判)
const FILE_EXT_RE = /\.(md|markdown|ts|tsx|mjs|cjs|js|jsx|prisma|sh|json|ya?ml|html|css|txt)$/i;
// 純文字路徑提及(限定 repo 內常見頂層目錄 + 檔案副檔名)
// ⚠️ 副檔名 alternation 必須「長的排前面」(tsx 在 ts 前):regex 是最先匹配優先,
//    若 `ts` 排在 `tsx` 前,`foo.tsx` 會被截成 `foo.ts`(吃掉 ts、剩 x)→ 對真實 .tsx
//    檔產生假陽性。見 tests/check-doc-refs.test.ts「.tsx 純路徑不被截斷」。
// 字元類含 `[` `]`:路徑段內的字元類(`[foo]`)—— Next.js App Router / SvelteKit /
//    Astro 動態 segment 都用同一形狀(如 `stack/nextjs-prisma/app/[token]/page.tsx`)。
//    不含中括號就會在 `[` 斷掉、抽出半截路徑或整條漏驗。規則本身通用、不假設特定框架;
//    採用者若不用動態 segment 也不會誤觸(`[` 不會出現在一般路徑就不影響)。
const PLAIN_PATH_RE =
  /(?:docs|scripts|tests|stack|\.claude|\.github)\/[A-Za-z0-9._/[\]-]+\.(?:md|tsx|ts|mjs|prisma|sh|json|ya?ml)/g;
const MD_LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;
const IMPORT_RE = /^@([A-Za-z0-9._/-]+\.[A-Za-z0-9]+)\s*$/;

// 佔位符 / 範例路徑(prose 內 `scripts/xxx.ts`、含角括號 / 大括號 / 省略號)→ 不當真實引用
const PLACEHOLDER_RE = /(?:^|\/)x{2,}(?:[./]|$)|<|>|\{|\}|\.\.\./i;
function isPlaceholder(p: string): boolean {
  return PLACEHOLDER_RE.test(p);
}

export type RefType = 'import' | 'link' | 'plain';
export interface Ref {
  type: RefType;
  rawPath: string;
  line: number;
}
export interface Violation {
  doc: string;
  line: number;
  type: RefType;
  rawPath: string;
}

/** 純解析:從 markdown 內容抽出三類「指向檔案」的引用(跳過 fenced code)。 */
export function extractRefs(content: string): Ref[] {
  const refs: Ref[] = [];
  const lines = content.split('\n');
  // 追蹤「開啟 fence 的 marker」,只有同款 marker 能關閉。
  // 否則同一文件混用 ``` 與 ~~~(harness 文件常寫 markdown 範例)時,fence 內出現
  // 另一種 marker 會誤把狀態切回 false → 洩漏中間內容被掃 → 硬 gate 假陽性。
  let fenceMarker: '```' | '~~~' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const marker = trimmed.startsWith('```') ? '```' : trimmed.startsWith('~~~') ? '~~~' : null;
    if (marker) {
      if (fenceMarker === null) fenceMarker = marker; // 開 fence
      else if (marker === fenceMarker) fenceMarker = null; // 同款 marker 關 fence
      // 不同 marker 在 fence 內 = 內容,維持 fenceMarker 不變
      continue;
    }
    if (fenceMarker !== null) continue; // fence 內,跳過
    const lineNo = i + 1;

    // 1. @import(整行 `@path`)
    const imp = line.match(IMPORT_RE);
    if (imp) {
      refs.push({ type: 'import', rawPath: imp[1], line: lineNo });
      continue;
    }

    // 2. markdown 本地連結(只收有檔案副檔名、非外部 / 非絕對路由者)
    const linkPaths = new Set<string>();
    let m: RegExpExecArray | null;
    const mdRe = new RegExp(MD_LINK_RE.source, 'g');
    while ((m = mdRe.exec(line)) !== null) {
      let url = m[1].trim();
      url = url.split('#')[0].split('?')[0].trim(); // 去 anchor / query
      if (!url) continue;
      if (/^(https?:|mailto:|tel:)/i.test(url)) continue; // 外部
      if (url.startsWith('/')) continue; // 絕對路由(/privacy 之類),非檔案
      if (!FILE_EXT_RE.test(url)) continue; // 無檔案副檔名 → 不當檔案引用
      if (isPlaceholder(url)) continue; // 範例 / 佔位符
      linkPaths.add(url);
      refs.push({ type: 'link', rawPath: url, line: lineNo });
    }

    // 3. 純文字路徑提及(排除已被 md-link 收錄者,避免重複)
    let pm: RegExpExecArray | null;
    const plainRe = new RegExp(PLAIN_PATH_RE.source, 'g');
    while ((pm = plainRe.exec(line)) !== null) {
      const p = pm[0];
      if (linkPaths.has(p)) continue;
      if (isPlaceholder(p)) continue; // 範例 / 佔位符(prose 內 scripts/xxx.ts)
      // 前一個字元屬「路徑／glob 的一部分」→ 這個 match 是更長 token 的**後半截**,
      // 不是一個獨立的檔案引用。實例:SOP 寫 glob `**/tests/*.test.ts`,regex 從
      // `tests/` 起匹配、把 `**/` 留在外面 → 會被當成「repo 根下有個 tests/*.test.ts」
      // 而誤報。前字元含 `*` / `/` / 英數 → 屬前一段路徑或 glob wildcard、跳過。
      const prev = pm.index > 0 ? line[pm.index - 1] : '';
      if (prev && /[A-Za-z0-9_./*-]/.test(prev)) continue;
      refs.push({ type: 'plain', rawPath: p, line: lineNo });
    }
  }
  return refs;
}

/**
 * 純驗證:每個 ref 解析成候選路徑(相對 repo root),用注入的 fileExists 檢查存在性。
 * - import / link:相對該 doc 目錄
 * - plain:repo root 或 doc 目錄擇一存在即可
 * - 候選落在 repo root 之外(`../`)→ 跳過(無法可靠驗證,非 violation)
 * - isPlanned 命中(模板尚未建立的檔)→ 跳過(建立後自動開始驗證)
 */
export function checkRefs(
  refs: Ref[],
  docRelPath: string,
  fileExists: (relPathFromRoot: string) => boolean,
  isIgnored: (relPathFromRoot: string) => boolean = () => false,
  isPlanned: (relPathFromRoot: string) => boolean = () => false
): Violation[] {
  const docDir = path.posix.dirname(docRelPath.split(path.sep).join('/'));
  const violations: Violation[] = [];

  for (const ref of refs) {
    const docDirRel = path.posix.normalize(path.posix.join(docDir, ref.rawPath));
    const rootRel = path.posix.normalize(ref.rawPath);
    // import:相對 doc 目錄(frontmatter import 慣例)。
    // link / plain:doc 目錄 或 repo root 擇一存在即可(這些 docs 兩種寫法都有)。
    const candidates = ref.type === 'import' ? [docDirRel] : [docDirRel, rootRel];

    // 全部候選都逃出 repo root → 無法驗證,跳過(不算 violation)
    const verifiable = candidates.filter((c) => !c.startsWith('..'));
    if (verifiable.length === 0) continue;

    // gitignored 路徑(.env* / .claude/settings.local.json 等):本機有、CI checkout 無
    // → 硬 gate 在 CI 會假陽性。這些檔刻意不進版控,不在「repo 檔是否存在」驗證範圍 → 跳過。
    if (verifiable.some((c) => isIgnored(c))) continue;

    // 模板規劃中檔案(PLANNED_PATHS):文件先引用、檔案後落地 → 暫跳過
    if (verifiable.some((c) => isPlanned(c))) continue;

    if (!verifiable.some((c) => fileExists(c))) {
      violations.push({ doc: docRelPath, line: ref.line, type: ref.type, rawPath: ref.rawPath });
    }
  }
  return violations;
}

/**
 * 列出要掃的 doc 檔(相對 repo root)。
 * 🔴 雙審 findings(兩邊都抓到、Activa 端已實證):
 *   ① 舊版對 `ROOT_DOCS` 缺檔**靜默略過** → 把某個 root doc 改名就讓 gate 少驗一份、
 *      而且照樣印 ✅。改成回報缺檔,由 main() 判成 violation(要移除就明確從清單刪)。
 *   ② 舊版對 SCAN_DIRS/SCAN_DIRS_RECURSIVE 做 fs walk → gitignored 的本機草稿也會被
 *      掃進來、「本機 gate 紅、CI 綠」。改用 `git ls-files` 只認被追蹤的檔案,本機
 *      與 CI 才看到同一組輸入。
 *   ⚠️ pathspec 語意:git 預設 `${dir}/*.md` 是**遞迴**(prefix 匹配),要非遞迴要用
 *      `:(glob)` fnmatch magic 讓 `*` 不吃 `/`。這裡保留原意:SCAN_DIRS 非遞迴、
 *      SCAN_DIRS_RECURSIVE 遞迴。
 */
function collectDocFiles(): { files: string[]; missingRootDocs: string[] } {
  const files: string[] = [];
  const missingRootDocs: string[] = [];
  for (const f of ROOT_DOCS) {
    if (fs.existsSync(path.join(REPO_ROOT, f))) files.push(f);
    else missingRootDocs.push(f);
  }
  const addFromGit = (pathspec: string) => {
    let listed = '';
    try {
      listed = execFileSync('git', ['-C', REPO_ROOT, 'ls-files', '--', pathspec], {
        encoding: 'utf-8',
      });
    } catch {
      return; // 目錄不存在 / 非 git repo → 跳過(ROOT_DOCS 那組已足以判定 gate 有輸入)
    }
    for (const rel of listed.split('\n').filter(Boolean)) {
      if (!files.includes(rel)) files.push(rel);
    }
  };
  // 非遞迴:`:(glob)` 開 fnmatch、`*` 不吃 `/` → 只匹配直屬 .md
  for (const dir of SCAN_DIRS) addFromGit(`:(glob)${dir}/*.md`);
  // 遞迴:預設 pathspec prefix 匹配、涵蓋所有深度
  for (const dir of SCAN_DIRS_RECURSIVE) addFromGit(`${dir}/*.md`);
  return { files, missingRootDocs };
}

function main() {
  const fileExists = (rel: string) => fs.existsSync(path.join(REPO_ROOT, rel));
  // git check-ignore 判斷(execFileSync 傳 args 陣列,避免 doc 內惡意路徑造成 shell injection)。
  // `-c core.excludesFile=` 關掉 per-user global excludes → 只認 committed `.gitignore`(CI 也只有這個);
  // 否則「本機 global 忽略、CI 沒有」會本機過、CI 假陽性。
  // `--` 終止選項解析防路徑被當 flag。exit 0 = ignored;exit 1/非 git repo = 否。
  const isIgnored = (rel: string) => {
    try {
      execFileSync('git', ['-c', 'core.excludesFile=', '-C', REPO_ROOT, 'check-ignore', '-q', '--', rel], {
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  };
  // PLANNED_PATHS:檔案已存在 → 不再豁免(自動開始驗證);不存在 → 跳過並累計提示
  let plannedSkips = 0;
  const isPlanned = (rel: string) => {
    if (!PLANNED_PATHS.has(rel) || fileExists(rel)) return false;
    plannedSkips++;
    return true;
  };
  const { files: docs, missingRootDocs } = collectDocFiles();
  console.log(`📚 掃 ${docs.length} 份 harness 文件的檔案引用…`);

  // 缺了固定 ROOT_DOCS → 直接失敗(不是靜默少驗一份)
  if (missingRootDocs.length > 0) {
    console.error(
      `\n❌ ROOT_DOCS 清單裡有 ${missingRootDocs.length} 份 harness 文件不存在:\n` +
        missingRootDocs.map((f) => `  - ${f}`).join('\n') +
        '\n💡 檔案真的搬走／刪掉了 → 把它從 scripts/check-doc-refs.ts 的 ROOT_DOCS 明確移除;' +
        '\n   否則這道 gate 會安靜地少驗一份文件還印 ✅。'
    );
    process.exit(1);
  }

  const allViolations: Violation[] = [];
  let totalRefs = 0;
  for (const doc of docs) {
    const content = fs.readFileSync(path.join(REPO_ROOT, doc), 'utf-8');
    const refs = extractRefs(content);
    totalRefs += refs.length;
    allViolations.push(...checkRefs(refs, doc, fileExists, isIgnored, isPlanned));
  }

  console.log(`🔍 共驗 ${totalRefs} 個檔案引用`);
  if (plannedSkips > 0) {
    console.log(
      `ℹ️  ${plannedSkips} 個引用指向 PLANNED_PATHS(模板尚在建置的檔案)→ 暫跳過;檔案落地後自動開始驗證`
    );
  }

  // 一個引用都沒抽到 → 不是「全部通過」,是這道 gate 沒在驗任何東西(掃描清單壞了 /
  // regex 壞了)。舊版會印 ✅ 並 exit 0(fail-open)。
  if (totalRefs === 0) {
    console.error(
      '\n❌ 0 個檔案引用被抽出 — 這代表掃描清單或 regex 壞了,不代表文件乾淨(fail-closed)'
    );
    process.exit(1);
  }

  if (allViolations.length === 0) {
    console.log('✅ 0 個失效引用 — 所有 @import / markdown 連結 / 純路徑提及都指向真實存在的檔案');
    process.exit(0);
  }

  console.error(`\n❌ ${allViolations.length} 個失效的檔案引用:\n`);
  for (const v of allViolations) {
    console.error(`  ${v.doc}:${v.line}  [${v.type}]`);
    console.error(`    → ${v.rawPath}(找不到對應檔案)`);
    console.error('');
  }
  console.error(
    '💡 修法:確認被引用檔案是否已搬移 / 改名 / 刪除,更新引用路徑。\n' +
      '   (只驗檔案存在;#anchor / §x.y 章節錨點的語意漂移由季 LESSONS retro 人工檢查)'
  );
  process.exit(1);
}

// 只在直接 invoke 時跑 main(unit test import 時跳過)。
// ESM 下沒有 require.main —— 比對 argv[1] 與本模組 URL。
const invokedPath = process.argv[1];
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  main();
}
