#!/usr/bin/env node
/**
 * scripts/check-codex-env.ts — SOP-tune v2 (g) Codex env verify script
 *
 * SOP checklist 明列:本 harness 導入者若跑 Codex 跨模型 review,建議設
 * `GSTACK_CODEX_MODEL` 環境變數指定 model(預設清單只有 `gpt-6-sol`;2026-09-23 起取代舊清單
 * `gpt-5.6-sol` / `gpt-6-astra`)。gstack 未設 env 時會退回自己的預設 model。過往靠人記,
 * 現在改機器化守門。導入者要用其他 model:改本清單(pre-push 與 scope note 範本呼叫時都不帶
 * `--allow-value`,該參數只適用手動單次執行)。
 *
 * 用途:
 *   本機 pre-push hook / 手動跑,驗 GSTACK_CODEX_MODEL 是否設定且值在允許清單。
 *   **不進 CI**——env 是本機部署狀態,CI runner 不設(SOP-tune v2 決策)。
 *
 * Exit:
 *   0 = 設定 OK(值在允許清單)
 *   2 = 未設定 / 值不在允許清單 / 未知參數
 *
 * 用法:
 *   npx tsx scripts/check-codex-env.ts
 *   npx tsx scripts/check-codex-env.ts --allow-value=<extra>  // 給 experimental model
 *   npx tsx scripts/check-codex-env.ts --env=GSTACK_CODEX_MODEL  // 指定 env var 名(預設同名)
 *
 * v1 邊界:
 *   純 env-var 名字比對,抓不到「值設對但 codex CLI 版本 broken」的情境;
 *   也不驗 `~/.zshrc` 有沒有真的 export(只讀 process.env,只有跑此 script
 *   時已 `source ~/.zshrc` 才會偵測到)。
 */

import { detectInvocation, reportIfNotMain } from "./lib/invoked-as-main";

// SOP checklist 明列的兩個 model(導入者可用 --allow-value 加自家 experimental)
export const DEFAULT_ALLOWED_MODELS: readonly string[] = ["gpt-6-sol"];

/** env var 名字,預設 GSTACK_CODEX_MODEL(可用 --env 參數 override 給測試)。 */
const DEFAULT_ENV_NAME = "GSTACK_CODEX_MODEL";

export interface CheckArgs {
  envName: string;
  allowedValues: readonly string[];
}

export function parseArgs(argv: string[]): { args: CheckArgs; ok: boolean; error?: string } {
  let envName = DEFAULT_ENV_NAME;
  const extraAllowed: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--allow-value=")) {
      const value = a.slice("--allow-value=".length);
      if (value === "") {
        return { args: { envName, allowedValues: [] }, ok: false, error: "--allow-value 空 value" };
      }
      extraAllowed.push(value);
    } else if (a.startsWith("--env=")) {
      const value = a.slice("--env=".length);
      if (value === "") {
        return { args: { envName, allowedValues: [] }, ok: false, error: "--env 空 value" };
      }
      envName = value;
    } else {
      return { args: { envName, allowedValues: [] }, ok: false, error: `未知參數:${a}` };
    }
  }
  return {
    args: {
      envName,
      allowedValues: [...DEFAULT_ALLOWED_MODELS, ...extraAllowed],
    },
    ok: true,
  };
}

export type CheckResult =
  | { kind: "ok"; envName: string; value: string }
  | { kind: "unset"; envName: string }
  | { kind: "invalid"; envName: string; value: string; allowedValues: readonly string[] };

/**
 * 純函式:對給定 env snapshot 判定。
 * env 從外部注入(process.env 或測試 fixture),不直接讀 process.env 讓測試好寫。
 */
export function checkCodexEnv(
  env: Record<string, string | undefined>,
  args: CheckArgs,
): CheckResult {
  const value = env[args.envName];
  if (value === undefined || value === "") {
    return { kind: "unset", envName: args.envName };
  }
  if (!args.allowedValues.includes(value)) {
    return {
      kind: "invalid",
      envName: args.envName,
      value,
      allowedValues: args.allowedValues,
    };
  }
  return { kind: "ok", envName: args.envName, value };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    console.error(`✗ ${parsed.error}`);
    console.error("  用法:npx tsx scripts/check-codex-env.ts [--allow-value=<extra>] [--env=<name>]");
    return 2;
  }
  const result = checkCodexEnv(process.env, parsed.args);
  if (result.kind === "ok") {
    console.log(`✅ ${result.envName}=${result.value} (allowed)`);
    return 0;
  }
  if (result.kind === "unset") {
    console.error(`✗ ${result.envName} 未設定`);
    console.error("");
    console.error("  修法(對 ~/.zshrc 加一行):");
    console.error(`    export ${result.envName}=gpt-6-sol   # SOP Step 4 預設 model`);
    console.error("");
    console.error("  然後 `source ~/.zshrc` 或開新 terminal 讓變數生效。");
    console.error("");
    console.error("  完整規格見 .claude/sop/plan-mode-checklist.md 「Step 4:跨模型 Review」段。");
    return 2;
  }
  // invalid
  console.error(`✗ ${result.envName}=${result.value}(不在允許清單)`);
  console.error(`  允許值:${result.allowedValues.join(", ")}`);
  console.error("");
  console.error("  修法(對 ~/.zshrc 改成):");
  console.error(`    export ${result.envName}=gpt-6-sol   # SOP Step 4 預設 model`);
  console.error("");
  console.error("  若確實要用 experimental model,加 --allow-value=<value> 明確 opt-in。");
  return 2;
}

// ESM main 判定(對稱其他 checker):兩端 realpath、indeterminate exit 2
const outcome = detectInvocation(import.meta.url, process.argv[1]);
const isMain = reportIfNotMain(outcome, "check-codex-env");
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
