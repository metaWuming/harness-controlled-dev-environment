// tests/fixtures/invoked-as-main-wrapper/check-control-catalog-wrapper.mjs
//
// e2e case #3 / case #4 wrapper — **2-step dynamic import**
// (P2#3 defer ①② 後續遷移 Phase 8):
//
// check-control-catalog.ts 頂層 static-import render-control-catalog.ts;render-control-catalog
// 現已遷到 invoked-as-main lib(Phase 8 同 commit),它的頂層在 dangling argv1 下會歸
// indeterminate → 先觸發 exit(2) label=render-control-catalog → check-control-catalog
// 頂層根本沒跑到、case #4 精確 label 斷言失敗。
//
// 修法(2-step):
//   步驟 A:在**正常 wrapper argv1** 下先 dynamic import render-control-catalog 讓 module cache
//   步驟 B:case #4 才改 argv1 dangling
//   步驟 C:dynamic import check-control-catalog
//          → static import render-control-catalog 拿 cache(不重跑頂層)
//          → check-control-catalog 頂層真的跑、自己觸發 exit(2)、label 對到自己

import { fileURLToPath, pathToFileURL } from "node:url";

const renderPath = fileURLToPath(new URL("../../../scripts/render-control-catalog.ts", import.meta.url));
const target = fileURLToPath(new URL("../../../scripts/check-control-catalog.ts", import.meta.url));

// 步驟 A:先 cache render-control-catalog(正常 argv1 → import-or-not-main、reporter 靜默)
await import(pathToFileURL(renderPath).href);

// 步驟 B:case #4 改 dangling
if (process.env.IAM_DANGLING === "1") {
  process.argv[1] = "/tmp/definitely-does-not-exist-" + Date.now() + "/dangling.ts";
}

// 步驟 C:import target → static import render-control-catalog 拿 cache、目標頂層再跑
await import(pathToFileURL(target).href);
