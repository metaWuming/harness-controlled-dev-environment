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
import { fileURLToPath } from "node:url";
import path from "node:path";

// ───────────────────────────────────────── 純函式(給測試直接呼叫)

/**
 * 判斷單一 repo-relative 路徑是不是 bookkeeping。
 *
 * 判準三條(全部要同時符合才 true):
 *   ① 必須在 `.claude/memory/` 底下(包含子目錄,例:`progress-archive/`)
 *   ② 必須以 `.md` 結尾
 *   ③ 不能是 `.claude/memory/LESSONS.md` 本身(那是治理內容;archive 目錄下的
 *      LESSONS 快照算 bookkeeping,只擋當前 canonical LESSONS.md)
 */
export function isBookkeepingPath(file: string): boolean {
  if (!file.startsWith(".claude/memory/")) return false;
  if (!file.endsWith(".md")) return false;
  if (file === ".claude/memory/LESSONS.md") return false;
  return true;
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

function getChangedFiles(sha: string): string[] | null {
  const r = spawnSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", sha], {
    encoding: "utf-8",
  });
  if (r.status !== 0) return null;
  return (r.stdout ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// ───────────────────────────────────────── main

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
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

const isMain =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`✗ 未預期例外:${(e as Error)?.stack ?? String(e)}`);
      process.exit(2);
    });
}
