// tests/fixtures/invoked-as-main-wrapper/mutate-wrapper.mjs
//
// e2e case #3(import 情境)與 case #4(indeterminate)共用 wrapper
// (P2#3 defer ①② Phase 3):
//
// - env IAM_DANGLING=1:改 process.argv[1] 為 dangling 路徑 → target 頂層
//   detectInvocation 對 argv1 realpath 失敗 → indeterminate;預期 caller 顯式
//   process.exit(2) + stderr 有診斷(case #4)。
// - env IAM_DANGLING 未設:保留 wrapper 的 argv[1](wrapper 檔本身)→ target 頂層
//   兩端真實檔不同 → import-or-not-main;預期 reporter 完全靜默、target main 不執行
//   (case #3)。

import { fileURLToPath, pathToFileURL } from "node:url";

if (process.env.IAM_DANGLING === "1") {
  process.argv[1] = "/tmp/definitely-does-not-exist-" + Date.now() + "/dangling.ts";
}

const target = fileURLToPath(new URL("../../../scripts/mutate.ts", import.meta.url));
await import(pathToFileURL(target).href);
