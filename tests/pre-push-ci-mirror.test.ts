// @vitest-environment node
//
// `scripts/pre-push-ci-mirror.sh` 的守門測試(harness-controlled-dev-environment)。
//
// 🔴 為什麼這支必須存在:pre-push-ci-mirror 是「push 前 CI 檢查機器化」的實作,
//    自己就有斷言邏輯——它壞掉時可能靜默通過或狂噴錯誤;測試在拋棄式脈絡下
//    驗它的 opt-in env、syntax、npm script binding 幾條 sanity。
//
// **哲學**:對稱 pre-push hook §3(codex env gate)opt-in 姿態,本 script 也是
// opt-in(`ENABLE_PRE_PUSH_CI_MIRROR=1` 才跑)。「未 opt-in → 立即 exit 0」是
// 承諾邊界——測試就要驗它。
//
// **不做**完整 CI-mirror end-to-end 跑(那要 ~3 min vitest + 網路 audit)。

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
}).trim();

const scriptPath = join(repoRoot, "scripts", "pre-push-ci-mirror.sh");

describe("pre-push-ci-mirror.sh(opt-in)", () => {
  it("script 存在且可執行", () => {
    expect(existsSync(scriptPath)).toBe(true);
    const st = statSync(scriptPath);
    expect(st.mode & 0o100).toBe(0o100);
  });

  it("bash syntax valid(bash -n 通過)", () => {
    const r = spawnSync("bash", ["-n", scriptPath], { encoding: "utf-8" });
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("");
  });

  it("未設 ENABLE_PRE_PUSH_CI_MIRROR → 立即 exit 0(對稱 harness 「外部工具全 optional」承諾)", () => {
    // clear env var(若 developer shell 有設,測試要用乾淨環境驗預設行為)
    const env = { ...process.env };
    delete env.ENABLE_PRE_PUSH_CI_MIRROR;
    const r = spawnSync("bash", [scriptPath], {
      encoding: "utf-8",
      env,
      timeout: 5_000, // 若真跑 checker,絕不可能在 5 秒內完成
    });
    expect(r.status).toBe(0);
    // 未 opt-in 應該安靜 exit 0(不印 skip 訊息也 OK,關鍵是不擋)
  });

  it("package.json 有 check:pre-push script 指向本 script", () => {
    const workingPkg = JSON.parse(
      execFileSync("cat", ["package.json"], {
        encoding: "utf-8",
        cwd: repoRoot,
      }),
    );
    expect(workingPkg.scripts["check:pre-push"]).toBe(
      "bash scripts/pre-push-ci-mirror.sh",
    );
  });

  it("pre-push hook 有呼叫本 script 段(對稱 §3 opt-in 姿態)", () => {
    const hookPath = join(repoRoot, "scripts", "git-hooks", "pre-push");
    const content = execFileSync("cat", [hookPath], { encoding: "utf-8" });
    // 呼叫本 script
    expect(content).toMatch(/bash scripts\/pre-push-ci-mirror\.sh/);
    // 對稱 §3 姿態:hook 只 check script 存在 + execute,opt-in 由 script 自己 gate
    // 未來若把 opt-in gate 誤搬回 hook(強制跑)本 assertion 仍過 —— 但 script
    // 自己的 ENABLE_PRE_PUSH_CI_MIRROR check 是承諾邊界(見上一 test 案)
    expect(content).toContain('if [ -x "scripts/pre-push-ci-mirror.sh" ]');
  });
});
