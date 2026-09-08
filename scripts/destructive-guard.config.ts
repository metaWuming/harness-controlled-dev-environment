// scripts/destructive-guard.config.ts
//
// Sprint 20 C2 引入:destructive-guard 的「declared target identity allowlist」與
// 「declared impact-scope bound」宣稱。**adopter 導入時填**(見 docs/ADOPTION.md §5.1)。
//
// ⚠️ 誠實定位(承 CTRL-GUARD-001 notes):本檔加碼是**accident interlock 加碼**、
//    非 production security boundary。真 runtime enforcement(actual DB connection
//    fingerprint / SQL 攔截 / affected count 實查)超本 sprint scope、需未來 sprint runtime seam。
//
// Catches(declaration-level mismatch alarm):
//   - DATABASE_URL declared hostname 不在 adopter allowlist → guard abort
//   - DATABASE_URL declared dbname 不在 adopter allowlist(若 declared)→ guard abort
//   - --max-rows CLI flag 未帶 / 超 adopter-declared bound / 非正整數 → guard abort
//
// Does NOT catch(明列 threat model 限制):
//   - DNS/CNAME rewrite(URL hostname 顯示 allowlist、實際連 prod)
//   - Managed DB proxy identity spoof
//   - Adopter caller runtime SQL bug(誤刪錯 table / 誤大 WHERE clause)
//   - Adopter caller 未 enforce actual affected count ≤ maxRows(guard 只驗 CLI flag、非 DB 實查)
//
// 出廠狀態:`EXPECTED_TARGET_IDENTITY = null`(fail-closed;adopter 導入時填)。

export type ExpectedTargetIdentity = {
  /** 允許的 DB hostname list;compare 前 guard 會 lowercase-normalize、adopter 填的大小寫不重要 */
  allowedHosts: string[];
  /** 允許的 DB name list(optional、undefined 表示不驗 dbname);exact match、guard 不做 percent-decode 之外 normalize */
  allowedDbNames?: string[];
} | null;

/**
 * 出廠 null:adopter 導入時改成 declared allowlist、如
 *   `{ allowedHosts: ['localhost', 'staging.myshop.local'], allowedDbNames: ['myshop_staging'] }`
 * 詳見 docs/ADOPTION.md §5.1 runbook。
 */
export const EXPECTED_TARGET_IDENTITY: ExpectedTargetIdentity = null;
