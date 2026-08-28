// scripts/lib/marker-self-pr.ts
//
// MARKER_SELF_PR env 讀取契約(批 10 P2-1:兩 script 讀 MARKER_SELF_PR 的
// 單一入口 SSOT,擋跨檔漂移)。
//
// **緣起**:批 9 Step 5 二輪 F-round23-5(conf 4)發現 check-no-source-terms.ts
// 與 check-todos-markers.ts 對同一 MARKER_SELF_PR env 驗證不對稱——一處有
// `< 1e9` 上限、一處沒有。批 10 Phase B 起初把 acknowledgeSelfPr 抽在
// check-todos-markers.ts 內為 export pure fn(單 script 內部 SSOT),但
// codex round 1 抓到「其實另一 script 仍複製同邏輯、跨檔驗證不對稱」——
// 真正的單一入口要建 shared lib,兩 script 都 import。本檔即該 shared lib。
//
// **合約**(對稱 check-no-source-terms.ts 與 check-todos-markers.ts 兩者需要):
//   - Number.isInteger:擋 NaN(如 "abc")、浮點(如 "1.5")
//   - > 0:擋 0、負值、空字串轉出的 0
//   - < 1e9:上限對稱 parseAllowedPrs / extractPrRefsFromLine 對 subject
//     / hit line 的 PR # 限制,兩處驗證要同步
// 三守合起來、單一入口 → 未來任何一邊改動 coercion 或邊界時、只需改本檔一處。

/**
 * 解析 MARKER_SELF_PR env 值,回傳可信 self-PR # 或 null。
 *
 * @param rawEnv - process.env.MARKER_SELF_PR 的值(undefined / string)
 * @returns 合法 self-PR # 或 null(env 未設 / 非法值 / 超上限)
 *
 * @example
 * acknowledgeSelfPr("42")         // 42
 * acknowledgeSelfPr(undefined)    // null(env 未設)
 * acknowledgeSelfPr("")           // null(non-PR event 展開為空字串)
 * acknowledgeSelfPr("abc")        // null(NaN)
 * acknowledgeSelfPr("1.5")        // null(浮點被 Number.isInteger 擋)
 * acknowledgeSelfPr("9999999999") // null(超 1e9 上限)
 */
export function acknowledgeSelfPr(rawEnv: string | undefined): number | null {
  const selfPr = Number(rawEnv);
  if (Number.isInteger(selfPr) && selfPr > 0 && selfPr < 1e9) return selfPr;
  return null;
}
