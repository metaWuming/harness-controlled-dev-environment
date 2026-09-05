---
title: MIGRATION — 版本升級步驟
type: guide
---

# Migration

> 每個 milestone 一段。步驟是給**已導入的下游專案**看的;新用 template 的專案直接照 [`ADOPTION.md`](ADOPTION.md) 走。
> 變更內容的完整清單見 [`../CHANGELOG.md`](../CHANGELOG.md)。

## [Unreleased] — 移除 `DELIVERY_REFS` env 通道(breaking)

- **變了什麼**:`check:todos` 與 `check:no-source-terms` 的交付證據**唯一來源是受驗的 `origin/HEAD`**(目標須為 `refs/remotes/origin/<name>`、正規、可解、且 `<name>` 宣告在 `scripts/harness.config.json` 的 `deliveryBranches`;實作與原因碼見 `scripts/lib/delivery-refs.ts`)。env `DELIVERY_REFS` 已移除、不再被讀;workflow-level `DELIVERY_REFS` 已從 `ci.yml` 刪除。`MARKER_SELF_PR` 通道未變。
- **為什麼**:祖先契約(上一版)下,任何通過驗證的 env 候選都是 origin/HEAD 的祖先,`git log` 集合不變、加不進任何 PR 號;通道只剩「驗證會不會拒絕」與可被 tag / 遮蔽觸發的 fail-closed DoS 面。
- **導入者要做什麼**:若你的 workflow 自訂了 `DELIVERY_REFS`,刪掉即可(留著也會被靜默忽略)。**換交付線**(把 delivery 從 default branch 擴到其他 branch、或把出廠 `develop` 拿掉)不是單一改動、涉及 `deliveryBranches`、`ci.yml` 的 `on:` / 三處 `if:` / Fetch step、`push` event 下無 `MARKER_SELF_PR` 豁免、Source-term scan `allowedPrs` 字面判定等邊角;本版**提供 minimum viable runbook**(見附錄 A.1)、但不推薦此操作—— default branch 作唯一交付線最穩,有強烈需求再走 runbook + 個案審。
- **回滾**:`git revert` 本 PR 的 squash commit,env 通道與其測試 / 探針整組還原;無 config schema 變更。

### A.1 附錄:換交付線 runbook(minimum viable、非推薦操作)

> **設計立場**:本 runbook 是 P3 delivery-refs 移除集合 defer ① 的 minimum viable 交付。**不宣稱覆蓋所有邊角情境、不 permanent、不 automation**;每步的 acceptance 由既有 gate 提供 machine-verifiable evidence。如你不確定是否需要換交付線 = **不要換**(default branch 作唯一交付線是最穩配置)。
>
> **前置**:read `scripts/lib/delivery-refs.ts` 契約(origin/HEAD 目標須正規、可解、宣告在 `deliveryBranches`)、`scripts/check-adoption-readiness.ts` L499-524 A5.ci.if 契約(三處 delivery-branch `if:` 行必須逐字等於 `expectedCiIfLine(deliveryBranches)`)。**注意**:`push` event 下無 `MARKER_SELF_PR` 豁免(check-todos-markers / check-no-source-terms 若 base 分支 push 時進 CI,可能無 pre-merge citation);Source-term scan 只對 `PR #N` / `pull/N` **字面**判 `allowedPrs`(見 `scripts/check-no-source-terms.ts`)—— 這些邊角換交付線時可能撞到、runbook 不保證 zero-touch。

**步驟(每步附 acceptance evidence source)**:

1. **前置決策**:確認新交付分支是 default branch;若不是,明列新的 default branch 是什麼、目前 `protectedBranches` 清單。
2. **修 `scripts/harness.config.json`**:`deliveryBranches` 加入 / 改成新 branch name(若舊 `develop` 不作交付線就移除);`protectedBranches` 需含所有 delivery branches(否則 A5 集合不等);保留 `mergeStrategy` / `mode` / 其他欄位。
3. **修 `.github/workflows/ci.yml`**:三處 `if:` 行(Fetch delivery refs / TODOS Markers Check / Source-term scan)必須逐字等於由新 `deliveryBranches` 導出的 `expectedCiIfLine`(見 `expectedCiIfLine`,實作位置與 range citation 在 `scripts/check-adoption-readiness.ts` L499-524);若 push event 上要交付線 CI 跑,`push.branches` 集合亦需含新分支——**注意** `push.branches` 由 `A5.ci.push` 對 `protectedBranches` 驗集合(非 `deliveryBranches`),所以新交付分支必須依步驟 2 同步納入 `protectedBranches` 才會 A5 綠。
4. **修 pre-commit / pre-push hooks**(若新交付分支不在既有 `protectedBranches`)。
5. **驗證 gates**(每步 acceptance evidence):
   - `npm run check:adoption`(A5 集合精確等 / A5.ci.if 三處逐字等)
   - `npm run check:baseline-governance`(promotion PR 對應 protectedBranches)
   - `npm run check:catalog`(CI step 對應 catalog)
   - `npm run check:no-source-terms`(Source-term scan 對新交付 branch 的 `allowedPrs` 邊界)
   - `npm run check:doc-refs`(檔案引用未斷)
   - `npm test` 全 suite:`tests/check-adoption-readiness.e2e.test.ts` 的 `CI_ADOPTED` fixture pattern + 本 sprint 加的 `tests/p3-runbook-fixture.e2e.test.ts`(defer ① evidence)覆蓋 minimum acceptance
6. **runtime evidence**(post-merge、非本 PR 內驗):squash merge 到 default branch 後、`push` event on 新交付 branch 是否觸發應有 workflow。**注意**:`push` event 下無 `MARKER_SELF_PR` 豁免,若新交付 branch 的 push CI 卡在 TODOS Markers Check / Source-term scan,需另加 PR-controlled marker 或 pause 交付、依個案決。
7. **導入完成後**:更新 `docs/CONTROL-CATALOG.md`(若 catalog 涉及)、`README.md`(若寫死 branch);Owner 稽核 branch protection / ruleset(GOV-005)確保新交付分支必經 PR。

**如何撤回**:`git revert` 本 runbook PR 的 squash commit,回到 default-branch-only 交付線;跑步驟 5 所有 gate 綠 = 撤回完成。

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
  再對 `deliveryBranches` 每個 b 接 ` || github.ref == 'refs/heads/<b>'`。**`deliveryBranches` 是允許的 `origin/HEAD` 目標白名單**(delivery evidence 語意、見 `scripts/lib/delivery-refs.ts`);多列或少列都會改 A5.ci.if 期望。出廠 ci.yml 三處 `if:` 行預期 `deliveryBranches` = `[main, develop]`;**若你的專案不需要 `develop` 作交付線**,從 `deliveryBranches` 移除 `develop` 並同時從三處 `if:` 行拿掉 `|| github.ref == 'refs/heads/develop'`(完整步驟見本檔 `[Unreleased]` 段附錄 A.1「換交付線 runbook」)。

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
