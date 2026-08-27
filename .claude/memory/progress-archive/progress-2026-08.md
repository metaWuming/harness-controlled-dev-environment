---
title: Progress Archive — 2026-08(2026-08-27 ①)
type: archive
---

# Progress Archive 2026-08

> 從 `.claude/memory/progress.md` 於 2026-08-28 批 7 收尾時歸檔(檔案超 20 KB
> 上限,doc-size CI gate 觸發)。本檔為唯讀歷史 snapshot,不回頭編輯。

---

📅 2026-08-27 ① — **風險車道升級:高風險車道兩項加強 + DECISION_REQUEST + 待拍板**

> **緣起**:Owner 拿外部「雙 Session + 多 Agent + Project GPT」治理架構圖與本 harness
> 比較,拍板吸收 4 個與單人規模相容的機制(風險分級對照、乾淨環境驗證、待拍板阻塞詞、
> 決策請求格式),全掛條件觸發、標準車道零加重。起手 git 核實:對話第一輪讀到的 SOP
> 是 #28 前舊版(343 行),已核實現版(444 行,含 docs-only 判準與節奏分層)並重校
> 4 項建議——2 項因此改設計(不動 check-cso-trigger 腳本、狀態詞彙縮成一詞)。
> **改動**:8 檔——`.claude/sop/plan-mode-checklist.md`(風險車道對照表;Step 4.5
> fail-closed 區分+模板 repo 例外+高風險兩項加強:mutate 探針 exit 0 gate、SHA 綁定
> 與重跑循環;Step 5 高風險 worktree 獨立審:review-tip 完整 SHA、逐輪重建、bookkeeping
> 例外含時序;Step 3 決策請求指引;Step 6 高風險 CI 修復導回;entry 模板補高風險欄);
> `.claude/sop/decision-request-template.md`(新,四段格式);`.claude/agents/
> adversarial-reviewer.md`(worktree 模式:SHA+乾淨度核對、無 SHA fail-closed);
> `scripts/check-todos-markers.ts`+`TODOS.md`+`tests/`(阻塞詞加「待拍板」+測試);
> `CLAUDE.md`(5.5 review 輪例外、4.5 摘要)、`docs/DEGRADATION.md`、`docs/EFFORT.md` 同步。
> **審查**:Step 4 Codex exec rounds 1-7(累計 P1 x10 / P2 x8,逐輪修到剩 1 P2);
> Codex 額度耗盡(訊息稱 16:48 重置、實測過時仍擋)→ round 8 依 DEGRADATION 降級:
> 內建 /code-review high(8-angle+驗證),10 findings(9 CONFIRMED / 1 PLAUSIBLE)全修。
> 安全關:`check:cso` fail-closed(表空)→ 適用本 sprint 新加的「模板 repo 例外」人工
> 自問 → diff 無安全敏感邏輯(BLOCKER_RE 屬 advisory 分支)、非高風險車道;dogfooding
> 當場抓到 fail-closed 規則對模板 repo 自我死鎖、補例外條款。視覺關:未觸發(無 UI 檔)。
> Step 5:adversarial-reviewer fresh 審——0 CRITICAL / 7 INFORMATIONAL,confidence 5-6
> x4 修(收斂條件字面不可滿足、gitignore 支線漏 commit、5.5 例外涵蓋整類、agent 無
> SHA fail-closed),confidence 3-4 x3 依規則 skip(decision-request 只接線 Step 3、
> spec 批次 exit 語意、CLAUDE.md 摘要漏「人工視同」)。cross-model agreement ≈ 0(再驗證)。
> **驗證**:typecheck / lint 綠;tests 14 檔 348 passed;check:doc-refs 112 引用 0 失效;
> check:todos 綠;check:no-source-terms 綠。
> **⭐ 教訓**:①Codex 額度重置時間訊息不可信,降級路徑第一次實測(見 LESSONS 同日兩條)
> ②新 SOP 規則寫完先拿自己 repo dogfood 一遍——fail-closed 自我死鎖就是這樣抓到的。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):A. README 13 關卡同步風險車道
> (TODOS P3);B. bookkeeping 例外機器化(allowlist 檢查腳本,TODOS P3);C. mutate.ts
> 摘要印 HEAD SHA + decision-request 接線 Step 4-6(TODOS P3)。
> **check:claims 逐條處置**:命中 8 處全留 A——r0 x2(「判準只有一個」=原則 1 單一判準
> 可枚舉;「唯一正本」=docs-only 敘述單一錨點)、r8 x5+carve-out x1(全是本刀刻意建立
> 的 SSOT 錨點宣告,各集合=單一錨點,指標已去重)。0 降級 B。(同文貼 PR 描述)
> 📊 成本:CC ~4h / 跨模型 review 7 rounds + 降級 1 + Step5 1 / P1 12 個 / P2 9 個 /
> Step5 獨立發現 7 個
> 📐 量測(供 `docs/EFFORT.md` sweep;人工填):每輪 model＋effort:主迴圈
> claude-fable-5(session 預設 effort);Codex exec r1-5 medium、r6-7 high;r8 內建
> /code-review high / baseline SHA:42c72265fbc6ae057e877b472379098689580d09 /
> 來源分佈:初始 patch 內既有缺陷 17・初始 patch 漏改的外部 consumer 5(4.5 首彈舊文、
> CLAUDE.md 5.5、EFFORT、DEGRADATION、Step 5 entry 模板)・baseline 後新增/修改引入 7
> (各 fix round 引入再修)
> **7 步 checklist 狀態**:Step 1 ✅(plan file 完整含 impact radius)/ Step 2 ✅
> (無真實取捨,D1-D6 全 sensible default)/ Step 3 ✅(4 phases atomic commits、
> 每 phase gate 綠)/ Step 4 ✅(9 輪收乾,含降級輪)/ 4.5 ✅(模板 repo 例外人工
> 判定)/ 4.6 ✅(未觸發)/ Step 5 ✅(含本 entry bookkeeping)/ Step 6-7 待執行。
