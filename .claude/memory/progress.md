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

📅 2026-08-28 ② — **批 8:收乾批 7 兩條 TODOS P3 defer(check-no-source-terms buildDeliveryRefs e2e + MARKER_SELF_PR env 通道)**

> **緣起**:批 7 (#32) 收尾 defer 兩條 P3 進 TODOS.md:①`buildDeliveryRefs` 前三條 fallback 路徑無 e2e 覆蓋(Step 5 F2,confidence 7);②`.github/workflows/ci.yml` Source-term scan 缺 `MARKER_SELF_PR` env(codex R6 P2-2)。兩支同源(check-no-source-terms.ts 的 self-PR 治理面)、合計 ~1.5-3h、一批做審一次比兩次省(批 5 同 pattern 已驗)。起手 git 核實:main 乾淨、TODOS P3 兩條對得上批 7 entry 下一棒候選。**⚠️ D0 修正**:TODOS 措辭寫「buildDeliveryRefs」但該 fn 只在 `check-no-source-terms.ts`(L299-347)、`check-todos-markers.ts` 對應物叫 `buildMergedPrSet`——確認 Task A 目標檔 = `check-no-source-terms.ts`(批 7 就是動這支的 CA 升級 follow-up)。
> **改動**:4 檔 +355/-11 —— `scripts/check-no-source-terms.ts` `loadAllowedPrs` 加 `MARKER_SELF_PR` env 讀取、改回 `{ prs, mergedCount, selfPrCount }` object、docstring 收攏(SSOT);`.github/workflows/ci.yml` Source-term scan step 加 `MARKER_SELF_PR` env、註解指向 checker docstring;`tests/check-no-source-terms.test.ts` `makeRepo` 加 `originRefs`(bare origin + temp-branch push + `setHeadTo`)+ `runChecker` envOverride + baseEnv strip、8 新 e2e case(A-e1..A-e4 + B-e1..B-e4);`.claude/sop/codex-review-scope-note-drafts/batch-8.md`(新目錄 + 首檔,附 non-self-referential 慣例的自省註解)。TODOS 兩條翻 ✅(#33)+ 補 D0 措辭修正 + F4 新 P3 條目;LESSONS 加「引用 SOP 前提前 grep 驗」教訓;本 entry。
> **審查**:Codex CLI 5 rounds 收乾(trend 4→4→1→1→1、明確收斂;round 5 finding 為 self-referential scope note 死循環、屬「該做更多」型、批 7 教訓 ① 觸發收乾)——r1 4 條(MARKER_SELF_PR commit-msg 敘述宣稱過寬 P1 / A-e1 origin/master 硬碼假通過 P2 / A-e2 缺 split 語意 P2 / B-e2/e3 缺 allowlist 斷言 P2)、r2 4 條(Number.isInteger 單獨拿掉全綠 P2 / A-e2 trim 只守前導 P2 / Phase B 敘述 SSOT 漂 P2 / 診斷輸出用詞 P2)、r3 1 條(B-e1 只覆蓋工作樹、無 history-blob 獨立守 P2)、r4/r5 各 1 條 scope note 追不上下一輪(死循環)。Round 1 P1 拍板不改 code(commit-msg scan 是既定政策,批 7 R6 P2-4 已測)只改敘述縮範圍。**安全關** `check:cso` fail-closed(表空)→ 純測試 + env 傳遞、無 auth / 金流 / 個資 / 權限 / 資產轉移 → 模板 repo 例外人工判定**不進高風險車道**;**視覺關**未觸發(無 UI 檔)。**Step 5** adversarial-reviewer fresh 審:0 CRITICAL / 5 INFORMATIONAL,依規則全 skip(F1/F2/F5 conf ≤ 4 純潔癖;F3 conf 5 決策 audit 值得寫 LESSONS 但 code 已 robust;F4 conf 4 已 defer TODOS P3);cross-model agreement ≈ 0 再度驗證 SOP L215。
> **驗證**:typecheck / lint / test 53(45 baseline + Phase A 4 + Phase B 3 + round 3 加 B-e4 1)/ mutation 探針 5 條全部驗證命中相應 case(mutation A/B/C round 1 + mutation X/Y round 2 + mutation Z round 3 各自紅)/ dogfood `check:no-source-terms` 綠(23 delivery + 0 self-PR)/ doc-refs 153 引用 0 失效 / check:todos 綠。
> **⭐ 教訓**:①**stage 前先 git status 避免 `git stash` / `git checkout` 誤還原**——本 sprint 兩度踩:Phase A mutation 探針前用 `git stash` 把 test 改動一起 stash 掉(改成 「先 stage 保護、mutation 完 `git checkout` 從 index 還原」);Phase B mutation 前忘記 stage 生產碼、`git checkout` 拿到上一 commit 的無 MARKER_SELF_PR 版本。定形:**mutation 前一定先 `git add -A`(排除 untracked)、mutation 動生產碼、跑 test、`git checkout <file>` 從 index 還原**——這樣 stage 版就是 mutation 前的 baseline。②**Codex pushback「已明列」型理由先 grep 驗**——R3 codex 說「squash-only 前提已在 CLAUDE.md Step 6 明列」被我當事實採信;Step 5 fresh 審 grep 才發現 CLAUDE.md 對應段是「SOP 建議動作」不是硬性政策(見 LESSONS 新教訓 [2026-08-28])。③**scope note 內列 commit SHA 清單會踩 self-referential 死循環**——每次 fix commit land 都讓 scope note 落後一輪、下輪 review 又抓同 finding、無限迭代(R4/R5 finding 完全同源)。修法:scope note 用描述性語言、SHA 清單交給 `git log` 動態拿。④**cross-model agreement ≈ 0 是常態**再度驗證——Codex 5 rounds 找 test 覆蓋 / 邊界值 / SSOT 敘述,Step 5 fresh 找決策 audit / 契約潔癖 / event-scope 遺漏、軸完全不重疊。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):A. F4 workflow yml Source-term scan 加 `if:` gate 對齊 delivery-branch 白名單(TODOS P3 新條目);B. F1/F2/F5 三條 conf ≤ 4 informational 累積再修(TODOS P3 新條目);C. 批 7 Step 5 F5(hook vs checker 第 3 段對齊 e2e)散文級預備繼續。
> **check:claims 逐條處置**:命中 0 處(check:claims dogfood 對本 sprint diff 綠、無新增量詞未 SSOT 錨定)。
> 📊 成本:CC ~4h / 跨模型 review 5 rounds + Step5 1 / P1 1 個(round 1 拍板不改 code)/ P2 10 個 / Step5 獨立發現 5 個(全 skip/defer)/ 累計 16 findings。
> 📐 量測(供 `docs/EFFORT.md` sweep;人工填):主迴圈 claude-opus-4-7 預設 effort / Codex r1-5 non-interactive review medium / adversarial-reviewer default / baseline SHA:`c2a0ec6fb1a2c6a2068b29f24e67a8684bc97542` / 來源分佈:初始 patch 內既有缺陷 8(r1×3 + r2×3 + r3×1 + Step5×1 F3 決策 audit)・初始 patch 漏改的外部 consumer 1(r1 P1 敘述宣稱過寬 = 未同步的 SSOT)・baseline 後新增/修改引入 7(r2 診斷輸出格式引入 → r4/r5 scope note 死循環 → Step5 F4 push event scope 遺漏是 scope note 沒明列 event 面)
> **7 步 checklist 狀態**:1 ✅ / 2 ✅(D0-D7 全 sensible default 通過)/ 3 ✅(2 phase atomic commits + 5 輪 fix commits + bookkeeping)/ 4 ✅(5 rounds 收乾 + Owner 拍板 r5 死循環 defer)/ 4.5 ✅(模板 repo 例外人工判定不進高風險車道)/ 4.6 ✅(未觸發)/ 5 ✅(fresh 審 + 本 entry bookkeeping)/ 6-7 待執行

> 更早的 entries(2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
