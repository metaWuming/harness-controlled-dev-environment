// @vitest-environment node
//
// `scripts/git-hooks/pre-push` 的 EXIT trap 不可改寫結束碼。
//
// 🔴 為什麼：`cleanup_trusted_config` 以 `[ … ] && [ … ] && rm` 串成；沒建立 trusted_config 時
//    （沒裝 gitleaks＋SKIP_GITLEAKS_CHECK=1、整批 push 只有刪除 ref）串回 1，EXIT trap 的最後狀態
//    會蓋掉腳本的 `exit 0` → push 一律靜默失敗。下游專案先踩到。

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim();
const hook = join(repoRoot, "scripts", "git-hooks", "pre-push");
const Z40 = "0".repeat(40);
const pathWithoutGitleaks = () =>
  (process.env.PATH ?? "")
    .split(delimiter)
    .filter((d) => d !== "" && !existsSync(join(d, "gitleaks")))
    .join(delimiter);

describe("pre-push EXIT trap", () => {
  it("🔴 沒裝 gitleaks、SKIP_GITLEAKS_CHECK=1、推一般分支 → exit 0（trap 不把 0 改成 1）", () => {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf-8" }).trim();
    const r = spawnSync("bash", [hook, "origin", "https://example.invalid/x.git"], {
      cwd: repoRoot,
      encoding: "utf-8",
      input: `refs/heads/tmp-exit-trap ${sha} refs/heads/tmp-exit-trap ${Z40}\n`,
      // 從 PATH 拿掉有 gitleaks 的目錄（本機 Homebrew、CI runner 裝的位置都不一定）
      env: { HOME: process.env.HOME ?? "", PATH: pathWithoutGitleaks(), SKIP_GITLEAKS_CHECK: "1" },
    });
    expect(r.stderr).toContain("SKIP_GITLEAKS_CHECK=1");
    expect(r.status, r.stderr).toBe(0);
  });
});
