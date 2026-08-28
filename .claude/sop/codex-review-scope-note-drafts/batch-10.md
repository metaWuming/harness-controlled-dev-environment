# Review scope — 批 10 harness-backsync TODOS P3 全部收乾 (final)

## 本 PR 明確排除

- 同 D0-D5 defer 清單（見 plan file）
- workflow yml e2e test harness（本 sprint 不含,pre-existing batch 8/9 defer）
- 批 7 Step 5 F5（hook vs checker 第 3 段對齊 e2e）散文級預備繼續
- 追溯搬 batch-N.md 到 archive（archival 政策生效於未來 sprint,不追溯）
- **重新討論 D0 develop-policy 方向**：Owner 已拍板 A（見批 10 plan 詳述）
- **workflow-level env expression 是否可靠**：pre-existing batch 6-8 workflow yml 已多次驗證同 pattern

## 本 PR 拆刀策略

批 10 = 收乾批 9 (#34) defer 進 TODOS.md P3 的三條 finding。**Owner 拍板本 sprint 全部結束、不再 defer**。

- Phase A：workflow-level `env: DELIVERY_REFS` 常數（機械化 SSOT）+ D0 拍板 policy A（兩處都不加 develop）
- Phase B：`check-todos-markers.ts` 抽 `acknowledgeSelfPr` pure fn（帶 `< 1e9` 對稱守）+ 7 unit test

⚠️ scope note 刻意不列 commit SHA 清單——批 8 round 4/5 self-referential 死循環教訓。

## 本 PR scope 內請找

- **workflow-level env 收兩 step 是否漂**：TODOS Markers Check 移除的 batch 6 「belt-and-suspenders」註解(set-head 失敗仍能 fetch default_branch)敘述由 workflow-level env 承接、是否還完整?兩 step 的 `MARKER_SELF_PR` step-level env 是否有應該提到 workflow-level 的 downstream?
- **D0 policy A 拍板 workflow yml 註解**：註解說「GitFlow importer 客製 workflow yml 覆蓋常數即可」——具體怎麼覆蓋（覆蓋 workflow-level env、還是覆蓋 step-level env、還是 fork 整支 workflow）?註解缺 explicit 指引?
- **抽 pure fn `acknowledgeSelfPr` 契約完整性**：
  - docstring 說「單一入口、兩 script 讀 MARKER_SELF_PR 要一致」——check-no-source-terms.ts 的等價邏輯是否有機會也用同 pure fn（DRY）?若不用、如何保證未來兩處驗證同步不漂?
  - `Number.isInteger(42.0)` 回 true——test 內有斷言此行為（`acknowledgeSelfPr('42.0')` returns 42）,是否 GitHub Actions env `github.event.pull_request.number` 展開會給 `"42.0"` 這種格式?若不會,此測試斷言是否值得留（audit trail 或 misleading）?
- **Phase B call site 有無另守**：批 5 教訓「純函式測了、CLI 接線沒守」——`main()` 的 `if (selfPr !== null) merged.add(selfPr)` 是否有 e2e 覆蓋?若無、pure fn 通過但 main() 接線斷掉會靜默失敗
- **batch-10.md 本 scope note 內容有無 self-referential 漏洞**（批 8 R4/R5 死循環教訓）
