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

📅 2026-09-04 ③ — **P2#3 defer ⑪:--root 契約 wontfix + 三處 SSOT 文檔補述(nested outer-tracked 不支援、real repo top-level 為要求)**

> **緣起**:TODOS `TODOS.md` L80 P2#3 Step 5 defer 集合 ⑪(conf 5):「`--root` 指外層 repo 子目錄時『repo 內』與『tracked』兩個邊界不同」。Codex supervisor(defer ⑥ 收工後)拍板本 sprint 單條、evidence-first、不預設 fix。frozen full base `68f2f21636781c69ffe14ee985ef57d284526189`(origin/main tip post-defer ⑥ PR #58);plan 1 rev(rev 1 2 P2 修 = phase 拆分 P1 atomic docs + P2 bookkeeping / SSOT 三處全同步 加 README、rev 1 APPROVE + GO Step 3);D1 = OPT-A wontfix + documented --root contract(exploitability 低、非 CRITICAL、標準車道 CSO_NOT_REQUIRED)。
> **改動**:**4 檔 / 2 commits**(P1 atomic docs + P2 bookkeeping、無 runtime 改動)。P1(`aeef033`):`scripts/check-mutation-specs.ts` 檔頭 docstring Usage 段加 --root 契約 block(real git worktree top-level 為要求、nested outer-tracked 不支援屬使用者責任、真獨立 nested repo 邊界對得上、boundary-escape 由 isInsideRepo 於 checkTarget/readCheckedTarget 內擋、SSOT 三處指涉);`scripts/control-catalog.json` CTRL-CI-013 notes 補述 defer ⑪ 契約段 + 指向 script 檔頭 + README;`docs/CONTROL-CATALOG.md` catalog:render 產物同步(25755→26029 bytes、atomic 與 JSON 同一 commit);`scripts/mutations/README.md` 「discovery 契約」段加 --root 契約條目 + 「CI 守樣本漂移」段補述。P2:progress + TODOS 標 ⑪ ✅ + 交付段(wontfix + docstring 補述)。**前置 SSOT check**:mutation-spec-drift / discovery find 樣本掃過、全命中 check-mutation-specs.ts code body,不觸及檔頭 docstring(supervisor 明列前置);本 sprint 只改檔頭 + catalog + README、mutation 樣本安全不漂。**未動**:runtime code / test / spec / checkTarget / readCheckedTarget / writeCheckedSync / mutate main CLI / discovery contract D1-D7 定義 / MSD-M1-M8 / MSD-D1-D6 定義 / 其他 CTRL / 其他 defer。
> **驗證(`aeef033907e63b87eceef0df2318180c788b9ef2` 實測、feature worktree `.claude/worktrees/impl-p2-3-defer-11` 隔離跑)**:typecheck / lint 綠;check:catalog 32 controls 綠;catalog:render **idempotent**(第二次跑 26029 bytes 不變);check:mutation-specs 12 spec 130 探針對得上;check:doc-refs **520 refs / 0 失效**;vitest 30 檔 1021 passed + 3 skipped(綁 base tip 有效、無 test 改動);mutation-spec-drift / discovery 綁 base tip 有效(P1 不改 code body、探針覆蓋不受影響)。
> **審查**:Codex plan review 1 rev(rev 1 **2 P2**:P2-1 phase 拆分 P1 atomic docs + P2 bookkeeping、P2-2 SSOT 加 README;修完 rev 1 內同輪 APPROVE + GO Step 3);Codex Step 4 commit-only(待送);Step 5(待、標準車道 CSO_NOT_REQUIRED 不加 worktree 獨立審)。**證據優先實測**:5 隔離 fixture scenario(/tmp/defer11-*、rm -rf 可還原):A(nested + outer tracks)= exit 0 邊界不一致(defer ⑪ 情境)、B(獨立)baseline、C(nested + outer 未 tracked)= exit 2 fail-closed、D(nested 有自己 .git)邊界對得上、E(boundary-escape)= exit 1 isInsideRepo 擋。**exploitability 低**(CI 不用 --root、tests 用獨立 fixture、非典型使用場景)。
> **⭐ 教訓**:①**evidence-first plan mode 對「conf ≤ 5、非 CRITICAL、性質模糊」defer 條目最有價值**——supervisor 明列不預設 fix,先實測 5 scenario 分類 exploitability(A 是 exit 0 但非 CI 路徑、B/D 邊界對得上、C/E 已 fail-closed 擋),再從三選項(OPT-A wontfix + docstring / OPT-B runCheck 加 sanity / OPT-C flag opt-in)拍板。這比直接寫 fix code 更精確、避免為低 exploitability 問題加高風險車道成本。②**「repo 內」與「tracked」是兩個獨立信任邊界、應在 docstring 明列契約**——checkTarget 的 isInsideRepo(純字串)+ git ls-files(cwd 找 .git 沿上)兩者用不同 repo boundary、當 --root 是 outer 子目錄時分歧;runtime 是「使用者責任」但 docstring 沒說,contract SSOT 缺一角。修法:三處 SSOT(script 檔頭 + catalog notes + README)全補「--root 假設 real repo top-level」契約,讓使用者非典型使用時能查到明確契約。③**P1/P2 atomicity + bookkeeping-only 分離的 SOP 意義**——rev 1 P2-1 明列:混合 docstring + catalog + TODOS bookkeeping 在同一 commit 會**同時**帶 SSOT source 改動 + bookkeeping,無法 satisfy check:bookkeeping allowlist(allowlist 只准 progress / TODOS / archive)。修法:P1 atomic docs commit(SSOT 4 檔)+ P2 bookkeeping-only commit(memory 3 檔),各自可獨立 revert、check:bookkeeping 過。
> **⏭️ 下一棒候選**(hint 非 truth):A. P2#3 defer 其餘 6 條(④⑨⑫⑬⑭⑮ 逐條 0.5h;含 defer ⑤/⑦/⑩/⑥ Step 5 defer 集合 label 措辭 nit);B. A3 defer 其餘 20 條;C. A2 defer 集合(17 條 INFO);D. Milestone B1;E. P2#2 defer 集合(8 條);F. A1.1 defer 集合(23 條)。
> **check:claims 逐條處置**:0 新命中(本 sprint 純 docstring / notes / README 補述、無新絕對化宣稱句加入 lib 檔頭)。
> 📊 成本:CC ~0.5h / 跨模型 review 1 round(Codex plan rev 1 2 P2 修 + APPROVE + GO)/ P1 0 個 / P2 2 個(rev 1 phase 拆分 + SSOT 加 README)/ Step5 待
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、evidence-first 蒐證 + 5 fixture scenarios + 4 檔 doc-only 改動);Codex gpt-5.6-terra medium(w6:p1)plan 1 rev;baseline `68f2f21636781c69ffe14ee985ef57d284526189`;來源分佈:既有缺陷 0・漏改 consumer 0・baseline 後引入 2(Codex plan rev 1 2 P2)
> **7 步 checklist**:1 ✅ plan 1 rev + 5 fixture scenarios 實測 + Codex APPROVE(D1 = OPT-A、D2-D4 N/A)/ 2 ✅ Codex「plan approve = go Step 3 only」/ 3 ✅ P1 atomic docs(aeef033、4 檔 13+/2-)+ P2 bookkeeping(待本 commit)/ 4 待送 Codex Step 4 / 4.5 標準車道 CSO_NOT_REQUIRED / 4.6 未觸發(無 UI)/ 5 待跑 / 6-7 待執行

> 更早的 entries:2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
