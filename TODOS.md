---
title: TODOS
type: note
---

# TODOS

技術債、延後工作、未來迭代項目的中央追蹤表。
每項由哪個 review 產生、優先級、預估工時都要記清楚。

**格式:**
- 🔴 P1: 上線前必做,或會影響既有功能
- 🟡 P2: 上線後 1-3 個月內應處理
- 🟢 P3: 長期 / 有時間再做
- ⚪ IDEA: 未採用但想記下以備將來檢視

**Marker 治理公約**(由 `scripts/check-todos-markers.ts` CI gate 執行):
本檔任何**完成宣稱**(`✅` / 完工 / 已晉升)**必須引用交付 PR 號**(`(#N)` 或 `PR #N`)——
CI 會驗該 PR 有 merge 證據,防打錯號 / 投機性標 ✅。
`[🟡 partial]` / `[❌ pending]` 條目若已有交付 PR merged,要嘛翻 ✅、要嘛補阻塞詞
(⏳ / 卡 / 待外部 / 待拍板)說明為何仍未完。等 Owner 決策的條目,阻塞詞用**待拍板**
(決策請求格式見 `.claude/sop/decision-request-template.md`)。
⚠️ 阻塞詞是**子字串比對**:不要在條目裡寫否定句(如在阻塞詞前加「不再」「已不」)——
照樣會被當阻塞、壓掉 stale advisory。阻塞解除時,直接刪掉阻塞詞、或翻 ✅。
**完成狀態的 SSOT 是本檔**,記憶層勿抄寫當權威。

---

## P1(上線前必做)

<!-- 範例格式:

### 🔴 <標題>
- **來源**:哪個 review / 健檢 / 教訓產生
- **內容**:要做什麼、為什麼
- **工時**:估算
-->

## P2

## P3

### ✅ README 13 關卡敘述同步風險車道 (PR #___)
- **來源**:2026-08-27 風險車道升級 sprint(Owner 拍板 defer)
- **內容**:README 關卡⑧⑩ 補「CSO_REQUIRED 高風險車道 = 破壞性探針 + Step 5 worktree 獨立審」一句;關卡⑦不動
- **工時**:0.5h
- **交付**:Phase A(commit `f955f81`)

### ✅ bookkeeping 例外機器化(allowlist 檢查) (PR #___)
- **來源**:2026-08-27 Step 5 review(altitude finding,教訓階梯第 3 級預備)
- **內容**:寫小腳本核對「bookkeeping commit 的 diff 只含 progress.md / TODOS / BACKLOG 狀態簿記」,取代 SOP 的純散文自我分類;含 LESSONS.md 排除
- **工時**:1h
- **交付**:Phase C 初版 + round 1-5 迭代;實作用「精確 allowlist + progress-archive snapshot」路徑,LESSONS-archive 全排除(archived lessons 屬 governance)。SOP L323 收窄敘述與 F1 SSOT 位置整併

### ✅ mutate.ts 摘要印 HEAD SHA + decision-request 接線 Step 4-6 (PR #___)
- **來源**:2026-08-27 Step 5 review(2 條 skip 的 informational:探針 SHA 手抄易錯、template 自稱 Step 3-6 但只接線 Step 3)
- **內容**:mutate.ts 收尾摘要加 `git rev-parse HEAD` 輸出;SOP Step 4/4.5/5/6 各補一行 decision-request 指引或把 template 適用範圍改為 Step 3
- **工時**:1h
- **交付**:Phase B + review round 1 fail-closed 加固(startHead ↔ endHead 綁定 + `decideHeadBinding` 純函式);SOP 選「補一行接線」路線、四步都補;template 段落改「Step 3-6」補通用 SSOT 例

## IDEA
