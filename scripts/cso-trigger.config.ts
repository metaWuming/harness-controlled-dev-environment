// scripts/cso-trigger.config.ts
//
// /cso 觸發判定的「安全敏感路徑表」— 導入時必填(見 docs/ADOPTION.md)。
//
// ⚠️ 模板出廠狀態:**路徑表為空**。空表下 `scripts/check-cso-trigger.ts` **fail-closed
//   輸出 CSO_REQUIRED + exit 2**(2026-08 契約收攏:任何「無法判定」都必須回 2、
//   包含「尚未導入」)。導入時把你的 repo 內對應五個域的路徑填進來(每域下方有註解掉
//   的通用範例),然後啟用 tests/check-cso-trigger.test.ts 內註解掉的「路徑表完整性鎖」
//   測試。填完後空表路徑不再觸發、判定力才生效。
//
// 五個觸發域(語意來源=你的安全信任邊界文件;沒有就先寫一份再填表):
//   1. 金流       — 付款 / 訂單 / 定價 / 點數 / 折扣 / 庫存資產
//   2. PII        — 個資 / 認證 / 聯絡資料 / email / 帳號生命週期
//   3. 權限/IDOR/資產轉移 — 後台 / 租戶隔離 / 資產所有權變更 / service-role / middleware
//   4. audit-trail — 稽核紀錄寫入面
//   5. 橫切保守項  — 資料模型 / migration / unattended destructive cron
//   (另建議把「前台敏感進入點」— 直接組敏感請求的 checkout / auth / 會員中心頁 —
//    也列入對應域;純展示頁刻意不列,避免每個 UI sprint 都觸發。)
//
// 維護紀律:新增安全敏感模組時**同步加進本表**(完整性鎖測試會抓到域級失準,
// 但單檔漏列要靠 review 紀律)。

export type CsoDomain = '金流' | 'PII' | '權限/IDOR/資產轉移' | 'audit-trail' | '橫切保守項';

/**
 * 觸發域路徑表。pattern 對「repo 相對路徑」整串比對(RegExp.test)。
 * 順序無語意 — 一個檔案可命中多域,全部列出(給 /cso 聚焦提示)。
 */
export const CSO_TRIGGER_PATTERNS: { domain: CsoDomain; pattern: RegExp }[] = [
  // ── 金流(付款 / 訂單 / 定價 / 點數 / 折扣 / 庫存資產)──────────────────
  // { domain: '金流', pattern: /^src\/lib\/payment\// },
  // { domain: '金流', pattern: /^src\/app\/api\/(payment|orders)\// },

  // ── PII(個資 / 認證 / 聯絡資料)────────────────────────────────────
  // { domain: 'PII', pattern: /^src\/lib\/(auth|member|magic-link)\.ts$/ },
  // { domain: 'PII', pattern: /^src\/app\/api\/(member|auth)\// },

  // ── 權限 / IDOR / 資產轉移(後台 / 租戶隔離 / 所有權變更)──────────────
  // { domain: '權限/IDOR/資產轉移', pattern: /^src\/app\/api\/admin\// },
  // { domain: '權限/IDOR/資產轉移', pattern: /^src\/(proxy|middleware)\.ts$/ },

  // ── audit trail ────────────────────────────────────────────────────
  // { domain: 'audit-trail', pattern: /^src\/lib\/audit-log\.ts$/ },

  // ── 橫切保守項(資料模型 / migration / unattended destructive cron)────
  // { domain: '橫切保守項', pattern: /^prisma\/schema\.prisma$/ },
  // { domain: '橫切保守項', pattern: /^src\/app\/api\/cron\// },
];
