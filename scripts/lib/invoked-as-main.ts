// scripts/lib/invoked-as-main.ts
//
// ESM main 判定共用 lib(P2#3 defer ①②):三支守門 CLI 的 SSOT。
//
// **緣起**:PR P2#3 Step 5 r1 CRITICAL 只修 check-mutation-specs.ts 的 isMain(兩端
// realpath),但 mutate.ts / check-control-catalog.ts 仍用舊寫法——macOS `/tmp` →
// `/private/tmp` 這種 symlink 目錄呼叫下,`fileURLToPath(import.meta.url)`(tsx 已
// realpath)與 `path.resolve(argv[1])`(使用者原樣)不等 → main **不執行、silent
// exit 0**。fail-closed 守門自己 fail-open。已修的 check-mutation-specs.ts 版本又有
// **單邊 fallback** 問題(realpath 一邊拋、退回原字串,仍可能不等且無診斷)。
//
// **合約**(對稱三支 consumer):
//   - `detectInvocation` 純函式、無 side effect、無 throw,回 discriminated union
//   - 三態:`main` / `import-or-not-main` / `indeterminate`
//   - `indeterminate` 帶穩定 reason 列舉,含 raw inputs 讓 reporter 印診斷
//   - `reportIfNotMain` 是唯一 stderr 副作用點,對 import 靜默、對 indeterminate 印
//     單行 sanitized 診斷(控制字元 escape、超長截斷)
//   - caller 對 `indeterminate` 顯式 `process.exit(2)`(fail-closed;不 silent exit 0)
//
// 完整設計取捨與 wrapper e2e 見 plan file:
//   ~/.claude/plans/p2-3-defer-invoked-as-main-symlink-hardening.md

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export type IndeterminateReason =
  | "realpath-failed:self"
  | "realpath-failed:argv1"
  | "realpath-failed:both"
  | "selfurl-not-file"
  | "argv1-missing";

export type InvocationOutcome =
  | { kind: "main"; selfUrl: string; argv1: string }
  | {
      kind: "import-or-not-main";
      selfUrl: string;
      argv1: string;
      reason: "argv1-differs-from-selfurl";
    }
  | {
      kind: "indeterminate";
      selfUrl: string;
      argv1: string | undefined;
      reason: IndeterminateReason;
    };

/**
 * 純函式:判定當前 module 是否被當 main 直接執行。
 *
 * 兩端 realpath 都成功:
 *   - 兩端指同一 real path → `main`
 *   - 兩端指不同 real path → `import-or-not-main`(正常 import 情境)
 * realpath 或 fileURLToPath 失敗:一律歸 `indeterminate`,帶穩定 reason。
 *
 * `argv1 === undefined` 走 `indeterminate` reason=`argv1-missing`——真正 module
 * import 情境下 argv1 一律存在(node/tsx 都會設);undefined 是異常環境,
 * fail-closed 印 stderr 才安全。
 *
 * 本函式**不 throw、不寫 stderr、不寫 stdout**。所有輸出責任在 `reportIfNotMain`。
 */
export function detectInvocation(
  selfUrl: string,
  argv1: string | undefined,
): InvocationOutcome {
  if (argv1 === undefined) {
    return { kind: "indeterminate", selfUrl, argv1: undefined, reason: "argv1-missing" };
  }

  let selfPath: string;
  try {
    selfPath = fileURLToPath(selfUrl);
  } catch {
    return { kind: "indeterminate", selfUrl, argv1, reason: "selfurl-not-file" };
  }

  const argvResolved = path.resolve(argv1);

  let selfReal: string | null = null;
  let argvReal: string | null = null;
  try {
    selfReal = fs.realpathSync(selfPath);
  } catch {
    // ignore, handled below
  }
  try {
    argvReal = fs.realpathSync(argvResolved);
  } catch {
    // ignore, handled below
  }

  if (selfReal === null && argvReal === null) {
    return { kind: "indeterminate", selfUrl, argv1, reason: "realpath-failed:both" };
  }
  if (selfReal === null) {
    return { kind: "indeterminate", selfUrl, argv1, reason: "realpath-failed:self" };
  }
  if (argvReal === null) {
    return { kind: "indeterminate", selfUrl, argv1, reason: "realpath-failed:argv1" };
  }

  if (selfReal === argvReal) {
    return { kind: "main", selfUrl, argv1 };
  }
  return {
    kind: "import-or-not-main",
    selfUrl,
    argv1,
    reason: "argv1-differs-from-selfurl",
  };
}

/**
 * 集中式 reporter:對 outcome 決定是否印 stderr,回是否為 main。
 *
 * - `main`               → true, 完全靜默
 * - `import-or-not-main` → false, 完全靜默(被當 import 是正常,不吵)
 * - `indeterminate`      → false, stderr 印**恰一行** sanitized 診斷
 *
 * Sanitize 契約(對抗控制字元 / 超長值污染診斷):
 *   - 控制字元(< 0x20 含 \n \r \t)→ \xNN escape
 *   - 超過 200 字 → 截斷至 200 附 `...(truncated;len=<n>)`
 *   - undefined → 印字面 `<undefined>`
 *
 * Caller 對 `indeterminate` 應顯式 `process.exit(2)`——本 reporter 不呼叫 exit
 * (讓副作用集中在 caller、便於單元測試)。
 */
export function reportIfNotMain(
  outcome: InvocationOutcome,
  scriptLabel: string,
): boolean {
  if (outcome.kind === "main") return true;
  if (outcome.kind === "import-or-not-main") return false;

  const selfDiag = sanitizeDiag(outcome.selfUrl);
  const argvDiag = sanitizeDiag(outcome.argv1);
  process.stderr.write(
    `[invoked-as-main] ${scriptLabel} 判定 indeterminate(reason=${outcome.reason};selfUrl=${selfDiag};argv1=${argvDiag});略過 main\n`,
  );
  return false;
}

/**
 * 內部 sanitize:對 diag 值(路徑或 URL)去控制字元、截長度,保單行輸出。
 * export 只為 unit test 直接驗;不列入公開 API 契約。
 */
export function sanitizeDiag(value: string | undefined): string {
  if (value === undefined) return "<undefined>";
  const MAX = 200;
  const escaped = value.replace(/[\x00-\x1f\x7f]/g, (c) => {
    const hex = c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
    return `\\x${hex}`;
  });
  if (escaped.length <= MAX) return escaped;
  return `${escaped.slice(0, MAX)}...(truncated;len=${escaped.length})`;
}
