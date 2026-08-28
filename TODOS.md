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

### ✅ workflow yml Source-term scan step 加 `if:` gate 對齊 delivery-branch 白名單 (#34)
- **來源**:2026-08-28 批 8 Step 5 F4(adversarial-reviewer, confidence 4)
- **內容**:批 8 Phase B 只解 `pull_request` event 的 self-PR ref 死鎖;`push:feature/**` event 下無 `pull_request.number` → self-PR 引用仍撞 CI 紅
- **工時**:0.5h
- **交付**:批 9 Phase A(commit `7de32f4`)—— Source-term scan step 加 `if:` gate 對齊 TODOS Markers Check step 既有 pattern。註解記錄「導入者若 delivery branch 不是 default_branch 或 develop 要同步加」

### ✅ batch 8 Step 5 F1/F2/F5 三條 informational 累積 (#34)
- **來源**:2026-08-28 批 8 Step 5(adversarial-reviewer)
- **內容**:F1(`MARKER_SELF_PR` 缺 `< 1e9`)/ F2(`selfPrCount` 診斷字面誤導)/ F5(drafts archival policy 缺)
- **工時**:1h
- **交付**:批 9 Phase B(commit `fe8bf94`)+ round 1-3 fix
  - F1:loadAllowedPrs 加 `selfPr < 1e9`;e2e 加 "9999999999" case;round 2 加 "1000000000" boundary case 守 `<` vs `<=` 邊界
  - F2:selfPrCount 語意改「env 通道 acknowledge」(collision 不受影響)+ 診斷用詞 + docstring「僅診斷用」contract
  - F5:archival 政策先加 template.md → round 3 挪到 CLAUDE.md Part 4.6(placeholder-style + 導入者可刪尾註,避免 GitHub template 散布 harness-internal 命名)

### ❌ pending: develop-branch policy 拍板(跨 workflow yml TODOS Markers Check vs Source-term scan 兩處統一方向)
- **來源**:2026-08-28 批 9 Codex round 2 P2-1(add develop → legacy 誤放行)vs round 3 P2-1(不 add → GitFlow 假紅)—— pre-existing 兩難的兩面
- **內容**:workflow yml 兩處 `DELIVERY_REFS` env 對 `origin/develop` 選擇相反(TODOS Markers Check 只 default_branch、Source-term scan 加 `,origin/develop`)。真正解法是**Owner 拍板方向**(main-only default vs GitFlow default vs 兩 profile flag),再跨兩處 workflow step 統一。
- **選項**:(A) 兩處都不加 develop、GitFlow importer 自訂 (B) 兩處都加、legacy 誤放行接受 (C) 加 project-level flag env
- **工時**:0.5h(方向拍板後動 2 處 workflow yml 環境變數 + 1-2 條 e2e case)
- **defer 理由**:policy 拍板不該靠 codex review 拉扯,批 7 教訓 ①「findings 挑理論邊界時 defer 而非本 sprint 修」

### ❌ pending: workflow-level `DELIVERY_REFS` 常數機械化(SSOT、擋兩處 env 值漂)
- **來源**:2026-08-28 批 9 Step 5 二輪 F-round23-4(conf 5)
- **內容**:workflow yml 頂端 `env:` 區塊定義 workflow-level `DELIVERY_REFS` 常數、兩 step 都 reference。**不解決** develop policy 兩難、但**機械化擋掉「兩處值漂」的漏洞**——以後翻該值只翻一處。
- **工時**:0.5h(頂端加 env 常數 + 兩 step 從 step-level env 改 workflow-level ref)
- **注意**:與上條 develop-branch policy 拍板順序有依賴——policy 定了值再統一。可拆兩 sprint 或合一 sprint

### ❌ pending: `check-todos-markers.ts:424` `MARKER_SELF_PR` 補 `< 1e9` 對稱
- **來源**:2026-08-28 批 9 Step 5 二輪 F-round23-5(conf 4)
- **內容**:批 9 F1 修法把 `check-no-source-terms.ts:411` 補 `< 1e9`(對齊同檔 parseAllowedPrs / extractPrRefsFromLine 契約),但 `check-todos-markers.ts:424` 也讀同一 `MARKER_SELF_PR` env、只有 `Number.isInteger && > 0` 沒上限——兩 script 對同 env 驗證不對稱、9999999999 之類值在一處擋一處放行
- **工時**:0.5h(1 行守 + 1 條 case)
- **defer 理由**:現實 GitHub PR # 非攻擊者控制、check-todos-markers 已受 subject 邊界守;純契約潔癖

## IDEA
