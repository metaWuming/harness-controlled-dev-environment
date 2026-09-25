// @vitest-environment node
//
// `scripts/git-hooks/pre-push` 的 EXIT trap 不可改寫結束碼。
//
// 🔴 為什麼：在 `set -e` 下，未建立 `trusted_config` 時，清理函式的 `&&` 串回傳 1，使 EXIT trap 將原本成功的退出改為 1；明確 `return 0` 可避免此情況。
//    （下游專案先踩到：push 一律靜默失敗。）
//
// 用「只刪除一般分支」的推送重現：沒有要掃的範圍 → 不建立 trusted_config，也不依賴本機或 CI 有沒有裝 gitleaks。

import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim();
const hook = join(repoRoot, "scripts", "git-hooks", "pre-push");
const Z40 = "0".repeat(40);

describe("pre-push EXIT trap", () => {
  it("🔴 只刪除一般分支（沒有要掃的範圍、不建立 trusted_config）→ exit 0（trap 不把 0 改成 1）", () => {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf-8" }).trim();
    const r = spawnSync("bash", [hook, "origin", "https://example.invalid/x.git"], {
      cwd: repoRoot,
      encoding: "utf-8",
      input: `(delete) ${Z40} refs/heads/tmp-exit-trap ${sha}\n`,
    });
    expect(r.status, r.stderr).toBe(0);
  });
});
