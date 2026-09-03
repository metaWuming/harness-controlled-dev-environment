// scripts/lib/protectedbranches-drift.ts
//
// A3 defer ⑩ drift gate 的純函式核心:計算 protectedBranches 集合的
// added / removed diff。無 IO、無 throw、對輸入為 string[] 保守處理。
//
// **合約**(對稱 check-protectedbranches-drift.ts CLI):
//   - 輸入:兩側 protectedBranches 字面陣列(來自各自 parseHarnessConfig 結果)
//   - 輸出:{ added, removed } 集合差
//     - added:head 有 / base 無(**擴大** = 治理擴權、需 gate)
//     - removed:base 有 / head 無(縮小 = 縮權、不擋)
//   - 順序 / 重複由集合語意收(用 Set 去重)
//   - 不變:兩側都用既有 parseHarnessConfig,型別 string[](已由 schema 驗)
//
// 完整設計取捨與 CLI trust-boundary 見 plan file:
//   ~/.claude/plans/a3-defer-10-protectedbranches-drift.md

export interface DriftResult {
  added: string[];    // head 新增(= head - base、擴大)
  removed: string[];  // base 移除(= base - head、縮小)
}

/**
 * 純函式:計算兩側 protectedBranches 集合的 added / removed。
 *
 * 集合語意:去重、順序不影響。
 * `added.length > 0` = 擴大、CLI 依 fail-closed 契約 exit 2。
 * `removed.length > 0` = 縮小、CLI 允許(縮權、非治理擴權)。
 * 重排(順序改、內容不變)= added=[] removed=[]、不擋。
 *
 * 本函式**不 throw、不寫 stderr、不寫 stdout**。所有 IO / trust-boundary /
 * exit 判定責任在 CLI。
 */
export function diffProtectedBranches(
  base: readonly string[],
  head: readonly string[],
): DriftResult {
  const baseSet = new Set(base);
  const headSet = new Set(head);
  const added: string[] = [];
  for (const b of headSet) {
    if (!baseSet.has(b)) added.push(b);
  }
  const removed: string[] = [];
  for (const b of baseSet) {
    if (!headSet.has(b)) removed.push(b);
  }
  // 穩定順序方便診斷 / 測試
  added.sort();
  removed.sort();
  return { added, removed };
}
