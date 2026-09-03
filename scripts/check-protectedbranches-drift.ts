// scripts/check-protectedbranches-drift.ts — A3 defer ⑩ CTRL-CI-014
//
// 對 PR **不可繞** 地擋:harness.config.json 的 protectedBranches 集合擴大。
// 集合擴大 = 治理擴權(讓某分支能享 baseline-governance 的 promotion 豁免),
// 惡意 / 誤動 都應由本 gate 抓到。
//
// **合約**(strict fail-closed、rev5 拍板、無 PR-controlled bypass):
//   - argv:`--base=<sha>` 必填(**immutable PR base SHA**,不接受 branch ref)
//   - 兩側讀取 trust-boundary:
//       mb = git merge-base <base> HEAD
//       base config = git show <mb>:scripts/harness.config.json
//       head config = git show HEAD:scripts/harness.config.json
//     **不讀 PR tree** / **不讀可移動 base ref** / **不讀 PR body / marker**
//   - 兩側同用既有 parseHarnessConfig 驗 schema
//   - 判定:diffProtectedBranches(baseCfg.protectedBranches, headCfg.protectedBranches)
//       added.length > 0 → exit 2(**永遠**、無 override)
//       added.length === 0 → exit 0(縮小 / 重排 / 不變都允許)
//   - 任一失敗(git / parse / mb / config 缺)→ exit 2(fail-closed)
//
// **合法擴大 escape hatch**:Owner / admin 組織治理層(branch protection / ruleset),
// CI 維持紅、rollback = full revert。**無 PR-controlled marker / opt-out / --no-verify**。
//
// 完整設計取捨與 e2e 見 plan file:
//   ~/.claude/plans/a3-defer-10-protectedbranches-drift.md

import { spawnSync } from "node:child_process";
import { detectInvocation, reportIfNotMain } from "./lib/invoked-as-main";
import { parseHarnessConfig } from "./lib/harness-config";
import { diffProtectedBranches } from "./lib/protectedbranches-drift";

const CONFIG_PATH = "scripts/harness.config.json";

export interface CheckResult {
  code: 0 | 2;
  text: string;
}

/**
 * argv 只收單一 `--base=<40-char hex SHA>`;其他一律 fail-closed exit 2。
 *
 * ⚠️ **必為 immutable 完整 40 字元 hex SHA**——拒絕 branch ref(HEAD / origin/main /
 * refs/heads/...)、短 SHA、tag。原因(Codex Step 4 r1 P1):`--base=HEAD` 會讓
 * merge-base(HEAD, HEAD)=HEAD → base config 與 head config 讀同 tree → 已擴大
 * 集合誤判 exit 0(fail-open)。CI step 已用 immutable `github.event.pull_request.base.sha`
 * (由 ci-step-conditions.test.ts YAML structural lock 守),CLI 也必補 trust-boundary
 * 驗、避免本地誤呼叫或未來 CI 退化到 branch ref。
 */
const IMMUTABLE_SHA_RE = /^[0-9a-f]{40}$/;

export function parseArgs(argv: string[]): { ok: true; base: string } | { ok: false; reason: string } {
  const baseArgs = argv.filter((a) => a.startsWith("--base="));
  const unknown = argv.filter((a) => !a.startsWith("--base="));
  if (unknown.length > 0) return { ok: false, reason: `未知參數:${unknown.join(" ")}` };
  if (baseArgs.length !== 1) return { ok: false, reason: `--base=<sha> 必填且只能一個(收到 ${baseArgs.length} 個)` };
  const val = baseArgs[0]!.slice("--base=".length);
  if (val === "") return { ok: false, reason: `--base=<sha> 值不得為空` };
  if (!IMMUTABLE_SHA_RE.test(val)) {
    return {
      ok: false,
      reason: `--base=<sha> 必為 immutable 完整 40 字元 hex SHA(收到:${val});拒絕 branch ref(如 HEAD、origin/main)、短 SHA、tag——避免 merge-base(HEAD,HEAD) 誤判擴大為 exit 0。CI 用 github.event.pull_request.base.sha。`,
    };
  }
  return { ok: true, base: val };
}

/** git 命令包裝。exit 0 才視為成功;其餘一律回 null。 */
function gitRun(args: string[], cwd: string): { ok: true; stdout: string } | { ok: false; reason: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (r.status !== 0) {
    const stderr = (r.stderr ?? "").trim();
    return { ok: false, reason: `git ${args.slice(0, 2).join(" ")} 失敗(exit ${r.status})${stderr ? ":" + stderr : ""}` };
  }
  return { ok: true, stdout: r.stdout ?? "" };
}

/** 主檢查(純 Result、無 process.exit;e2e 可直接測)。 */
export function runCheck(cwd: string, baseSha: string): CheckResult {
  // 1. merge-base
  const mb = gitRun(["merge-base", baseSha, "HEAD"], cwd);
  if (!mb.ok) return { code: 2, text: `✗ 無法判定:${mb.reason}(--base=${baseSha} 需為有效 immutable SHA、且 checkout 需 fetch-depth 足夠)` };
  const mbSha = mb.stdout.trim();

  // 2. base config bytes(from merge-base 那側,PR 改不到)
  const baseBytes = gitRun(["show", `${mbSha}:${CONFIG_PATH}`], cwd);
  if (!baseBytes.ok) return { code: 2, text: `✗ 無法判定:merge-base ${mbSha} 讀不到 ${CONFIG_PATH}:${baseBytes.reason}` };

  // 3. head config bytes
  const headBytes = gitRun(["show", `HEAD:${CONFIG_PATH}`], cwd);
  if (!headBytes.ok) return { code: 2, text: `✗ 無法判定:HEAD 讀不到 ${CONFIG_PATH}:${headBytes.reason}` };

  // 4. parse 兩側(既有 parser、schema 驗)
  let baseCfg;
  try {
    baseCfg = parseHarnessConfig(baseBytes.stdout);
  } catch (e) {
    return { code: 2, text: `✗ 無法判定:merge-base ${mbSha} 的 ${CONFIG_PATH} parse 失敗:${(e as Error).message}` };
  }
  let headCfg;
  try {
    headCfg = parseHarnessConfig(headBytes.stdout);
  } catch (e) {
    return { code: 2, text: `✗ 無法判定:HEAD 的 ${CONFIG_PATH} parse 失敗:${(e as Error).message}` };
  }

  // 5. diff
  const drift = diffProtectedBranches(baseCfg.protectedBranches, headCfg.protectedBranches);

  if (drift.added.length > 0) {
    const lines = [
      `❌ protectedBranches 集合擴大(治理擴權):新增 ${drift.added.length} 個分支`,
      `  added:[${drift.added.map((b) => `"${b}"`).join(", ")}]`,
      drift.removed.length > 0 ? `  removed:[${drift.removed.map((b) => `"${b}"`).join(", ")}]` : `  removed:(無)`,
      `  merge-base:${mbSha}`,
      `  HEAD 側 protectedBranches:[${headCfg.protectedBranches.map((b) => `"${b}"`).join(", ")}]`,
      `  merge-base 側 protectedBranches:[${baseCfg.protectedBranches.map((b) => `"${b}"`).join(", ")}]`,
      ``,
      `  合法擴大手續(fail-closed 契約,無 PR-controlled bypass):`,
      `    - Owner / admin 組織治理層明列 override(手動 approve + branch protection allow)`,
      `    - CI 維持紅,rollback = full revert PR`,
      `    - **不接受** PR 描述 marker / opt-out flag / --no-verify`,
      `  說明:GOV-005 現以 CTRL-CI-014 機器化;branch protection advisory 仍保留 CTRL-GOV-005 身分。`,
    ];
    return { code: 2, text: lines.join("\n") };
  }

  const lines = [
    `✅ protectedBranches 集合未擴大(A3 defer ⑩ CTRL-CI-014 通過)`,
    `  merge-base:${mbSha}`,
    drift.removed.length > 0 ? `  removed:[${drift.removed.map((b) => `"${b}"`).join(", ")}](縮權允許)` : `  無變更`,
    `  HEAD 側 protectedBranches:[${headCfg.protectedBranches.map((b) => `"${b}"`).join(", ")}]`,
  ];
  return { code: 0, text: lines.join("\n") };
}

// ESM main 判定用共用 lib(P2#3 defer ①② 後續遷完的 pattern):
const outcome = detectInvocation(import.meta.url, process.argv[1]);
const isMain = reportIfNotMain(outcome, "check-protectedbranches-drift");
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(`✗ ${args.reason}`);
    process.exit(2);
  }
  const r = runCheck(process.cwd(), args.base);
  console[r.code === 0 ? "log" : "error"](r.text);
  process.exit(r.code);
} else if (outcome.kind === "indeterminate") {
  process.exit(2);
}
