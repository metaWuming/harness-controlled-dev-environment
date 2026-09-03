// tests/fixtures/invoked-as-main-wrapper/check-mutation-specs-wrapper.mjs
//
// e2e case #3 / case #4 共用 wrapper — 同 mutate-wrapper.mjs 說明。
//
// ⚠️ 特別處理 check-mutation-specs → mutate 的 static import chain
// (Codex Step 4 round 1 P1):
// - check-mutation-specs.ts 頂層 `import { applyMutation, ... } from "./mutate"`
//   會讓 ESM 先執行 mutate.ts 頂層。
// - 若 wrapper 一開始就把 argv1 改 dangling 再 dynamic import check-mutation-specs,
//   mutate 頂層 detectInvocation 會**先**看到 dangling → 先觸發 exit(2)、
//   label=mutate → check-mutation-specs 頂層根本沒跑到。
//   → 這樣 case #4 表面綠但根本沒驗到 check-mutation-specs 自己的 caller exit(2) branch,
//     刪 check-mutation-specs 的 exit(2) 也殺不到 → gate 回 silent 0(fail-open)。
//
// 修法(2 步 dynamic import):
//   步驟 A:在**正常 wrapper argv1** 下先 dynamic import mutate、
//          讓 mutate module 頂層跑完並被 ESM 快取(outcome=import-or-not-main、
//          reporter 靜默、什麼都不會發生)。
//   步驟 B:把 argv1 改 dangling(若 case #4)。
//   步驟 C:dynamic import check-mutation-specs。它的 static import mutate 拿 cache
//          (不重跑頂層),接著執行 check-mutation-specs 自己的頂層 →
//          detectInvocation 看到 dangling → 觸發自己的 caller exit(2)、
//          label=check-mutation-specs → case #4 精確斷言可鎖住這個 branch。

import { fileURLToPath, pathToFileURL } from "node:url";

const mutatePath = fileURLToPath(new URL("../../../scripts/mutate.ts", import.meta.url));
const target = fileURLToPath(new URL("../../../scripts/check-mutation-specs.ts", import.meta.url));

// 步驟 A:先讓 mutate 在正常 argv1 下 module-cache(outcome=import-or-not-main、靜默)
await import(pathToFileURL(mutatePath).href);

// 步驟 B:case #4 才改 dangling
if (process.env.IAM_DANGLING === "1") {
  process.argv[1] = "/tmp/definitely-does-not-exist-" + Date.now() + "/dangling.ts";
}

// 步驟 C:import 目標 → static import mutate 拿 cache、目標頂層再跑
await import(pathToFileURL(target).href);
