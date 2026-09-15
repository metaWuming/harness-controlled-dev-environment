// scripts/lib/governance-paths.ts
//
// Governance path 集合的 SSOT(SOP-tune v2 (d))
//
// **緣起**:兩個 sibling checker 各自維護 governance-file allowlist:
//   - `scripts/check-progress-codex-review.ts` DOCS_ALLOW_EXACT + DOCS_ALLOW_PREFIXES
//   - `scripts/check-bookkeeping-commit.ts` EXACT_ALLOW + ARCHIVE_DIRS
//
// Pairwise 出現漂移(README 在 docs 但不在 bookkeeping / _handoffs 只在 docs …)。
// SOP-tune v1 Step 5 adversarial 抓為 informational (d) defer 到 v2。
//
// **設計取捨**:兩個集合語意方向不同,不能盲抽:
//   - `isDocsFile` = 「允許 docs-only sprint 動」— 判此 diff 是否可跳過 Codex round
//   - `isBookkeepingPath` = 「delivery branch 上允許 bookkeeping commit」— Step 6 補 PR #
//
// 因此本 lib export 的是**基礎組件**(single-path constants + 前綴 constants),
// 兩 checker 各自組合成語意正確的集合。
//
// **兩 checker 使用差異表**(export 每個組件時的 anchor doc):
//
// | 組件                     | docs (isDocsFile) | bookkeeping (isBookkeepingPath) |
// |--------------------------|-------------------|--------------------------------|
// | README_FILE              | ✓ (純散文)         | ✗ (可能含 env/token/部署指示)   |
// | PROGRESS_FILE            | ✓                 | ✓                              |
// | TODOS_BOOKKEEPING_FILES  | ✓                 | ✓                              |
// | PROGRESS_ARCHIVE_PREFIX  | ✓ (排 README.md)  | ✓ (排 README.md、不進子目錄)     |
// | HANDOFFS_PREFIX          | ✓                 | ✗ (應併 sprint PR、非 bookkeeping) |
//
// **反向禁區**:`TRIVIAL_FORBIDDEN_PATTERNS` 是 trivial marker override 的拒絕清單,
// check-progress-codex-review 使用;放這裡是為了讓未來新增守門 script 共用同一份 SSOT。

/** progress entry 的正典路徑。 */
export const PROGRESS_FILE = ".claude/memory/progress.md";

/** Project README(純散文說明,允許 docs-only sprint 動)。 */
export const README_FILE = "README.md";

/**
 * TODOS / BACKLOG / TODOS-done bookkeeping 檔的完整清單(root + `.claude/memory/`)。
 *
 * SOP 文字與實際慣例都出現這兩處位置。docs 與 bookkeeping 兩個 checker 全收。
 */
export const TODOS_BOOKKEEPING_FILES: readonly string[] = [
  "TODOS.md",
  ".claude/memory/TODOS.md",
  "BACKLOG.md",
  ".claude/memory/BACKLOG.md",
  "TODOS-done.md",
  ".claude/memory/TODOS-done.md",
] as const;

/** Progress-archive 慣例目錄(不進子目錄、basename 不能是 README.md)。 */
export const PROGRESS_ARCHIVE_PREFIX = ".claude/memory/progress-archive/";

/** 交接檔慣例目錄(hi5 flow 產生的 handoff)。 */
export const HANDOFFS_PREFIX = "_handoffs/";

/**
 * Trivial marker override 的 super-sensitive path 拒絕清單。
 *
 * SOP 明講「碰 auth/CI/守門的單行修不算 trivial 例外」;CLAUDE.md §4.5「禁區清單」
 * 明列各邊界。以此為機器化下限。
 *
 * SOP-tune v1 累積:R4 P1-1 加 CI 守門類、R5 P1-1 補完 CLAUDE.md §4.5、Step 5 INF (k)
 * 補 governance SSOT(control-catalog.json / CONTROL-CATALOG.md / harness.config.json)。
 */
export const TRIVIAL_FORBIDDEN_PATTERNS: readonly RegExp[] = [
  // SOP / auth / CI / 守門(既有)
  /^scripts\/git-hooks\//,
  /^scripts\/mutate\.ts$/,
  /^scripts\/lib\/destructive-guard/,
  /^\.github\/workflows\//,
  /^src\/.*\/auth/i,
  /^src\/.*security/i,
  /^prisma\/schema\.prisma$/,
  /(?:^|\/)\.env(?:\..*)?$/,
  /^\.claude\/settings/,
  /^CLAUDE\.md$/,
  /^\.claude\/sop\//,
  // R5 P1-1:CSO trigger gate 治理檔
  /^scripts\/check-cso-trigger\.ts$/,
  /^scripts\/cso-trigger\.config\.ts$/,
  // Step 5 INF (k) 修:governance SSOT
  /^scripts\/control-catalog\.json$/,
  /^docs\/CONTROL-CATALOG\.md$/,
  /^scripts\/harness\.config\.json$/,
];
