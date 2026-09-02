---
title: MIGRATION — 版本升級步驟
type: guide
---

# Migration

> 每個 milestone 一段。步驟是給**已導入的下游專案**看的;新用 template 的專案直接照 [`ADOPTION.md`](ADOPTION.md) 走。
> 變更內容的完整清單見 [`../CHANGELOG.md`](../CHANGELOG.md)。

## [Unreleased] — 移除 `DELIVERY_REFS` env 通道(breaking)

- **變了什麼**:`check:todos` 與 `check:no-source-terms` 的交付證據**唯一來源是受驗的 `origin/HEAD`**(目標須為 `refs/remotes/origin/<name>`、正規、可解、且 `<name>` 宣告在 `scripts/harness.config.json` 的 `deliveryBranches`)。兩支腳本**不再讀任何 env**;workflow-level `DELIVERY_REFS` 已從 `ci.yml` 刪除。
- **為什麼**:祖先契約(上一版)下,任何通過驗證的 env 候選都是 origin/HEAD 的祖先,`git log` 集合不變、加不進任何 PR 號;通道只剩「驗證會不會拒絕」與可被 tag / 遮蔽觸發的 fail-closed DoS 面。
- **導入者要做什麼**:若你的 workflow 自訂了 `DELIVERY_REFS`,**刪掉即可**(留著也會被靜默忽略,不會壞)。若你依賴它把 `origin/develop` 或 release 線的 merge 算作證據:**現在沒有任何通道**——交付證據 = `git remote set-head` 指向的 default branch。CI 內 `origin/HEAD` 由 `git remote set-head origin -a` 決定,**等於 GitHub repo 的 default branch**,導入者無法在 CI 內另指;要換交付線就改 GitHub default branch,並把它宣告在 `deliveryBranches`。GitFlow 專案注意:push 到 `develop` 時三個 step 仍會跑,但證據只來自 default branch(policy A 既有行為)。
- **回滾**:`git revert` 本 PR 的 squash commit,env 通道與其測試 / 探針整組還原;無 config schema 變更。

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
| `Baseline Governance Check` | Fetch delivery refs 之後 | `if: github.event_name == 'pull_request'`;先 `git fetch origin "$BASE_REF:refs/remotes/origin/$BASE_REF"`,再 `--base=origin/$BASE_REF`(PR 的 base 分支);同 repo PR 另傳 `--head=$HEAD_REF`(`HEAD_SAME_REPO` 為 true 時),fork PR 不傳 |

- 三處 delivery-branch 的 `if:` 行(Fetch delivery refs / TODOS Markers / Source-term)在 adopted mode 會被 A5.ci.if 驗:
  必須逐字等於 `if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch)`
  再對 `deliveryBranches` 每個 b 接 ` || github.ref == 'refs/heads/<b>'`。出廠 ci.yml 含 `develop`——要嘛把 `develop` 列進
  `deliveryBranches`,要嘛從三行拿掉。

### 4. `scripts/control-catalog.json`:登錄你的 CI step

- 0.2 起每個非 setup 的 ci.yml step 都要在 catalog 有一條 `hard-automated` control(`ciStep` 逐字等於 step 名),
  setup step 列進 `ciSetupSteps`;否則 `npm run check:catalog` 紅。這是設計:新增守門不登錄強度與 bypass,就不算控制措施。
- 改完 JSON 跑 `npm run catalog:render` 產生 `docs/CONTROL-CATALOG.md`(不要手改 md)。
- 沒有對應測試的 control 用 `"tested": ["untested"]` 誠實標;`manual-drill` 表示只做過人工演練。

### 4.5 升級順序(GitFlow)

- 先單獨把 v2 升級 promote 到每個保護分支(develop → main),**再**做 baseline 推進 PR。promotion 豁免讀的是 merge-base
  那側的 config;若 main 還是 v1、而 develop → main 的 promotion PR 同時帶 baseline 推進,mb 側解析失敗 → 不豁免 → 紅。
  未來 schemaVersion 再升時同樣順序。

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
檔,`check:adoption` 仍會 exit 2。回滾必須連 harness 自己的程式一起回到 0.1,**唯一支援的做法是整段 revert**:

1. 找出你 repo 內 Milestone A 的 squash commit(A1 / A1.1 / A2 / A3 四支;PR 編號見 tag `v0.2.0` 訊息;本模板在
   Milestone A 之前沒有打過 tag)。
2. 由新到舊逐一 `git revert <sha>`(A3 → A2 → A1.1 → A1)。這會同時還原 loader / checker / CI step / catalog / docs,
   並移除 A2 / A3 才新增的檔(`scripts/harness.config.json`、`scripts/lib/harness-config.ts`、
   `scripts/check-adoption-readiness.ts`、catalog 與 baseline-governance 相關檔都是 0.1 沒有的,不能用 checkout 從 0.1 還原)。
3. revert 衝突時保留你自己的專案內容(`CLAUDE.md` Part 4、你的 ci.yml 自訂 step),harness 檔取 revert 側。
4. 驗證只用 0.1 就存在的指令:

```bash
npm ci && npm run typecheck && npm run lint && npm test && npm run check:no-source-terms
```

(`check:adoption` / `check:catalog` / `check:baseline-governance` 在 0.1 不存在,不得列為回滾驗收。)

- 若你在 0.2 上把 baseline 往前推過(受 Baseline Governance Check 守門),回滾後那條守門消失、只剩人工授權——
  回滾前確認 `scripts/source-term-baseline.json` 的值仍是你要的。
