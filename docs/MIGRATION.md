---
title: MIGRATION — 版本升級步驟
type: guide
---

# Migration

> 每個 milestone 一段。步驟是給**已導入的下游專案**看的;新用 template 的專案直接照 [`ADOPTION.md`](ADOPTION.md) 走。
> 變更內容的完整清單見 [`../CHANGELOG.md`](../CHANGELOG.md)。

## 0.1 → 0.2(Milestone A)

### 1. `scripts/harness.config.json`:schemaVersion 1 → 2

- 加必要欄位 `"mergeStrategy"`,值選 `"squash"` / `"merge-commit"` / `"rebase"` / `"fast-forward"`。
- `"schemaVersion"` 改成 `2`。
- 0.2 的 loader **不接受 v1**(也不接受缺檔):`npm run check:adoption` 會 exit 2 並指到本節。這是刻意的 fail-closed,
  不做「v1 也收、缺欄位給預設」——那是 fallback,會讓 4.6 的檢查對沒宣告的專案靜默失效。
- 還沒有 config 的專案(0.1 之前 fork 的):照 [`ADOPTION.md`](ADOPTION.md) §0 建立整份 v2 config,明確選 mode。

### 2. `CLAUDE.md` §4.6

- 以反引號提到你宣告的 `mergeStrategy` 值(例:feature → develop `squash`);0.2 起 4.6 **不再**用關鍵字比對合併策略。

### 3. `.github/workflows/ci.yml`:三個新 step

自訂過 ci.yml 的專案要補(照模板的位置與註解):

| step 名(逐字) | 位置 | 條件 |
|---|---|---|
| `Adoption Readiness Check` | Doc Size Check 之後 | 無 |
| `Control Catalog Check` | Adoption Readiness Check 之後 | 無 |
| `Baseline Governance Check` | Fetch delivery refs 之後 | `if: github.event_name == 'pull_request'`;`--base=origin/$DEFAULT_BRANCH` 以 env 引號展開 |

- 三處 delivery-branch 的 `if:` 行(Fetch delivery refs / TODOS Markers / Source-term)在 adopted mode 會被 A5.ci.if 驗:
  必須逐字等於 `if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch)`
  再對 `deliveryBranches` 每個 b 接 ` || github.ref == 'refs/heads/<b>'`。出廠 ci.yml 含 `develop`——要嘛把 `develop` 列進
  `deliveryBranches`,要嘛從三行拿掉。

### 4. `scripts/control-catalog.json`:登錄你的 CI step

- 0.2 起每個非 setup 的 ci.yml step 都要在 catalog 有一條 `hard-automated` control(`ciStep` 逐字等於 step 名),
  setup step 列進 `ciSetupSteps`;否則 `npm run check:catalog` 紅。這是設計:新增守門不登錄強度與 bypass,就不算控制措施。
- 改完 JSON 跑 `npm run catalog:render` 產生 `docs/CONTROL-CATALOG.md`(不要手改 md)。
- 沒有對應測試的 control 用 `"tested": ["untested"]` 誠實標;`manual-drill` 表示只做過人工演練。

### 5. `scripts/cso-trigger.config.ts`

- adopted mode 下五域各恰一種處置:有 pattern,或在 `CSO_NOT_APPLICABLE` 宣告理由(≥10 字)。
- 舊版要求「填完取消註解鎖測試」已作廢:鎖測試 always-on、依宣告 mode 分支。

### 6. 驗收

```bash
npm run check:adoption           # ADOPTED_MODE — READY
npm run check:catalog            # CATALOG_OK
npm test                         # 全綠;check-cso-trigger 的 template 分支 1 條 skipped 屬設計
```

### 回滾(0.2 → 0.1)

- 把 `harness.config.json` 改回 `schemaVersion: 1` 並刪 `mergeStrategy`;拿掉三個 CI step;刪 `scripts/control-catalog.json`
  與 `docs/CONTROL-CATALOG.md`。0.1 的 loader 只認 v1。
- 若你的專案已在 0.2 上把 baseline 往前推過(受 Baseline Governance Check 守門),回滾後那條守門消失、只剩人工授權——
  回滾前確認 `scripts/source-term-baseline.json` 的值仍是你要的。
