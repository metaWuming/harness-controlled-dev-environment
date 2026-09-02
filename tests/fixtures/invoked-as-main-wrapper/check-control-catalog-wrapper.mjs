// tests/fixtures/invoked-as-main-wrapper/check-control-catalog-wrapper.mjs
// e2e case #3 / case #4 共用 wrapper — 同 mutate-wrapper.mjs 說明。
//
// ⚠️ **defensive note**(Step 5 F2,conf 7):`check-control-catalog.ts` 頂層 static
// import `render-control-catalog.ts`。目前 render-control-catalog 仍用**舊式**
// isMain 判定(pathToFileURL 無 realpath),dangling argv1 下 pathToFileURL 不觸發
// realpath、比對結果為 false 就 fall-through、不觸發 process.exit(2) → 本 wrapper
// 目前**巧合**能單步 import 就跑到 check-control-catalog 頂層。
// **P3 未來把 render-control-catalog 遷到 invoked-as-main lib 之後,它的頂層
// detectInvocation 也會歸 indeterminate → 先觸發 exit(2) label=render-control-catalog
// → check-control-catalog 頂層根本沒跑到、case #4 精確 label 斷言失敗**。
// 屆時本 wrapper **必須**改成 2-step dynamic import(先在正常 argv1 下 import
// render-control-catalog 讓它 module-cache 完成、再改 dangling、再 import 目標),
// 參考 check-mutation-specs-wrapper.mjs 的 2-step 手法。

import { fileURLToPath, pathToFileURL } from "node:url";

if (process.env.IAM_DANGLING === "1") {
  process.argv[1] = "/tmp/definitely-does-not-exist-" + Date.now() + "/dangling.ts";
}

const target = fileURLToPath(new URL("../../../scripts/check-control-catalog.ts", import.meta.url));
await import(pathToFileURL(target).href);
