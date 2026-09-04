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

📅 2026-09-05 ⑤ — **P2#3 defer ⑮:SOP Step 6 target list coverage repair + decision closure(narrowly scoped、SOP L423-425 加 root TODOS.md、preserve legacy、P2#3 集合 closed)**

> **緣起**:TODOS `TODOS.md` L80 P2#3 Step 5 defer 集合 ⑮(conf 5、集合最後 1 條):「PR-number placeholder token 佔位靠 Step 6 補號(A3 defer ② 同形)」。**r1-r3 誤判 chronology**:r1-r3 認定為「既有 SOP contract 完整覆蓋、pure decision-record」;supervisor Step 5 stop-and-report / NEEDS-REVISION 深挖 **根本 CRITICAL**:SOP `.claude/sop/plan-mode-checklist.md` L423-425 grep pattern target list 只列 legacy `.claude/memory/{TODOS,TODOS-done,BACKLOG}.md`;本 repo 實際 marker consumer = root `TODOS.md`(`scripts/check-todos-markers.ts` MARKER_DOCS)、live placeholder 也在 root、現行 command 對本 repo 是 no-hit、placeholder 靜默漏補。**r4 scope 校準**:narrowly scoped SOP coverage repair + decision closure;唯一功能修法 = L423-425 target list single-line add root `TODOS.md`、preserve legacy 三檔;不加 code / CI / hook / staging automation。**r5**:D2 lock fresh worktree(去 reset --soft 二選一);D4 L80 描述式(去逐字連續 PR-number placeholder token literal);所有「sed 誤判」措辭改「placeholder fill-in scope error」(F7:sed 未證實、非官方機制)。**r6**:D1.1 時序統一「post-commit range proof」(commit 後在新 tip 跑 range diff、不加 --cached)。**Frozen base**:`4bd0abc496e832cbc5e636939359f3c0f122bd09`(origin/main tip、defer ⑭ squash);shared local main 仍在 233858f + CLAUDE.md M(全程不 pull/touch)。
> **改動**:**Phase 1 atomic 2 檔**(supervisor r4-r6 lock):(a) `.claude/sop/plan-mode-checklist.md` L423-425 target list single-line add root `TODOS.md`、preserve legacy `.claude/memory/*` 三檔(對 adopted repo 無 breaking、grep 對缺檔 no-hit);(b) `TODOS.md` 三處:L78 header 精確閉合集合表述(去 stale「12 條 INFORMATIONAL conf ≤8」count、寫「①–⑮已交付或決策、collection closed;含 ④ WONTFIX 決策記錄、非 code 交付」)、L80 ⑮ strikethrough + 描述式(改「PR-number placeholder token」、去逐字連續 literal 避 D1.1 count>1)、加決策段(⑮、無 code 交付、decision-record + SOP L423-425 coverage repair;引用 SOP 三段行號截 2026-09-05;observed defer ⑭ 精確;D9 anti-overclaim 5 點 + r1-r3 誤判承認;敘事引文全描述式避 placeholder fill-in scope error;不斷言具體 fill-in tool)。**禁區守住**:`scripts/check-todos-markers.ts` CI advisory 邊界 / runtime / tests / CI(ci.yml)/ catalog / mutation specs / hook / staging 全 0 line 動。**Phase 1 tip**(`f9a97b8`)+ **Step 5 F1 fix tip**(`6186046`、D9 header「4 點明列」→「5 點明列(4 anti-overclaim + 1 acknowledgment)」label 一致性、無語意 / 範圍改)。
> **驗證(`6186046d303b8280ac2a01038a588e9a676dab7f` 實測、fresh worktree wt-defer-15-sop-repair 隔離跑、supervisor r5 fresh 建 lock)**:typecheck / lint 綠;`npm test` 全 suite **30 files / 1023 passed + 3 skipped**;`npm run check:todos` 10 個 PR 完成宣稱、10 有 merge 證據、0 失效;`npm run check:doc-refs` 582 refs、0 失效;`npm run check:doc-size` progress.md 19.8 KB / 20 KB(99%);`npm run check:mutation-specs` 12 spec 130 條探針全對得上;`npm run check:catalog` CATALOG_OK 32 controls;**D1.1 post-commit range proof**:`git diff 4bd0abc..HEAD -- TODOS.md | grep -cE '^\+.*PR #___'` = **1**(唯一 live placeholder in 決策段 header);full diff stat vs base:2 檔 4+/-2。
> **審查**:Codex plan review r1-r6 6 rev(r1-r3 decision-record only → NEEDS-REVISION;r4 supervisor stop-and-report SOP L423-425 gap 校準 scope;r5 fresh worktree lock + L80 描述式 + sed 措辭改 placeholder fill-in scope error;r6 D1.1 時序改 post-commit range proof;r6 final APPROVE + GO Step 3);Codex Step 4 commit-object 對 Phase 1 tip `f9a97b8` **APPROVE**(獨立 clean clone、frozen full range、2 檔 atomic、SOP 僅加 root TODOS.md 保留 legacy、D1.1 count=1、decision closure 正確承認 gap、無 automation/CI overclaim、0 findings);Step 5 adversarial-reviewer round 1 **0 CRITICAL、6 INFORMATIONAL、10 檢查全 CONFIRMED clean**;supervisor 分類拍板:**F1 conf 4 修**(D9 header label 一致)、**F2/F3/F4/F5/F6 conf ≤5 全 skip 記非阻斷**(F3 latent trap 出自既有 A5 register L117、pre-existing、本 sprint 不動、不擴 scope 為 acknowledgement);Step 5 rereview 對 F1 fix tip `6186046` **APPROVE**(僅 label 4→5 一致性修、無語意/scope 擴、D1.1 count=1、full range 仍 2 檔)。**標準車道人工 CSO**(SOP wording repair、無 auth/authorization/payment/PII/audit or production logic 邊界;模板 repo 路徑表為空 = 設計)。
> **⭐ 教訓**:①**「已完整覆蓋」claim 需 marker consumer evidence 支持**——r1-r3 讀 SOP L369-372 / L420-440 / L457-464 三段 wording 對齊、就下結論「契約完整覆蓋」;supervisor 深挖 `scripts/check-todos-markers.ts` MARKER_DOCS constant = 本 repo 實際 marker consumer 是 root TODOS.md、SOP L423-425 target list 沒列 root、對本 repo 是 no-hit gap;wording 對齊 ≠ command 對本 repo 生效。stop-and-report 需要 producer/consumer 對齊實測、非讀 SOP wording 表面。②**preserve legacy paths 為 adopted repo 保 backward compat**——SOP 是 template、adopted repo 若 TODOS 在 legacy `.claude/memory/*`、grep 對缺檔 no-hit 不 fail、無破壞;add root TODOS.md 只擴 target、非改 semantic;single-line add + 不改 wording 其他是 minimal scope repair 的關鍵。③**D1.1 post-commit range proof(不 preflight)是時序精確**——r6 校準:`<base>..<new-tip>` 範圍語法在 commit 前 HEAD 仍指 base、range 空、preflight 不可行;commit 後 tip 才含 committed 內容;不加 --cached 或其他機制、單一 post-commit range proof。④**placeholder fill-in scope error 是抽象名詞、tool 不斷言**——F7 指 sed 未證實 defer ⑭ observed run 是否用 sed、非官方機制;plan 改「placeholder fill-in scope error」= Step 6 fill 範圍過寬會誤改非 live token 的通用問題、實作 tool 由執行者選擇(手動 Edit / sed / 其他);敘事引文全描述式避 diff 內 grep pattern 抓多餘 hit(D1.1 count=1 保障)。⑤**adversarial round 1 = 0 CRITICAL + F1 只 label 一致性修 + F2-F6 doc fragility / latent trap 全 skip** = evidence-first + supervisor scope literal 明確 + fresh worktree pattern 的複合效果;F3 (L117 A5 register latent trap) 記為 pre-existing 已知風險、out of scope 不擴 acknowledgement(supervisor 明列)。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):**P2#3 defer 集合 100% closed**(⑮ 收條、①–⑮ 已交付或決策 15 條);A. A3 defer 剩 19 條;B. A2 defer 集合 17 條 INFO;C. P2#2 defer 集合 剩 7 條;D. A1.1 defer 集合 23 條;E. Milestone B1。
> **check:claims 逐條處置**:0 新命中(本 sprint 純 SOP wording repair + TODOS decision closure、無新絕對化宣稱句加入 lib docstring / docs 主張)。
> 📊 成本:CC ~4h(含 r1-r6 6 rev plan iteration)/ 跨模型 review 9 rounds(plan r1/r2/r3/r4/r5/r6 supervisor + Step 4 supervisor + Step 5 adversarial round 1 + Step 5 rereview supervisor)/ P1 0 個 / P2 0 個 / Step5 獨立發現 6 個(0 CRITICAL / 6 INFORMATIONAL、F1 修 / F2-F6 skip)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、SOP wording repair + decision closure、極窄 sprint 2 檔 4 lines);Codex gpt-5.6-terra medium(w6:p4)plan 6 rev + Step 4 + Step 5 + rereview approve;baseline `4bd0abc496e832cbc5e636939359f3c0f122bd09`;來源分佈:既有缺陷 1(SOP L423-425 target list 對 root TODOS.md gap、defer ⑮ 條目登錄時未被辨識為 SOP gap、supervisor 深挖後校準)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan 6 rev(r1-r6、chronology 見緣起段;r4 supervisor stop-and-report 為關鍵轉折)+ SOP 三段 + marker consumer evidence 量測 / 2 ✅ Codex r6 final APPROVE / 3 ✅ fresh isolated worktree(wt-defer-15-sop-repair、supervisor r5 lock 去二選一)+ Phase 1 atomic 2 檔 commit(`f9a97b8`、SOP +1 / TODOS +5/-2)+ Step 5 F1 fix commit(`6186046`、TODOS +1/-1)/ 4 ✅ Codex Step 4 對 `f9a97b8` APPROVE / 4.5 ✅ 標準車道人工 CSO(SOP wording repair、無 auth/authorization/payment/PII/audit or production logic)/ 4.6 ✅ 未觸發(無 UI diff)/ 5 ✅ adversarial-reviewer round 1(0 CRITICAL、6 INFORMATIONAL、10 檢查全 CONFIRMED clean、F1 修 / F2-F6 skip)+ rereview 對 `6186046` APPROVE / Phase 2 archive ⑬ + 加 ⑮ + TODOS ⑮ ✅ + entry-count conservation ✅(pre 21 + 新增 ⑮ = post 22、每 entry 恰 1 次)/ 6-7 待執行(Owner sprint-loop 授權)

> 更早的 entries:2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
