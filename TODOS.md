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

### ✅ buildDeliveryRefs 前三條 fallback 路徑 e2e 覆蓋 (#33)
- **來源**:2026-08-28 批 7 Step 5 F2(adversarial-reviewer,confidence 7);TODOS 措辭原寫「check-todos-markers」但正確目標是 `scripts/check-no-source-terms.ts`(D0 修正)
- **內容**:e2e 全部走 last-resort 本地 main fallback、①origin/HEAD ②DELIVERY_REFS env ③origin/develop 三條路徑無對照
- **工時**:0.5-1h
- **交付**:批 8 Phase A(commit `1536fa7`)——擴 `makeRepo` opts 加 `originRefs` 支援 + `runChecker` envOverride + 4 e2e case(A-e1..A-e4)。round 1-3 fix:sentinel branch name(A-e1)、逗號多 ref(A-e2)、B-e4 history-blob 獨立 case

### ✅ workflow yml Source-term step 加 MARKER_SELF_PR env(sprint 內 self-reference 可過)(#33)
- **來源**:2026-08-28 批 7 Codex round 6 P2-2(defer:「該做更多」型 finding、Owner 拍板不進本 sprint)
- **內容**:`.github/workflows/ci.yml` Source-term scan step 加 `MARKER_SELF_PR: ${{ github.event.pull_request.number }}` env,checker 讀該 env 把當前 PR 號加入 allowedPrs
- **工時**:1-2h
- **交付**:批 8 Phase B(commit `4855117`)——`loadAllowedPrs` 加 env 讀取(對齊 `scripts/check-todos-markers.ts:423-424`)+ workflow yml env + 3 e2e case(B-e1..B-e3)。round 2-3 fix:診斷輸出改「delivery 已 merge M + self-PR K」+ B-e4 補 history-blob 覆蓋 + B-e3 加 "1.5" 浮點守
- **⚠️ 已知範圍限制(批 8 Step 5 F4)**:此修法只解 `pull_request` event(PR 開之後);`push:feature/**` event 下 `github.event.pull_request.number` 為 null → env 空 → self-PR 引用仍會被擋(feature branch push 走 CI 紅、開 PR 後 CI 綠)。真正解法是把 Source-term scan step 加 `if:` gate 對齊 TODOS Markers Check step、跳過 non-delivery-branch push;defer 進下方新條目

### ✅ README 13 關卡敘述同步風險車道 (#30)
- **來源**:2026-08-27 風險車道升級 sprint(Owner 拍板 defer)
- **內容**:README 關卡⑧⑩ 補「CSO_REQUIRED 高風險車道 = 破壞性探針 + Step 5 worktree 獨立審」一句;關卡⑦不動
- **工時**:0.5h
- **交付**:Phase A(commit `f955f81`)

### ✅ bookkeeping 例外機器化(allowlist 檢查) (#30)
- **來源**:2026-08-27 Step 5 review(altitude finding,教訓階梯第 3 級預備)
- **內容**:寫小腳本核對「bookkeeping commit 的 diff 只含 progress.md / TODOS / BACKLOG 狀態簿記」,取代 SOP 的純散文自我分類;含 LESSONS.md 排除
- **工時**:1h
- **交付**:Phase C 初版 + round 1-5 迭代;實作用「精確 allowlist + progress-archive snapshot」路徑,LESSONS-archive 全排除(archived lessons 屬 governance)。SOP L323 收窄敘述與 F1 SSOT 位置整併

### ✅ mutate.ts 摘要印 HEAD SHA + decision-request 接線 Step 4-6 (#30)
- **來源**:2026-08-27 Step 5 review(2 條 skip 的 informational:探針 SHA 手抄易錯、template 自稱 Step 3-6 但只接線 Step 3)
- **內容**:mutate.ts 收尾摘要加 `git rev-parse HEAD` 輸出;SOP Step 4/4.5/5/6 各補一行 decision-request 指引或把 template 適用範圍改為 Step 3
- **工時**:1h
- **交付**:Phase B + review round 1 fail-closed 加固(startHead ↔ endHead 綁定 + `decideHeadBinding` 純函式);SOP 選「補一行接線」路線、四步都補;template 段落改「Step 3-6」補通用 SSOT 例

### ❌ pending: workflow yml Source-term scan step 加 `if:` gate 對齊 delivery-branch 白名單
- **來源**:2026-08-28 批 8 Step 5 F4(adversarial-reviewer, confidence 4)
- **內容**:批 8 Phase B 只解 `pull_request` event 的 self-PR ref 死鎖;`push:feature/**` event 下無 `pull_request.number` → self-PR 引用仍撞 CI 紅。真正解法是把 Source-term scan step 加 `if:` gate 對齊上方 TODOS Markers Check step L144(`github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch) || github.ref == 'refs/heads/develop'`)、跳過 non-delivery-branch push。同時對齊 batch 6 LESSONS L89「event filter / workflow if / marker check env 三處要同步」紀律
- **工時**:0.5h(單一 yml 改動 + 1 條 e2e test)
- **風險**:低——TODOS Markers Check step 已有此 gate 一段時間、pattern 驗證過

### ❌ pending: batch 8 Step 5 F1/F2/F5 三條 informational 累積
- **來源**:2026-08-28 批 8 Step 5(adversarial-reviewer)
- **內容**:
  - **F1** (conf 4):`MARKER_SELF_PR` 缺 `< 1e9` 上限,與 `parseAllowedPrs` 契約不對稱(現實不可利用因 `extractPrRefsFromLine` 也有同守)
  - **F2** (conf 3):`selfPrCount` 在 self-PR 已 ∈ delivery-merged 時報 0(純診斷字面誤導)
  - **F5** (conf 2):`.claude/sop/codex-review-scope-note-drafts/` 無明確 archival trigger 條件
- **工時**:1h 三條合修(全純契約潔癖 / 診斷字面 / 文檔紀律,無行為級 bug)
- **defer 理由**:全 confidence ≤ 4、無實質風險、若累積再處理

## IDEA
