// Tests for scripts/check-codex-env.ts(SOP-tune v2 (g) Codex env verify)

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import * as path from "node:path";
import {
  DEFAULT_ALLOWED_MODELS,
  checkCodexEnv,
  parseArgs,
} from "../scripts/check-codex-env";

const SCRIPT = path.resolve(__dirname, "../scripts/check-codex-env.ts");

// ─────────────────────────────────────────────────────────────────
// parseArgs

describe("check-codex-env parseArgs", () => {
  it("空 argv → 用 default env name + default allowed values", () => {
    const r = parseArgs([]);
    expect(r.ok).toBe(true);
    expect(r.args.envName).toBe("GSTACK_CODEX_MODEL");
    expect(r.args.allowedValues).toEqual(DEFAULT_ALLOWED_MODELS);
  });

  it("--allow-value=<extra> 加入允許清單", () => {
    const r = parseArgs(["--allow-value=gpt-experimental"]);
    expect(r.ok).toBe(true);
    expect(r.args.allowedValues).toEqual([...DEFAULT_ALLOWED_MODELS, "gpt-experimental"]);
  });

  it("--env=<name> override env var 名字", () => {
    const r = parseArgs(["--env=TEST_MODEL"]);
    expect(r.ok).toBe(true);
    expect(r.args.envName).toBe("TEST_MODEL");
  });

  it("--allow-value= 空字串 → fail-closed", () => {
    const r = parseArgs(["--allow-value="]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("--allow-value 空 value");
  });

  it("--env= 空字串 → fail-closed", () => {
    const r = parseArgs(["--env="]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("--env 空 value");
  });

  it("未知參數 → fail-closed", () => {
    const r = parseArgs(["--unknown"]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("未知參數");
  });
});

// ─────────────────────────────────────────────────────────────────
// checkCodexEnv 純函式

describe("checkCodexEnv 純函式", () => {
  const defaultArgs = {
    envName: "GSTACK_CODEX_MODEL",
    allowedValues: DEFAULT_ALLOWED_MODELS,
  };

  it("env 未設 → unset", () => {
    const r = checkCodexEnv({}, defaultArgs);
    expect(r.kind).toBe("unset");
  });

  it("env 空字串 → unset(當作未設)", () => {
    const r = checkCodexEnv({ GSTACK_CODEX_MODEL: "" }, defaultArgs);
    expect(r.kind).toBe("unset");
  });

  it("env=gpt-6-sol → ok", () => {
    const r = checkCodexEnv({ GSTACK_CODEX_MODEL: "gpt-6-sol" }, defaultArgs);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.value).toBe("gpt-6-sol");
  });

  it("允許清單剛好只有 gpt-6-sol(多加任何 model 都要轉紅)", () => {
    expect(DEFAULT_ALLOWED_MODELS).toEqual(["gpt-6-sol"]);
  });

  // 2026-09-23 Owner 拍板:Step 4 Codex 一律 gpt-6-sol,舊預設與 gstack 預設都不放行
  it.each(["gpt-6-astra", "gpt-5.6-sol"])("env=%s → invalid(只放行 gpt-6-sol)", (model) => {
    const r = checkCodexEnv({ GSTACK_CODEX_MODEL: model }, defaultArgs);
    expect(r.kind).toBe("invalid");
  });

  it("env 值不在允許清單 → invalid", () => {
    const r = checkCodexEnv({ GSTACK_CODEX_MODEL: "gpt-999-wrong" }, defaultArgs);
    expect(r.kind).toBe("invalid");
    if (r.kind === "invalid") {
      expect(r.value).toBe("gpt-999-wrong");
      expect(r.allowedValues).toEqual(DEFAULT_ALLOWED_MODELS);
    }
  });

  it("--allow-value 加入的 experimental value 通過", () => {
    const r = checkCodexEnv(
      { GSTACK_CODEX_MODEL: "gpt-experimental" },
      {
        envName: "GSTACK_CODEX_MODEL",
        allowedValues: [...DEFAULT_ALLOWED_MODELS, "gpt-experimental"],
      },
    );
    expect(r.kind).toBe("ok");
  });

  it("--env override 抓對指定 env var", () => {
    const r = checkCodexEnv(
      { OTHER_MODEL: "gpt-6-sol", GSTACK_CODEX_MODEL: "gpt-999-wrong" },
      { envName: "OTHER_MODEL", allowedValues: DEFAULT_ALLOWED_MODELS },
    );
    expect(r.kind).toBe("ok");
  });
});

// ─────────────────────────────────────────────────────────────────
// CLI e2e

describe("check-codex-env CLI e2e", () => {
  it("env=gpt-6-sol → exit 0", () => {
    const r = spawnSync("npx", ["tsx", SCRIPT], {
      env: { ...process.env, GSTACK_CODEX_MODEL: "gpt-6-sol" },
      encoding: "utf-8",
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("allowed");
  });

  it("env 未設 → exit 2 with actionable message", () => {
    const cleanEnv = { ...process.env };
    delete cleanEnv.GSTACK_CODEX_MODEL;
    const r = spawnSync("npx", ["tsx", SCRIPT], {
      env: cleanEnv,
      encoding: "utf-8",
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("未設定");
    expect(r.stderr).toContain("~/.zshrc");
  });

  it("env=<wrong value> → exit 2 with allowed list", () => {
    const r = spawnSync("npx", ["tsx", SCRIPT], {
      env: { ...process.env, GSTACK_CODEX_MODEL: "gpt-999-wrong" },
      encoding: "utf-8",
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("不在允許清單");
    expect(r.stderr).toContain("gpt-6-sol");
  });

  it("--allow-value=<experimental> + env=experimental → exit 0", () => {
    const r = spawnSync(
      "npx",
      ["tsx", SCRIPT, "--allow-value=gpt-experimental"],
      {
        env: { ...process.env, GSTACK_CODEX_MODEL: "gpt-experimental" },
        encoding: "utf-8",
      },
    );
    expect(r.status).toBe(0);
  });

  it("未知參數 → exit 2", () => {
    const r = spawnSync("npx", ["tsx", SCRIPT, "--unknown"], {
      env: { ...process.env, GSTACK_CODEX_MODEL: "gpt-6-sol" },
      encoding: "utf-8",
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("未知參數");
  });
});
