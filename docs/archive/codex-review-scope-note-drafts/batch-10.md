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

## 本 PR scope 內請找(round 1 fix 後)

- **round 1 fix 是否引入新表面**:
  - 抽 shared lib `scripts/lib/marker-self-pr.ts` 兩 script 共用,import 路徑對嗎?tsc 認嗎?
  - check-todos-markers.ts 保留 `export { acknowledgeSelfPr } from ...` re-export + import as `_acknowledgeSelfPr`——export/import naming 是否有 stale 引用漂?
  - CLI e2e minimal makeRepo 用 `git init -b main` + 無 origin remote → buildMergedPrSet 走 last-resort local main fallback → merged set 空(P2-2 反例 case 依賴此),此依賴是否 fragile?
- **P2-2 e2e 正對照 fixture**:`# TODOS\n\n## P3\n\n### ✅ some completion (#42)\n- done\n` 是否觸發 completionClaim 對?若 parseTodosMarkers 對此 markdown 結構有邊界(某些 heading 格式不當 completion),case 可能誤綠
- **上輪 3 scope 是否有 regression**:workflow-level env / D0 policy 註解 / acknowledgeSelfPr 抽出
