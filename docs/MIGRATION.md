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

0.2 的 loader(`scripts/lib/harness-config.ts`)**只認 schemaVersion 2**;只把 config 改回 v1、刪三個 CI step 與 catalog
檔,`check:adoption` 仍會 exit 2。回滾必須連 harness 自己的程式一起回到 0.1,二選一:

**A. 整段 revert(建議)**:找出你 repo 內 Milestone A 的 squash commit(A1 / A1.1 / A2 / A3 四支;PR 編號見 tag `v0.2.0` 訊息),
由新到舊逐一 `git revert <sha>`。這會同時還原 loader / checker / CI step / catalog / docs;你自己填的 `harness.config.json`
與 `CLAUDE.md` Part 4 內容若在 revert 中衝突,保留你的內容但把 config 改回 v1 形狀(刪 `mergeStrategy`、`schemaVersion: 1`)。

**B. 從 0.1 的 commit 還原 harness 檔(不動你的專案碼)**:下面的 `v0.1.0` 是 0.1 最後一個主線 commit 的 tag;
本模板在 Milestone A 之前**沒有打過 tag**,若你的 repo 也沒有,改用 Milestone A 第一支 PR(A1)的 parent SHA(`git log --oneline` 找 A1 squash 的前一個 commit)。

```bash
git checkout v0.1.0 -- scripts/lib/harness-config.ts scripts/check-adoption-readiness.ts \
  scripts/lib/template-governance.ts tests/harness-config.test.ts tests/check-adoption-readiness.test.ts \
  tests/check-adoption-readiness.e2e.test.ts tests/check-cso-trigger.test.ts tests/check-doc-refs.test.ts \
  .github/workflows/ci.yml package.json docs/ADOPTION.md CLAUDE.md
git rm -q scripts/control-catalog.json docs/CONTROL-CATALOG.md scripts/lib/control-catalog.ts \
  scripts/render-control-catalog.ts scripts/check-control-catalog.ts scripts/check-baseline-governance.ts \
  tests/control-catalog.test.ts tests/render-control-catalog.test.ts tests/check-control-catalog.e2e.test.ts \
  tests/check-baseline-governance.e2e.test.ts scripts/mutations/control-catalog.json scripts/mutations/baseline-governance.json \
  docs/MIGRATION.md CHANGELOG.md
# harness.config.json:刪 mergeStrategy、schemaVersion 改 1(0.1 的 loader 只認 v1)
npm ci && npm run check:adoption && npm test
```

- 路徑 B 的清單以 `git diff --name-only <0.1 commit> v0.2.0` 為準(上面是 0.2.0 當下的清單;若你的 repo 在中間自訂過 ci.yml,
  改用 revert 路徑 A 再手動合併)。
- 若你在 0.2 上把 baseline 往前推過(受 Baseline Governance Check 守門),回滾後那條守門消失、只剩人工授權——
  回滾前確認 `scripts/source-term-baseline.json` 的值仍是你要的。
