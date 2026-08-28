---
title: 開發進度
type: note
---

# 開發進度(progress.md)

> 每個 sprint 收尾時在本檔**最上方**加一條 entry(倒序,最新在上)。
> 這是專案的權威進度紀錄:接手的 session 先讀最上面 1-2 條 entry 就知道「上一棒做了什麼、
> 下一棒候選是什麼」。
>
> ⚠️ **entry 裡的「下一棒候選」是 hint 非 truth**——接手 session 起手一律 git 核實
> (marker 可能腐爛:寫「待完成」的事可能早已完成)。
>
> 檔案過長時照 `progress-archive/README.md` 慣例歸檔舊 entry。

---

## Entry 格式範本

> ⚠️ **這是 completed-sprint 的 pre-merge schema**(2026-08-21 改):entry 在
> SOP Step 5 收乾後寫、進 feature branch 最後一個 commit、跟 code 進同一 PR 一起 squash。
> **排除 post-merge 才可知的欄位**(PR 號 / squash SHA / CI 狀態 / merge 狀態)——
> 這些 git log / GitHub PR page 自帶,progress 不重複記、也不會過時。
> 要驗證某 sprint 是否已合到 delivery branch:先 `git fetch origin`,再對 progress.md
> 這個檔在遠端 delivery branch 的檔案歷史裡查 entry 內容,不要靠 branch tip 或 commit
> subject。用 `CLAUDE.md` §4.6 Git 規範 內填寫的 delivery branch(專案可設定,例如
> `main` / `develop` / 其他;placeholder 未填時 fallback:
> `git symbolic-ref refs/remotes/origin/HEAD` 拿 default branch),跑
> `git log -S '<完整且唯一的 entry heading(含日期、ⓝ、標題)>' origin/<delivery-branch> -- .claude/memory/progress.md`
> ——`-S` 對「內容變化」查、找到就代表這條 entry 已進遠端主線;找不到就是沒進。
> 或去 GitHub PR page 直接看 merge status。**不要用 `--grep` 查 commit subject**
> ——squash commit subject 不必然重複 entry 標題;**也不要用 branch tip 或 `-1`**
> ——只顯示最後一支、無法對應這一個特定 sprint;**local delivery branch 可能 stale**
> ——一定要用 `origin/` 遠端 ref。
> (舊 schema 在 title 塞 `→ PR #N squash 進主線 SHA`,結果 Step 5 寫時全是 pending;
>  改成 Step 7 回寫又動不了 protected delivery branch → 每 sprint 收尾多 1 支 PR
>  + 1 輪 CI 純浪費)

> ### ⚠️ 未完成 sprint 的 checkpoint 走另一條 flow
>
> 上面的 schema 是**完整 sprint 收尾**用的。
> **未完成 sprint** 的情境(工作暫停 / 被阻於外部 / context 快被壓縮前寫交棒):
> 走 `.claude/sop/context-management.md` 的 checkpoint / take5 flow——寫 partial
> entry 保留當下狀態、給下一棒接手。partial entry **不必**滿足上面的 pre-merge schema
> (它本來就是未完成、如果 sprint 中斷不再繼續就永遠不會 squash 進主線),但要明確
> 標示「⚠️ partial / paused」讓下一棒知道這不是完整交付。
>
> 🔴 **partial entry 的生命終結——sprint 若恢復並在同 feature branch 走到 Step 5:
> 必須把既有 partial entry 更新/替換為 completed schema、不能 append 第二份**。
> 否則同 feature branch 的 squash 會含**兩份 entry**(stale partial + completed)、
> 一起進 delivery branch,違反「partial 不進主線」宣稱。做法:Step 5 開始寫時,
> 先 `grep -nE '⚠️ (partial|paused)' .claude/memory/progress.md` 找該 sprint 的既有
> partial entry,把它就地擴寫成 completed schema、不是在最上方另加新 entry。

```markdown
📅 YYYY-MM-DD ⓝ — **一句話標題**

> **緣起**:為何做這件事(觸發來源:Owner 指示 / TODOS 項 / 上一棒 follow-up)。
> 起手 git 核實了什麼、推翻了哪些過時 hint。
> **改動**:N 檔,每檔一句話(新增了什麼 / 改了什麼 / 為什麼)。
> **審查**:跨模型 review N 輪(每輪 findings 摘要 + 收斂結果);安全關觸發與否及結論;
> 第二道 review 結果。
> **驗證**:typecheck / lint / test 數字(N 檔 / N passed)、build 通過。
> (CI 狀態去 GitHub PR page 看、不在此重複——本 entry 是 pre-merge 寫的)
> **⭐ 教訓**:①② 編號列出(可 cross-reference LESSONS.md)。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):候選 A / 候選 B。卡外部的事項單獨標出。
> **check:claims 逐條處置**:命中 N 處,留 A X 條 / 降級 B Y 條(同時貼進 PR 描述)。
> 📊 成本:CC ~Xh / 跨模型 review N rounds / P1 X 個 / P2 X 個 / Step5 獨立發現 X 個
> 📐 量測(供 `docs/EFFORT.md` 的 sweep;目前**人工填、人工讀**):
>    每輪 model＋API effort / baseline SHA / 來源分佈(既有缺陷 X・漏改 consumer X・baseline 後引入 X)
```

---

<!-- entry 從這裡開始,新的在最上面 -->

📅 2026-08-28 ⑤ — **批 11:加 docs/OVERVIEW.md 深度總覽 + README pointer**

> **緣起**:Owner 讀完批 10 收工報告後、看到 outputs/ 產出的深度說明文件(md + 離線 HTML 版含 5 張 inline SVG 流程圖),提議「這份可以擺 GitHub 讓考慮用的 user 有更完整理解」。我建議選項 A(把 md 挪進 docs/OVERVIEW.md、去掉日期、加 SSOT 錨定、README 加 pointer),Owner 拍板 go A。
> **改動**:2 檔 +927 —— `docs/OVERVIEW.md`(從 outputs/ 蒸餾、去日期、加 SSOT 錨定檔頭「若與 CLAUDE.md / SOP checklist 有出入以那兩份為準」、markdown link 改 docs/ 相對路徑);`README.md` 英中兩處「What is this / 這是什麼」段末加 pointer block 指向 OVERVIEW(措辭「評估要不要導入本模板的讀者建議先讀這份」)。**out of scope**(留給下棒 sprint):`.claude/memory/health-history/` 首週產出兩檔仍 untracked,屬 memory 層自然產物、下次 sprint 一起收乾。
> **審查**:docs-only 情境、走簡化 SOP —— 跳 Step 4 codex review(明確 pattern、無新機制)、跳 Step 5 adversarial(Owner 明說「批 10 全部結束」政策延續、conf ≥ 4 一律修 conf ≤ 3 skip、doc-only 屬 skip 帶)。全 gate 綠即進 Step 6。**安全關 4.5** `check:cso` fail-closed(表空)→ 純新增 doc + README 段落、無 auth/金流/個資/權限/資產轉移 → 模板 repo 例外**不進高風險車道**。**視覺關 4.6** 未觸發(無 UI 改動)。
> **驗證**:typecheck / lint / check:doc-refs 239 引用 0 失效(新增 63 條全對得上、check-doc-refs 用 repo-root 相對解析所以 backtick 文字引用 `docs/xxx` 從 docs/OVERVIEW.md 位置仍 resolve 對)/ check:no-source-terms / check:doc-size progress 76% LESSONS 27% / check:todos 4 個 PR 4 個有 merge / check:claims 14 hits 全留 A(見下)。
> **⭐ 教訓**:①**deep doc 定位 = SSOT 摘要不是正本**——避免變成第 4 份 authoritative 文件(CLAUDE.md、SOP checklist、docs/ 個別檔已是 SSOT);OVERVIEW 檔頭明列「若有出入以那兩份為準」+ 定期同步、可能落後最新 sprint 的免責。②**backtick 文字路徑跟 markdown link 語意不同,check-doc-refs 都會抓**——好處是文字引用也能被守門,壞處是 outputs/ 版原文的 `docs/xxx` 全 repo-root 相對格式若碰到 file-relative 解析的 checker 會全爆(本 checker 用 repo-root 所以 work)。③**Owner 拍「不再 defer」政策的自然延伸**是 sprint 大小自我調節——doc-only 該用 docs-only 判準跳 review 輪、不硬套 batch 8-10 那種 conf 判定;Owner 建議、我拍推薦選項 A(不是 B 選項的拆多份)、5 min 完成、體現 sprint 大小應 fit 內容不是 fit SOP。
> **⏭️ 下一棒候選**(hint 非 truth):A. `.claude/memory/health-history/` 首週產出兩檔進 git(小 sprint、順手);B. 跑 `npm run health:weekly` 產第 2 週對照 baseline(累積 3-5 週後看趨勢);C. 若批 11 之後有導入實績、收「導入者 30 分鐘完成」實測數據補強 QUICKSTART。
> **check:claims 逐條處置**:命中 14 處全留 A —— L45「每一次」/ L77「唯一」/ L82「永遠不」/ L130「絕不」/ L222「永遠不 / 幾乎不」/ L379「唯一」/ L526 三處「只有 / 唯一 / 各自都足夠」+ L774「只有」/ 其他 3 條同批 —— 全屬引 SSOT 錨定既有敘述(CLAUDE.md 核心哲學、DEGRADATION.md 明列事實、check:claims 自身量詞範例引用)、非新宣稱、批 5 已處置過同批 pattern(README 那次)。0 降級 B。
> 📊 成本:CC ~0.5h / Codex 0 rounds(docs-only skip)/ Step5 0 輪(同) / P1 0 個 / P2 0 個 / Step5 獨立發現 0 個 / 累計 0 findings。
> 📐 量測:主迴圈 claude-opus-4-7 預設 effort / doc-only 無 code review baseline / 來源分佈 N/A(純新增 doc、非既有面改動)。
> **7 步 checklist 狀態**:1 ✅(plan 直接用對話拍板)/ 2 ✅(Owner「go A」拍板選項)/ 3 ✅(單 phase 一 commit)/ 4 ⏭️ skip(docs-only)/ 4.5 ✅(不進高風險車道)/ 4.6 ✅(未觸發)/ 5 ⏭️ skip(docs-only)/ 6-7 待執行

📅 2026-08-28 ④ — **批 10:TODOS P3 全部收乾(develop-policy 拍板 A + workflow-level env SSOT + shared lib)**

> **緣起**:批 9 (#34) 收尾 defer 進 TODOS P3 的三條 finding。**Owner 拍板本 sprint 全部結束、不再 defer**——Step 4/5 findings conf ≥ 4 一律修進本 sprint、conf ≤ 3 才 skip。三條:A. develop-branch policy 拍板;B. workflow-level `DELIVERY_REFS` 常數機械化;C. `check-todos-markers.ts` 補 `< 1e9` 對稱守。
> **改動**:5 檔 +190/-29 —— `.github/workflows/ci.yml`(workflow-level `env:` 加 DELIVERY_REFS + MARKER_SELF_PR 常數、兩 step 移除 step-level 定義、註解記 D0 拍板 A);`scripts/lib/marker-self-pr.ts`(新、shared lib 單一入口 acknowledgeSelfPr 三守合起來);`scripts/check-no-source-terms.ts`(import lib 替代 inline 三守);`scripts/check-todos-markers.ts`(import lib + 抽 main() 內 selfPr 讀取 + re-export 給既有 test);`tests/check-todos-markers.test.ts`(7 unit test acknowledgeSelfPr + 2 CLI e2e case 守 call site 接線)。TODOS 三條翻 ✅(#35)+ 加「無 pending P3」尾註(批 10 收乾);progress-archive 歸檔批 8;本 entry。
> **審查**:Codex CLI 2 rounds(trend 3→0、round 2 罕見 SHIP)——r1 3 P2(SSOT 不是真單一入口 → 抽 shared lib / CLI 接線 e2e 缺 → 加 disposable-repo harness / TODOS 待翻)、r2 0 SHIP。**安全關** `check:cso` fail-closed(表空)→ 純 workflow 集中 + shared lib 抽出 + test → 模板 repo 例外人工判定**不進高風險車道**(D4);**視覺關**未觸發(D5,無 UI 檔)。**Step 5** adversarial-reviewer fresh 審:0 CRITICAL / 3 INFORMATIONAL,Owner「不再 defer」全收:F1 conf 7(MARKER_SELF_PR 也提到 workflow-level、同 SSOT 論證延伸)、F2 conf 6(中段 import + `_` alias → top-level import + 檔頭 export)、F3 conf 5(引號統一雙引號對齊 check-no-source-terms)。cross-model agreement ≈ 0 再度驗證(codex 抓 shared lib / call site、Step 5 抓 SSOT 論證延伸 / 風格 consistency)。
> **驗證**:typecheck / lint / test 96(56 + 40)/ mutation 探針 3 條(拿 `< 1e9` → boundary case 紅 / 刪 call site → e2e 紅 / F1 revert 前後 gate 綠)/ dogfood 綠 / doc-refs 170 / check:todos 3 個 PR 3 個有 merge 證據。
> **⭐ 教訓**:①**「單一入口」要真的抽 shared lib、不是同檔 export**——批 10 Phase B 起初把 acknowledgeSelfPr 抽在 check-todos-markers.ts 內為 export pure fn(單 script 內部 SSOT),但 codex round 1 抓到「其實另一 script 仍複製同邏輯」——真正的 SSOT 要建 shared lib、兩 script 都 import。同 SSOT 論證要能延伸到所有相同表面(F1 揭示 MARKER_SELF_PR 表達式也符合、跟 DELIVERY_REFS 同時提工作 flow-level)。②**Owner「不再 defer」政策 + 「該做更多」型 defer 兩者不衝突**——批 7 教訓 ① 說「findings 挑理論邊界時 defer」,批 10 Owner 說「不再 defer」；解法:conf ≥ 4 全修、conf ≤ 3 skip(前者是「不 defer 就得修」的實作、後者是「conf 太低本來就不修」的例外)、無「defer TODOS P3」中間層。批 10 實測 findings 都 conf 5-7、全修得動。③**批 5-10 收乾:8 條 P3 交付 = 完整 TODOS P3 backlog 清 0**——無 pending backlog 就進入「新工作要從 Owner 指示 / 健康檢查 / 新 sprint defer 產出」的 fresh cycle。
> **⏭️ 下一棒候選**(hint 非 truth):TODOS P3 backlog 清 0、無 pending 條目。若無新 Owner 指示,建議跑一次 weekly health check / 或 batch 7 Step 5 F5(hook vs checker 第 3 段對齊 e2e)散文級預備繼續。
> **check:claims 逐條處置**:命中 0 處(check:claims dogfood 對本 sprint diff 綠、無新增量詞未 SSOT 錨定)。
> 📊 成本:CC ~2.5h / Codex review 2 rounds + Step5 1 / P1 0 / P2 6 / Step5 獨立發現 3 個(全收)/ 累計 9 findings。
> 📐 量測:主迴圈 claude-opus-4-7 預設 effort / Codex r1-2 non-interactive review medium / adversarial-reviewer default / baseline SHA:`2f351b1814d2bfde5f8cbc4e3492b2dd7498fe31` / 來源分佈:初始 patch 內既有缺陷 3(codex r1×3 全:shared lib / call site / TODOS 待翻)・初始 patch 漏改的外部 consumer 3(Step5 F1 MARKER_SELF_PR 同 SSOT 論證延伸、F2 import 風格、F3 引號)・baseline 後新增/修改引入 0(round 1 fix 不引入新表面)
> **7 步 checklist 狀態**:1 ✅(plan file)/ 2 ✅(D0-D6 全 sensible default;D0 拍板 policy A)/ 3 ✅(2 phase atomic commits + round 1 fix + Step 5 fix + bookkeeping)/ 4 ✅(2 rounds 收乾)/ 4.5 ✅(不進高風險車道)/ 4.6 ✅(未觸發)/ 5 ✅(fresh 審全收)/ 6-7 待執行

📅 2026-08-28 ③ — **批 9:收乾批 8 兩條 TODOS P3 defer(workflow if: gate + F1/F2/F5 informational)**

> **緣起**:批 8 (#33) 收尾 defer 兩條 P3:①Source-term scan 加 `if:` gate 對齊 delivery-branch 白名單(F4);②F1/F2/F5 三條 informational(MARKER_SELF_PR `< 1e9` / selfPrCount 語意 / drafts archival)。合計 ~1.5h、一批做審一次比兩次省(批 5/8 pattern)。
> **改動**:6 檔 +100/-19 —— `.github/workflows/ci.yml` Source-term scan 加 `if:` gate(對齊上方 TODOS Markers Check L144);`scripts/check-no-source-terms.ts` loadAllowedPrs 加 `selfPr < 1e9` 上限 + selfPrCount 語意改「env 通道 acknowledge 狀態」(collision 不受影響)+ docstring 加「僅診斷用」contract + 診斷輸出用詞;`.claude/sop/codex-review-scope-note-template.md` 加 archival routing(指 project CLAUDE.md);`CLAUDE.md` Part 4.6 加 archival policy(placeholder-style + 導入者可刪);`tests/check-no-source-terms.test.ts` 加 F1(9999999999)+ F1 boundary(1000000000)+ F2 collision(#42)三 case;`.claude/sop/codex-review-scope-note-drafts/batch-9.md`(新 scope note、non-self-referential 慣例)。TODOS 兩條翻 ✅(#34)+ 加 develop-branch policy defer + workflow-level DELIVERY_REFS 常數 defer + check-todos-markers `< 1e9` 對稱 defer 三條 P3;LESSONS 加兩則教訓(codex 兩輪對 pre-existing 抓相反面 / GitHub template CLAUDE.md 散布);本 entry。
> **審查**:Codex CLI 3 rounds(trend 0→3→2、round 1 罕見一輪過)+ Step 5 兩輪(第一輪 6 findings、第二輪 6 findings)——r1 0 SHIP;r2 3 P2(F1 加 develop 反向漂移 → revert / `< 1e9` boundary test / docstring 首句貢獻數矛盾);r3 2 P2(F1 revert 後 GitFlow 假紅 vs abandoned develop 誤放行的 pre-existing 兩難 → defer / CLAUDE.md archival 對 importer 洩漏 → placeholder-style)。Round 3 finding 是同 pre-existing 問題的相反面、批 7 教訓 ① 觸發收乾。**安全關** `check:cso` fail-closed(表空)→ 純測試 + workflow env + docstring 無 auth/金流/個資/權限/資產轉移 → 模板 repo 例外人工判定**不進高風險車道**;**視覺關**未觸發(無 UI 檔)。**Step 5 fresh 一輪** 6 findings 全 INFORMATIONAL、conf 6+ = 0——修 F1(workflow yml 註解 L181 行號漂 → 錨到 step name)+ F2(template.md 對 importer 懸空 pointer)兩條就地;defer F3(scope note 描述作廢、archive 後歷史 snapshot)+ F4(workflow-level 常數 mechanical fix)+ F5(check-todos-markers 缺 `< 1e9` 對稱);skip F6(docstring 潤色 conf 2)。**Step 5 fix 覆蓋輪**(round 2 之前提前先做):再抓 6 INFORMATIONAL、全 defer 或 skip、無新表面。cross-model agreement ≈ 0 再度驗證(codex 抓 boundary/契約邊 / Step 5 抓行號漂/importer 洩漏/pre-existing 兩難)。
> **驗證**:typecheck / lint / test 56(53 baseline + F1/F1-boundary/F2 三 case)/ mutation 探針 F1(拿 `< 1e9`)F2(恢復舊 !prs.has)F1-boundary(改 `<=`)三條各命中對應 case、round 3 fix 無新 mutation 需求(纯註解改動)/ dogfood `check:no-source-terms` 綠 / doc-refs 163 引用 0 失效 / check:todos 綠 / check:bookkeeping HEAD~1(round 3 fix commit)判 exit 1 對(含 workflow yml + CLAUDE.md 屬 code、非純 bookkeeping)、bookkeeping commit 本身應綠。
> **⭐ 教訓**:①**Codex 兩輪對同 pre-existing 問題發抓相反面 = 該做更多型變體**——批 9 F1 修法 round 2 抓 legacy 漏洞、round 3 抓 GitFlow 假紅,一 fix 拉不動 pre-existing 兩難的兩端;訊號一出現就 defer TODOS P3、由 Owner 決策政策方向、跨全部 call site 統一,而非跨 review 輪次靠 codex 拉扯(見 LESSONS 新教訓)。②**GitHub template 的 CLAUDE.md 會被 `Use this template` 複製**——放 harness-internal 政策(batch-N.md 慣例、月檔 append)前先問「importer 用得到嗎?會誤導嗎?」;真要放,寫成 placeholder + 導入者可刪尾註(見 LESSONS 新教訓)。③**罕見一輪 codex 過(r1 0 SHIP)不代表沒問題**——Step 5 fresh 立刻抓 6 條 codex 沒抓的軸(cross-model agreement 0)、其中 F1 conf 6 直接觸發 round 2/3。單輪 codex 過綠 ≠ 該收乾、fresh 審軸不同不可省。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):A. develop-branch policy 拍板(TODOS P3 新條目、跨 workflow yml TODOS Markers Check 與 Source-term scan 兩處統一方向);B. workflow-level DELIVERY_REFS 常數機械化(TODOS P3);C. check-todos-markers.ts:424 補 `< 1e9` 對稱守(TODOS P3)。
> **check:claims 逐條處置**:0 處(check:claims dogfood 對本 sprint diff 綠、無新增量詞未 SSOT 錨定)。
> 📊 成本:CC ~3.5h / 跨模型 review 3 rounds + Step5 2 / P1 0 個 / P2 5 個 / Step5 獨立發現 12 個(兩輪各 6、其中兩輪 conf 6+ = 0)/ 累計 17 findings。
> 📐 量測(供 `docs/EFFORT.md` sweep;人工填):主迴圈 claude-opus-4-7 預設 effort / Codex r1-3 non-interactive review medium / adversarial-reviewer default / baseline SHA:`931fc20f22c08e4257b78ae89387d9f54bd3f634` / 來源分佈:初始 patch 內既有缺陷 2(Step5 F1 行號漂 / F2 pointer)・初始 patch 漏改的外部 consumer 3(r2 F1 revert 是 batch 7 pre-existing 選擇 propagate 誤 / Step5 二輪 F4 workflow 常數 / F5 check-todos-markers 對稱)・baseline 後新增/修改引入 4(round 1 fix F1 加 develop 引入 legacy 漏洞 → r2 抓 → revert 引 GitFlow 假紅 → r3 抓 → Owner defer)
> **7 步 checklist 狀態**:1 ✅(plan file)/ 2 ✅(D0-D6 全 sensible default)/ 3 ✅(3 phase atomic commits + 3 round fix commits + Step 5 fix commit + LESSONS commit + bookkeeping commit)/ 4 ✅(3 rounds 收乾 + Owner 拍板 r3 pre-existing 兩難 defer)/ 4.5 ✅(模板 repo 例外不進高風險車道)/ 4.6 ✅(未觸發)/ 5 ✅(fresh 兩輪、conf 6+ = 0)/ 6-7 待執行

> 更早的 entries(2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
