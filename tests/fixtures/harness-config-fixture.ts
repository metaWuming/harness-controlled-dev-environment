// tests/fixtures/harness-config-fixture.ts — test-only fixture generator
//
// P2#2 defer ⑦:兩個 test 檔(check-no-source-terms.test.ts / check-todos-markers.test.ts)
// 原本各自定義一份輸出等價的 `harnessConfigJson`(source quote style 不同、
// 但 JSON.stringify 結果逐字相同)。schema 升版要改兩處、易漂。
// 抽到此共用 helper、兩 caller 改 named import。
//
// 🔴 **不 import production loader / config generator**:test-only fixture 不得引用被測實作,
// 否則兩者同源、schema 變化被測試 mask 掉(same-source 假綠)。此 helper 只硬編 JSON 結構、
// 與 `scripts/lib/harness-config.ts` 邏輯上獨立。schema 升版時兩處都要維護——這是刻意的:
// production 邏輯與 fixture output 各自表述、由 loader 對 fixture 的解析結果做 assertion。

/**
 * 產生 harness.config.json fixture 字串。
 *
 * 預設 fixture:template mode、`__TEMPLATE__` projectId、single deliveryBranch(caller 指定)、
 * protectedBranches = deliveryBranches(loader 要求 deliveryBranches ⊆ protectedBranches)。
 *
 * @param deliveryBranches 宣告在 fixture 的交付分支清單(通常單元素 `['main']`)
 */
export function harnessConfigJson(deliveryBranches: readonly string[]): string {
  // P2#2:交付 ref 契約讀 harness.config.json 的 deliveryBranches(靜態宣告);fixture 預設只宣告 main
  return JSON.stringify({
    schemaVersion: 2,
    mode: "template",
    projectId: "__TEMPLATE__",
    templatePackageName: "harness-controlled-dev-environment",
    // loader 要求 deliveryBranches ⊆ protectedBranches
    protectedBranches: [...deliveryBranches],
    deliveryBranches: [...deliveryBranches],
    requiredAgentAdapters: ["claude"],
    githubGovernanceRequired: false,
    mergeStrategy: "squash",
  });
}
