// tests/fixtures/invoked-as-main-wrapper/check-baseline-governance-wrapper.mjs
//
// e2e case #3 / case #4 wrapper — **3-step dynamic import**
// (P2#3 defer ①② 後續遷移 Phase 7):
//
// check-baseline-governance.ts 頂層 static-import check-bookkeeping-commit + check-no-source-terms;
// 若 wrapper 直接 dangling → 三支頂層都會 dangling → 先執行到的 module 先觸發 exit(2),
// label 錯鎖到 check-bookkeeping-commit 或 check-no-source-terms、case #4 精確 label 失敗。
//
// 修法(3-step):
//   步驟 A:在**正常 wrapper argv1** 下先 dynamic import check-bookkeeping-commit 讓 module cache
//   步驟 A2:同前 cache check-no-source-terms
//   步驟 B:case #4 才改 argv1 dangling
//   步驟 C:dynamic import check-baseline-governance
//          → 靜態 imports 拿 cache(不重跑頂層)
//          → check-baseline-governance 頂層真的跑、觸發自己的 exit(2)、label 對到自己

import { fileURLToPath, pathToFileURL } from "node:url";

const bookkeepingPath = fileURLToPath(new URL("../../../scripts/check-bookkeeping-commit.ts", import.meta.url));
const noSourceTermsPath = fileURLToPath(new URL("../../../scripts/check-no-source-terms.ts", import.meta.url));
const target = fileURLToPath(new URL("../../../scripts/check-baseline-governance.ts", import.meta.url));

// 步驟 A + A2:先 cache 靜態依賴(正常 argv1 → import-or-not-main、reporter 靜默)
await import(pathToFileURL(bookkeepingPath).href);
await import(pathToFileURL(noSourceTermsPath).href);

// 步驟 B:case #4 改 dangling
if (process.env.IAM_DANGLING === "1") {
  process.argv[1] = "/tmp/definitely-does-not-exist-" + Date.now() + "/dangling.ts";
}

// 步驟 C:import 目標 → 靜態依賴拿 cache、目標頂層真跑
await import(pathToFileURL(target).href);
