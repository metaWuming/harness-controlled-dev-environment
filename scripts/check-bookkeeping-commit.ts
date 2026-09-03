#!/usr/bin/env node
/**
 * scripts/check-bookkeeping-commit.ts — 核對「bookkeeping commit」的機器化守門
 *
 * 「bookkeeping」的定義以 `.claude/sop/plan-mode-checklist.md` Step 5 worktree
 * 條目為唯一正本(那段開頭寫著「本段為唯一正本」)。本腳本是那段話的機器化——
 * SOP 現在寫的是「這個 commit 的 diff 只允許狀態簿記」,這句話用人工分類會漂,
 * 於是提出一個純檔名判準:
 *
 *   allowlist:`.claude/memory/**.md`,`LESSONS.md` 除外
 *              (progress.md / TODOS.md / BACKLOG.md / *-archive/**.md)
 *   denylist :所有其他檔——`LESSONS.md`、`.claude/sop/**`、`CLAUDE.md`、
 *              `scripts/**`、`docs/**`、`README.md`、原始碼、測試、CI 設定,
 *              一律不算 bookkeeping(那是治理內容,見 SOP 頂部 docs-only 判準
 *              的 🔴 條件)
 *
 * 用法:
 *   npx tsx scripts/check-bookkeeping-commit.ts [<commit-sha>]
 *   預設查 HEAD。
 *
 * v1 邊界(誠實揭露):
 *   純檔名過濾抓不到「檔名對但內容不對」的情境——例:有人在 progress.md 塞
 *   新的 SOP 規則文字。那已進入 human 惡意情境,超出本工具範圍;要抓內容,得
 *   看 diff 每一行(未來 v2 可能加,一有誤報數據就有校準基準)。
 *
 * Exit:
 *   0 = 是 bookkeeping(所有動到的檔都在 allowlist)
 *   1 = 不是 bookkeeping(有 denylist 檔命中)
 *   2 = 判定不能(git 錯 / 空 diff / 非 commit-sha 參數)——語意對齊 `check:cso`
 *       與 `mutate.ts`:任何無法判定都當成沒過
 */

import { spawnSync } from "node:child_process";
import { detectInvocation, reportIfNotMain } from "./lib/invoked-as-main";

// ───────────────────────────────────────── 純函式(給測試直接呼叫)

/**
 * 判斷單一 repo-relative 路徑是不是 bookkeeping。
 *
 * 🔴 Codex review round 2 P1+P2:第一版用「.claude/memory/ 前綴 + .md 尾綴」
 *   太寬(把歸檔慣例 README.md 放行、又錯過 root TODOS.md)。改成精確 exact
 *   allowlist + archive snapshot glob。
 * 🔴 Codex review round 3 P2:LESSONS-archive 底下的 season snapshot(例:
 *   `2026-Q3.md`)本身**含 archived lessons 與 automation guidance**——與
 *   canonical LESSONS.md 同性質、同屬 governance,SOP L319-322 明說 LESSONS.md
 *   與規則/安全文字改動不在 bookkeeping 例外內。因此 `LESSONS-archive/` 全目錄
 *   從 bookkeeping 移除;只保留 `progress-archive/` 的 sprint entry snapshot。
 *
 * 判準:
 *   A. 精確 allowlist(EXACT_ALLOW)——列出所有正典 bookkeeping 檔;
 *      TODOS / BACKLOG / TODOS-done 兩處(root 與 `.claude/memory/`)都收,
 *      因為 SOP 文字與實際慣例都有出現、寬版才不會誤擋 Step 6 補 PR # 的 commit
 *   B. progress-archive snapshot(季度封存 sprint entry)——
 *      `.claude/memory/progress-archive/*.md`,**但 basename 不能是 `README.md`**
 *      (那是歸檔慣例文件、含 SOP 指示,屬 governance)。不進子目錄。
 *   ⚠️ LESSONS-archive 整體 **不在** allowlist——archived lessons 與 canonical
 *      LESSONS.md 同屬 governance。
 */

const EXACT_ALLOW: ReadonlySet<string> = new Set([
  ".claude/memory/progress.md",
  "TODOS.md",
  ".claude/memory/TODOS.md",
  "BACKLOG.md",
  ".claude/memory/BACKLOG.md",
  "TODOS-done.md",
  ".claude/memory/TODOS-done.md",
]);

const ARCHIVE_DIRS: readonly string[] = [".claude/memory/progress-archive/"];

export function isBookkeepingPath(file: string): boolean {
  if (EXACT_ALLOW.has(file)) return true;
  for (const dir of ARCHIVE_DIRS) {
    if (!file.startsWith(dir)) continue;
    const rest = file.slice(dir.length);
    if (rest.length === 0) return false; // 目錄本身
    if (rest.includes("/")) return false; // 不進子目錄
    if (!rest.endsWith(".md")) return false;
    if (rest === "README.md") return false; // 歸檔慣例、屬 governance
    return true;
  }
  return false;
}

/**
 * 把 diff 檔清單分成 bookkeeping 與 violations 兩堆。
 * 順序保留(方便輸出時對得上原順序)。
 */
export function classifyBookkeepingFiles(files: string[]): {
  bookkeeping: string[];
  violations: string[];
} {
  const bookkeeping: string[] = [];
  const violations: string[] = [];
  for (const f of files) {
    if (isBookkeepingPath(f)) bookkeeping.push(f);
    else violations.push(f);
  }
  return { bookkeeping, violations };
}

// ───────────────────────────────────────── git 讀 diff 檔清單

/**
 * 讀該 commit 動到的所有檔案路徑(repo 相對)。
 *
 * 🔴 Codex review round 1 P1(rename 偵測):`diff-tree --name-only` 在 rename
 *   偵測開啟時,只會列出目的地路徑。把 `.claude/memory/LESSONS.md` 或任何 code
 *   檔 rename 到 archive 底下的 allowlist 路徑 → 這裡回傳的清單只有目的地 →
 *   `classifyBookkeepingFiles` 判 ok → exit 0 → 錯誤啟動 bookkeeping 例外。
 *   → `--no-renames` 關掉 rename 偵測,強制看到「刪一支 + 加一支」兩條。
 *
 * 🔴 Codex review round 1 P2(路徑 bytes):`diff-tree --name-only` 對含空白或
 *   非 ASCII 的檔名會加引號 escape;`trim()` 又會把合法的前後空白吃掉,讓
 *   ` .claude/memory/progress.md`(前導空白)這種怪路徑被誤判為 allowlist。
 *   → `-z` 讓路徑用 NUL 分隔並輸出原始 bytes,再用 NUL 切、不 trim。
 */
function getChangedFiles(sha: string): string[] | null {
  const r = spawnSync(
    "git",
    ["diff-tree", "--no-commit-id", "--name-only", "--no-renames", "-z", "-r", sha],
    { encoding: "utf-8" },
  );
  if (r.status !== 0) return null;
  return (r.stdout ?? "").split("\0").filter((l) => l.length > 0);
}

// ───────────────────────────────────────── main

async function main(): Promise<number> {
  const argv = process.argv.slice(2);

  // 🔴 Codex review round 1 P2(額外參數):過去把多餘 arg 靜默忽略——
  //   例:`npm run check:bookkeeping -- HEAD~1 HEAD` 只會查 HEAD~1、HEAD 被漏。
  //   本腳本控制高風險車道的重跑決策,malformed 呼叫必須 fail-closed 而非
  //   悄悄查錯的 commit。
  if (argv.length > 1) {
    console.error(`✗ 多餘參數(收到 ${argv.length} 個,只接受 0 或 1 個):${argv.join(" ")}`);
    console.error("  → 只查一個 commit,或不加參數(預設 HEAD)");
    return 2;
  }
  const shaArg = argv[0] ?? "HEAD";

  // 驗證是不是有效 commit(拒收 tag / tree / blob / 亂字串)
  const rev = spawnSync("git", ["rev-parse", "--verify", `${shaArg}^{commit}`], { encoding: "utf-8" });
  if (rev.status !== 0) {
    console.error(`✗ 不是有效 commit:${shaArg}`);
    return 2;
  }
  const fullSha = (rev.stdout ?? "").trim();

  const files = getChangedFiles(fullSha);
  if (files === null) {
    console.error(`✗ 讀不到 commit ${fullSha} 的檔案清單(git diff-tree 失敗)`);
    return 2;
  }
  if (files.length === 0) {
    console.error(`✗ commit ${fullSha} 沒改任何檔——空 diff 不算 bookkeeping,也不算違規`);
    return 2;
  }

  const { bookkeeping, violations } = classifyBookkeepingFiles(files);

  console.log(`目標 commit:${fullSha}`);
  console.log(`共 ${files.length} 檔  bookkeeping:${bookkeeping.length}  violations:${violations.length}`);

  if (violations.length === 0) {
    console.log(`\n✅ 全部檔案都在 bookkeeping allowlist 內:`);
    for (const f of bookkeeping) console.log(`    ${f}`);
    return 0;
  }

  console.error(`\n🔴 有 ${violations.length} 檔不在 bookkeeping allowlist:`);
  for (const f of violations) console.error(`    ${f}`);
  console.error(
    "\n  → bookkeeping 只允許 .claude/memory/**.md(LESSONS.md 除外);其他都是治理/碼/規則內容",
  );
  console.error("  → 此 commit 不能當「bookkeeping 例外」;Step 4.5 / 5 / 6 的重跑條件要照走");
  return 1;
}

// ESM main 判定改用 scripts/lib/invoked-as-main.ts 共用 lib(P2#3 defer ①② 後續遷移):
// 兩端 realpath、indeterminate 由 caller 顯式 exit(2)、被當 import 用時完全靜默。
const outcome = detectInvocation(import.meta.url, process.argv[1]);
const isMain = reportIfNotMain(outcome, "check-bookkeeping-commit");
if (isMain) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`✗ 未預期例外:${(e as Error)?.stack ?? String(e)}`);
      process.exit(2);
    });
} else if (outcome.kind === "indeterminate") {
  process.exit(2);
}
