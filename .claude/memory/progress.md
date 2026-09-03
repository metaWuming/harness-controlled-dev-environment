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

📅 2026-09-03 ⑨ — **P2#3 defer ⑩:formatReport([]) 純函式 fail-open + defense-in-depth 第二道防線**

> **緣起**:TODOS P2#3 Step 5 defer 集合 ⑩(conf 6):「`formatReport([])` 回 code 0,純函式對空輸入 fail-open、只靠 listSpecFiles 前置擋」。Codex supervisor(defer ⑦ 收工後)拍板本 sprint 單條;理由「剩餘清單中直接改變 guard outcome 的結構性缺口」。frozen base `926fce2ffd6e740c508e4448d5978b31034d63f5`(main tip post-defer ⑦ PR #55);plan 1 rev APPROVE。
> **改動**:**5 檔 / 4 commits**(Phase 1-3 + r1 fix + Step 5 fix,tip `9b53435a34d1f120a0d82a733ad64641853e2144`)。`scripts/check-mutation-specs.ts`:formatReport 加空 results preflight fail-closed 分支(code 2 + diagnostic「結果集為空——沒有任何 spec 檔被檢查(defense-in-depth 第二道)」;放函式最頂表達 preflight 意圖);檔頭 docstring D5 契約 + exit 2 契約段補述 defense-in-depth 第二道。`tests/check-mutation-specs.test.ts`:加 direct unit「空 results → code 2」(M7 direct killer)。`scripts/mutations/mutation-spec-drift.json`:MSD-M2 label 校正(killer 明列 = 既有 unit L82-90 `.ok===false + reason.toContain('沒有任何 spec 檔')` 直接斷言,不靠 exit code)+ 加 MSD-M7(攻 formatReport 新分支、killer 明列 = direct unit code+text 兩條斷言)+ label 補述兩層 killer 分工。`scripts/control-catalog.json` CTRL-CI-013 evidence/degradation 補「或 formatReport 結果集為空 defense-in-depth 第二道」;`scripts/mutations/README.md` 條目 6→7 條;`docs/CONTROL-CATALOG.md` catalog:render 產物。**禁區守住**:mutate.ts / discoverSpecFiles / walker / checkSpecFile / runCheck 核心邏輯未動、其他 sprint 3-5 lib / 其他 defer / 其他 mutant / CI 骨架未動。
> **驗證(`9b53435a34d1f120a0d82a733ad64641853e2144` 實測)**:typecheck / lint / vitest 30 檔 1011 passed + 3 skipped 全綠(+1 M7 direct unit);check:mutation-specs 12 spec 129 探針對得上(mutation-spec-drift 6→7);check:catalog 32 controls 綠;catalog:render idempotent;mutate --spec mutation-spec-drift.json --cmd "npx vitest run tests/check-mutation-specs.test.ts" → **7/7 killed** 綁 `9b53435a34d1f120a0d82a733ad64641853e2144`(M1/M2/M7/M3/M4/M5/M6 全被抓、含新 M7 direct unit killer + M2 校正後 label unit killer;defense-in-depth 兩道防線各自驗)。
> **審查**:Codex plan review 1 rev APPROVE;Codex Step 4 2 rev(r1 **1 P1 行為級**「M2 killer 靠 CLI e2e ④ stderr 間接、違反獨立 killer 原則」→ 修 script 第二道 text 加「沒有任何 spec 檔」子句、M7 find/replace 同步 → M2 mutant e2e ④ 兩斷言都通過、M2 只靠 unit 直接殺;**r2 APPROVE 0 unresolved** 綁 1d7297c、獨立 clone mutation-spec-drift 7/7 killed)。Step 5 標準審 **3 INFORMATIONAL 0 CRITICAL**(F1 conf 5 檔頭 docstring 未同步、F2 conf 4 formatReport preflight 位置、F3 conf 3 M7 label 精確性);Step 5 worktree 審 r1 **2 INFORMATIONAL 0 CRITICAL**(W1 conf 4 檔頭 exit 2 契約 + W2 conf 4 D5 契約 = 同 F1 SSOT 姐妹)。**4 條全修**(F1/W1/W2 SSOT 三處合併補 + F2 位置移函式最頂 + F3 label 補述);Step 5 fix commit `9b53435`;worktree r2 對新 tip 收斂 **0 CRITICAL、0 fresh conf≥7 INFO**(2 條 conf 3 純觀察 skip;vitest 15 e2e fail 是 worktree 缺 tsx bin 環境雜訊、非迴歸;主 checkout 43 passed 已驗證)。
> **⭐ 教訓**:①**defense-in-depth 第二道防線是純函式契約完整性、不能只靠 caller 保證**——formatReport([]) 純函式對空輸入 fail-open、目前靠 runCheck 前置 discoverSpecFiles 拒判來確保永不觸發;若第一道 被 mutant / refactor 誤刪,第二道應接住而非撞 fail-open。修法:formatReport 內加 preflight fail-closed 分支(code 2 + 明確 diagnostic 區分兩層)。②**兩道防線 mutant 需各自獨立 killer**——原 MSD-M2 kill 靠「第一道失效 → 第二道 fail-open → exit code 從應 2 掉到 0」兩層 combined;修 formatReport([])→code 2 讓 M2 存活(第二道接住);修法:M2 label 校正 killer 為 unit `.ok===false` 直接斷言、加 M7 專攻第二道、CLI e2e ④ 對 M2/M7 皆 exit 2 屬預期不算 killer(supervisor 明列)。③**兩層 diagnostic 都要含穩定子句避免 label 間接 kill**——Codex Step 4 r1 P1:M2 mutant 走第二道時 stderr 少「任何」二字 → e2e ④ stderr 斷言不通過 → M2 靠 e2e 間接 kill、違反獨立原則;修法:第二道 text 加「沒有任何 spec 檔」子句(同時保留「formatReport 結果集為空」明確辨識第二道)。④**preflight 檢查放函式最頂表達意圖**——雖然放最後靠 filter/reduce/for short-circuit chain 對空 results 也 fall-through 到 return code 0,但語意上「空一律拒判」是 preflight;放最頂對後續 refactor robust(F2 保守修)。
> **⏭️ 下一棒候選**(hint 非 truth):A. P2#3 defer 其餘 9 條(④⑥⑧⑨⑪-⑮ 逐條 0.5h;含本 sprint F1-F3 措辭 nit + 前 sprint defer ⑦ F1-F4 + defer ⑤ Step 5 defer 集合);B. A3 defer 其餘 20 條;C. A2 defer 集合(17 條 INFO);D. Milestone B1;E. P2#2 defer 集合(8 條);F. A1.1 defer 集合(23 條)。
> **check:claims 逐條處置**:0 新命中(本 sprint 只加 formatReport 分支 + docstring 補述 + mutant label、無新宣稱句)。
> 📊 成本:CC ~2.5h / 跨模型 review 2 rounds(Codex Step 4 r1 P1 修 + r2 APPROVE)/ P1 1 個(M2 killer 靠 e2e ④ 間接、text 少「任何」)/ P2 0 個 / Step5 獨立發現 5(0 CRITICAL、標準審 3 + worktree r1 2 去 F1/W1/W2 SSOT 同源合併 = 3 唯一;修 4 條、skip 0)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、極窄 sprint、單檔核心 diff)+ adversarial-reviewer 標準審 + isolation:worktree 2 輪(r1 對 1d7297c、r2 對 9b53435 收斂;r2 一度 stall fail、重派後成功);Codex gpt-5.6-terra medium(w2:p8)plan 1 rev + Step 4 2 rev;baseline `926fce2ffd6e740c508e4448d5978b31034d63f5`;來源分佈:既有缺陷 0・漏改 consumer 0・baseline 後引入 5(Codex Step 4 1 P1 修 + Step 5 4 INFO 修)
> **7 步 checklist**:1 ✅ plan 1 rev + Codex APPROVE + impact 5 axis 盤點 / 2 ✅ Owner「plan approve = go」/ 3 ✅ Phase 1-3 atomic commits(bd123ea/9eba2b4/4204e32)/ 4 ✅ Codex 2 rev r1 P1 修(1d7297c)→ r2 APPROVE / 4.5 ✅ 高風險車道(governance gate、mutation label 命中 CTRL-CI-013 覆蓋率佐證)、探針 7/7 綁 `9b53435a34d1f120a0d82a733ad64641853e2144` / 4.6 ✅ 未觸發(無 UI)/ 5 ✅ 標準審 3 INFO + worktree r1 2 INFO 全修 → r2 收斂 0 CRITICAL / 6-7 待執行(Owner 已授權 CI 綠自動 merge)

📅 2026-09-03 ⑧ — **P2#3 defer ⑦:MSD-M1 / MSD-M5 mutant kill 機制與 label 不符**

> **緣起**:TODOS P2#3 Step 5 defer 集合條目 ⑦(conf 8):「MSD-M1 / M5 實際 kill 機制是 TypeError 走 exit 2,與 label『判 DRIFT / untrusted』不一致」——**登錄時的簡寫**(defer ⑤ Step 5 worktree 審 r1-r2 快速登錄、細節未逐一 trace)。Codex supervisor(defer ⑤ 收工後)拍板下一 sprint = P2#3 defer ⑦ **單條**(不併 ④、⑥、⑧-⑮ 及本輪新增 defer);frozen base `e95403fff1a30cc961095591130d2be96f521743`(main tip post-defer ⑤ PR #54);plan 1 rev APPROVE。**Step 1 execution trace 校正舊簡寫**:M1 實測是 catch fallback drift(exit 1、非 exit 2)、M5 unit 是 pure TypeError 傳播(未被 catch)、M5 對本 repo 額外命中 self-reflection drift(exit 1);supervisor「TypeError→exit2」原描述細節不精確、但根因對(kill 不走 label 宣稱的判定分支)。
> **改動**:**1 檔 / 2 commits**(Phase 1 mutation-spec + Phase 2 bookkeeping、tip 待 Step 6 push 後綁)。`scripts/mutations/mutation-spec-drift.json`:MSD-M1 / MSD-M5 兩條 find/replace/label 重設計(6+/6-):MSD-M1 find 從單行 `if (!self.ok || !self.original) {` 擴到整段 3-line block(含 return untrusted);replace 為判 status="ok" + problems=[](fail-open、繞開 JSON.parse)。MSD-M5 find 從單行 `if (!target.ok || !target.original) {` 擴到整段 4-line block(含 problems.push + return);replace 為 `if (...) { return; }`(silently skip、不 push、不 applyMutation)。label 校正:M1「fail-open、繞 JSON.parse」+ M5「fail-open、silently skip、非 TypeError」。**未動**:scripts/check-mutation-specs.ts 本身(0 line)、scripts/mutate.ts checkTarget、其他 spec(M2/M3/M4/M6)、sprint 3-5 lib、其他 defer、CI 骨架、catalog、tests。**極窄 sprint、單檔 JSON 改動**。
> **驗證(`97e32c79926fa6ca601c60a9ab96ef081a45af58` 實測)**:typecheck / lint / vitest tests/check-mutation-specs.test.ts 42 passed + 1 skipped 全綠(⑯ macOS APFS case-insensitive 環境 skip、如預期);check:mutation-specs 12 spec 128 探針樣本對得上;check:catalog 綠;mutate --spec mutation-spec-drift.json --cmd "npx vitest run tests/check-mutation-specs.test.ts" → **6/6 killed** 綁 `97e32c79926fa6ca601c60a9ab96ef081a45af58`(M1/M2/M3/M4/M5/M6 全被抓,含新 M1/M5 走真實判定分支)。
> **審查**:Codex plan review 1 rev **APPROVE**(範圍、禁區、Phase 拆分、execution trace 均可接受;新 mutant D1/D2 為 fail-open 走真實分支);Codex Step 4 cross-model review 1 rev **APPROVE 0 findings**(獨立 clone 對 base→tip 全範圍實測、M1 繞 JSON.parse/catch、M5 繞 push/applyMutation、find block 唯一、6/6 killed 還原乾淨)。Step 5 標準審 **4 INFORMATIONAL 0 CRITICAL**(全 conf 3-4:F1 M5 label vitest halt-first 措辭精準性、F2 M5 label「非 TypeError」歷史對照獨立讀不明所以、F3 M1 label 對 e2e ⑤ / unit 覆蓋面描述略窄、F4 M1 label「繞開 JSON.parse」措辭易誤讀 → **依 SOP conf < 5 預設 skip、記入 defer**)。Step 5 worktree 獨立審 **0 CRITICAL、0 INFO**(setup gate 全綠、mutate 6/6 killed 綁 tip、diff 只 1 檔、禁區守住、fail-open 邊角在 label 預期範圍內)。
> **⭐ 教訓**:①**mutant label 命名精準性 vs 實際 kill 機制**——快速登錄時的 label 簡寫(如「TypeError→exit2」)可能與實測歷程不符;defer ⑤ Step 5 快速 defer 登錄的 conf 8 mutant label 問題,實際細分成三種 kill 路徑(M1 catch fallback drift exit 1 / M5 unit pure TypeError / M5 對本 repo self-reflection drift exit 1)、都不是「TypeError→exit2」單一形狀。修法:重設計 mutant 讓 replace **顯式**走真實判定分支(fail-open 語意直接對應 label)、避免依賴 exception 傳播或 self-reflection 撞牆為 kill 機制;label 說「不再判 X → 拿 Y」時,實測要能直接對照到 X→Y 純函式路徑。②**Step 1 execution trace 必附**(supervisor plan review 要求)——當 defer 條目是「label 與實測不符」類型時,plan 必先手動 dry-run 蒐證(改壞 script → 跑對應測試 → 觀察 stderr / status → 還原)、把實測 kill 路徑寫進 plan;否則 mutant 重設計可能繼續走 exception 路徑、修不到根本問題。③**mutation-spec 是自反射守門**——mutation-spec-drift.json 自身守 check-mutation-specs.ts;若 mutant find 逐字含被 mutant 改的行本身,對本 repo 跑 script 會撞 self-reflection drift(exit 1、drift 判定)、非「target 檢查缺失」kill 路徑。修法:mutate --cmd 縮到 tests 檔避免 self-scan;或 mutant 用 3-4 line block 讓 find 不重疊 mutant 改的關鍵行(本 sprint 選前者)。
> **⏭️ 下一棒候選**(hint 非 truth):A. P2#3 defer 其餘 10 條(④⑥⑧⑨⑩⑪⑫⑬⑭⑮ 逐條 0.5h;含 defer ⑤ Step 5 defer 集合的 F2/F3/F4 + W3/W4 + r3/r4 findings、及本 sprint Step 5 標準審 4 條 label 措辭 nit);B. A3 defer 其餘 20 條(⑬⑭⑮ 一起收 0.5h);C. A2 defer 集合(17 條 INFO);D. Milestone B1;E. P2#2 defer 集合(8 條);F. A1.1 defer 集合(23 條);G. progress.md 歸檔(19.3 KB / 20 KB、下一 sprint 前建議、可與任何 sprint 併)。
> **check:claims 逐條處置**:0 新命中(本 sprint 只改 mutation-spec-drift.json 純 JSON、無新宣稱句加入 lib 檔頭 / docs 主張)。
> 📊 成本:CC ~1.5h / 跨模型 review 1 round(Codex Step 4 r1 APPROVE 0 findings)/ P1 0 個 / P2 0 個 / Step5 獨立發現 4(0 CRITICAL、標準審 4 conf 3-4 全 skip、worktree 審 0)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、極窄 sprint)+ adversarial-reviewer 標準審 + isolation:worktree 1 輪;Codex gpt-5.6-terra medium(w2:p8)plan 1 rev + Step 4 1 rev;baseline `e95403fff1a30cc961095591130d2be96f521743`;來源分佈:既有缺陷 0・漏改 consumer 0・baseline 後引入 4(全部 Step 5 標準審 label 措辭 nit、defer)
> **7 步 checklist**:1 ✅ plan 1 rev + Codex APPROVE + execution trace 附進 plan / 2 ✅ Owner「plan approve = go」/ 3 ✅ Phase 1 atomic commit(97e32c7)+ dry-run 逐一驗 M1/M5 走真實分支 / 4 ✅ Codex Step 4 r1 APPROVE 0 findings / 4.5 ✅ 高風險車道(governance gate 邊、mutation label 命中 CTRL-CI-013 覆蓋率佐證)、探針 6/6 綁 `97e32c79926fa6ca601c60a9ab96ef081a45af58`(dry-run 已驗:M1→status=ok、M5→status=ok、皆非 exception/catch/self-reflection)/ 4.6 ✅ 未觸發(無 UI)/ 5 ✅ 標準審 4 INFO conf 3-4 全 skip + worktree 審 0 findings / 6-7 待執行(Owner 已授權 CI 綠自動 merge)

> 更早的 entries:2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
