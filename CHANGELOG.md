# Changelog

格式依 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/);版本依 SemVer。
每個 milestone 收尾時更新本檔、`package.json` 版本與 `docs/MIGRATION.md`,merge 後由 Owner 打 annotated tag
(tag 訊息寫 breaking / 導入步驟 / 對應 PR 編號;本檔刻意不寫 PR 編號,避免下游採用者的去識別化掃描把它當未知引用)。

## [Unreleased]

### Changed
- `check:todos` 與 `check:no-source-terms` 的交付 ref 來源改走共用契約 `scripts/lib/delivery-refs.ts`:origin/HEAD 目標須為正規、可解、且宣告在 `harness.config.json` `deliveryBranches` 的 origin 分支;env `DELIVERY_REFS` 每條須為 `origin/<已宣告分支>` 且為 origin/HEAD 祖先。**移除** `origin/develop` 與本地 `main` / `develop` fallback;任何拒絕印原因碼並 exit 2(不再靜默跳過)。兩支 checker 現在**必須**能讀到 `scripts/harness.config.json`。

### Added
- `npm run check:mutation-specs` + CI step「Mutation Spec Drift Check」(CTRL-CI-013):對 `scripts/mutations/*.json` 每條探針驗 `find` 樣本仍能在目標原始碼精準對上,不跑 mutation。spec 檔與目標檔都先經 `mutate.ts` 的 `checkTarget` 取 bytes(symlink / 未追蹤 → exit 2 無法判定;內容漂移 → exit 1)。

## [0.2.0] — 2026-09-02 — Milestone A:Consistency Foundation

主線可自證、模板／已導入模式不可混淆、所有控制措施標明強度(不變量 I1 / I2 / I3 / I4 / I6)。
四支 sprint:A1(主線自我 gate)、A1.1(A1 review residual)、A2(宣告式 mode + adoption readiness)、A3(control catalog)。

### Added
- `scripts/harness.config.json`(**schemaVersion 2**):宣告式 `mode`(`template` / `adopted`)、`projectId`、`protectedBranches`、`deliveryBranches`、`requiredAgentAdapters`、`githubGovernanceRequired`、`mergeStrategy`;fail-closed loader `scripts/lib/harness-config.ts`(無偵測、無預設、無 env override;字面分支名文法)。
- `npm run check:adoption`(`scripts/check-adoption-readiness.ts`)+ CI step「Adoption Readiness Check」:template mode 逐條列 exception、adopted mode 對 placeholder / 空表 / 骨架 / 分支政策不一致 fail-closed;A5.ci.if 驗三處 delivery-branch `if:` 行。
- `scripts/control-catalog.json`(正本)+ `docs/CONTROL-CATALOG.md`(渲染)+ `npm run check:catalog` + CI step「Control Catalog Check」:30 條控制措施分五級(hard-automated / soft-automated / manual-mandatory / advisory / periodic-governance),ci.yml step 與 catalog 雙向一一對應、渲染逐位元組一致。
- `npm run check:baseline-governance`(`scripts/check-baseline-governance.ts`)+ CI step「Baseline Governance Check」(pull_request only):source-term baseline 只能在「只動 config + ADR + bookkeeping」的 PR 內往前推到 merge-base 祖先;base 用 PR 的 base 分支;同 repo PR 由 CI 另傳 `--head`,head ∈ merge-base 那側宣告的 `protectedBranches`(promotion PR)→ 明文 SKIPPED;fork PR 永不豁免;任何無法判定(base 解不開 / shallow / config 壞)→ UNDETERMINED exit 2。
- `scripts/source-term-baseline.json` + canonical ADR(`docs/architecture/` 下的 source-term history baseline 決策紀錄;完整路徑由位置＋數量鎖管理,本檔刻意不寫):history diff scan 的 cutover、三種 repo 情境、baseline 變更授權、已知限制、長命 pre-baseline 分支清理程序。
- `scripts/cso-trigger.config.ts` 的 `CSO_NOT_APPLICABLE`:adopted mode 下沒有路徑的域須明文宣告理由。
- mutation spec:`scripts/mutations/source-term-diff-scan.json`(29)、`adoption-readiness.json`(20)、`control-catalog.json`(14)、`baseline-governance.json`(11)。

### Changed
- `check-no-source-terms.ts` history diff scan 由「每 rev 3 次 git show + 3 次 grep」改成分批 producer + 串流分桶;掃描語意與判定不變;13 項輸出格式旗標封閉契約。
- `tests/check-cso-trigger.test.ts` 路徑表完整性鎖改 always-on,依宣告 mode 分支(不再要求採用者取消註解)。
- 原 vitest G2 / G4(模板作者簿記)移到 `scripts/lib/template-governance.ts`,只在 template mode 由 `check:adoption` 執行;採用者的 `npm test` 不再被模板簿記擋。
- `CLAUDE.md` Part 4 的填寫註解改成可機驗格式說明(4.1 四個鍵、4.3 `npm run` 引用、4.5 反引號路徑、4.6 分支名 + `mergeStrategy`)。
- `docs/OVERVIEW.md` / `README.md` 不再寫死 CI step 數與行號引用;13 個 controls 的強度以 CONTROL-CATALOG 為正本。
- `.claude/memory/progress.md` 依歸檔慣例搬出舊 entry(`progress-archive/progress-2026-09.md`);canonical ADR 引用的位置＋數量表隨之更新。

### Breaking / 導入者要做的事
- **`harness.config.json` schemaVersion 1 一律拒收**(缺檔或 v1 → `check:adoption` exit 2);升級加 `mergeStrategy`、改 `schemaVersion: 2`。
- **CI 新增三個 step**(Adoption Readiness / Control Catalog / Baseline Governance);自訂 ci.yml 者要補上,且每個非 setup step 都要登錄在 `scripts/control-catalog.json`(否則 `check:catalog` 紅)。
- adopted mode 下三處 delivery-branch `if:` 行必須等於由 `deliveryBranches` 導出的期望行(出廠 ci.yml 含 `develop`,要嘛列進 `deliveryBranches`、要嘛拿掉)。
- 完整步驟見 [`docs/MIGRATION.md`](docs/MIGRATION.md)。

## [0.1.0] — 2026-08

初版 harness template:三層行為守則、Plan Mode 7 步 SOP、記憶層治理、git hooks 縱深、destructive guard、跨模型 review、
CSO 觸發判定與 mutation 探針、視覺關、CI 常駐閘門(gitleaks / typecheck / lint / audit / doc refs / doc size / TODOS markers / source-term / vitest)、週健檢、季 retro。
