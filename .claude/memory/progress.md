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

📅 2026-09-06 ⑥ — **D-② mutate.ts SIGTERM race Phase 0 evidence audit(STOP-AND-REPORT #1/#7、decision record、無 code 交付)**

> **緣起**:progress ⑤ ⏭️ 候選 D 單條「mutate.ts SIGTERM 不還原」。Codex Sprint 8 拍板 reframe 為 race evidence audit(非 stale「無 signal handler」;CodeGraph 已確認現行 `beginShutdown/killActiveChild/restoreAll` 路徑 + SIGINT/SIGTERM handler 皆註冊)。PR #73 CI 首次觀察到 1 次 `tests/mutate.test.ts` SIGTERM race case failure(expected GUARD_ON、拿到 GUARD_OFF)= 觸發本 sprint。frozen full base `1e873f2235124709453f2f72a2c225787cae1588`;shared local main 233858f + CLAUDE.md M(全程 lock);stash 1 支(Codex live inventory 校正)、agent-* worktrees 保留、remote 0 動。plan review r1-r5(5 rounds、4 rev、r5 APPROVE):r1-r4 逐輪校正 D3 seam(child.on close 已比 exit 晚、不改 exit;不加 mtime)、Phase 0 不設百分比門檻、Evidence matrix 6 訊號 + 4 判準、STOP 7 條、Phase 1 production 預設禁區(shutdown/signal precedence 修法 STOP-AND-REPORT)。
> **改動**:**Phase 0 evidence audit(scratchpad-only、無 code / production commit)**:
> - 蒐證 script(session-local scratchpad、不進 repo):20 iterations 本機 macOS、預掛 `once(child, "close")` promise、量測 Evidence matrix 6 訊號(kill retval、close code/signal、stderr handler marker、mutation 已落盤、close 後立即讀、短暫延後讀)+ 4 判準(shutdown ownership / signal escape / observation race / fixture-process-group)
> - **量測結果**:20/20 觀察到 SIGTERM handler 成功走完(0 個 failure);每次 kill=true / close code=2 / signal=null / stderr 含「收到 SIGTERM」handler marker / close 後立即讀已恢復 / 短暫延後仍恢復 / 無 lingering descendant/writer 症狀;elapsed 63-67ms
> - **STOP-AND-REPORT #1/#7 觸發**:本機無法 deterministic 化 CI 觀察到的 failure、無可控 test-side seam;依 plan D1 明列「不採概率型 mitigation」(不 sleep / retry / 弱化 assertion / mark flaky)
>
> **禁區守住**:`scripts/mutate.ts` runtime(signal handler / restore / shutdown precedence 未動)、`tests/mutate.test.ts`(未動)、CI workflow / timeout(未動)、mutation specs / catalog / A5 adopted-mode / shared main 233858f + CLAUDE.md M / 1 支 stash / 保留 worktrees / remote:全 0 line 動。**Phase 2 只 bookkeeping**(TODOS + progress)。
> **驗證**:Phase 0 evidence audit script 僅 scratchpad、不進 repo;20 次本機觀測 evidence matrix 全 clean;Phase 2 bookkeeping commit 前 typecheck / lint / check:doc-size / check:bookkeeping 待跑。
> **審查**:Codex plan review r1-r5(5 rounds、4 revision、r5 APPROVE);Phase 0 evidence report → Codex 拍板 STOP + DEFER + bookkeeping-only commit + 措辭校正(不寫「CI-only flaky」、只能說「單次 CI-observed failure、本機未重現」;不寫「production restore 正常」、只能說「20 次本機觀測均成功」)。Step 4 / Step 5 未觸發(無 code diff)。Step 4.5 CSO 標準車道人工 CSO_NOT_REQUIRED(bookkeeping / decision record)。Step 4.6 未觸發(無 UI diff)。
> **⭐ 教訓**:①**Reframe stale TODO 前先 CodeGraph 核實現行實作**——原 TODO 敘述「沒有 signal handler」是 stale、CodeGraph 已看到 beginShutdown/killActiveChild/restoreAll 路徑 + handler 註冊;若不核實會白改。②**Phase 0 evidence audit 屬 scratchpad-only、不進 repo**——原始 log 保留 session-local、Phase 2 progress 只寫證據摘要與 STOP 結論(避免 evidence bloat / claims 命中);Codex D2 明列。③**「單次 CI failure、本機未重現」措辭校正**——不宣稱「CI-only flaky」(可能只是 CI 端一次性 noise、也可能為未觀察到的 production race)、不宣稱「production restore 正常」(只能說 20 次本機觀測均成功)、不推論 platform-specific / observation race / actual bug(Codex 明列)。④**STOP-AND-REPORT #1/#7 觸發 vs 概率型 mitigation**——plan D1 起手就寫明「repeated run 只做頻率量測、不作 correctness 分類門檻;Phase 1 必要條件是 deterministic failing regression / 可控 seam;只 probabilistic → STOP、不採 flaky mitigation」;Sprint 8 走到 STOP 是紀律成功、非失敗。⑤**Phase 1 production 預設禁區、由 evidence 決定是否重新拍板**——shutdown ownership / signal escape 修法一律先 STOP-AND-REPORT 重新拍板 production scope,不在本 plan 直接改;此紀律避免 evidence 不足時擴大 scope。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A. A3 Step 5 defer 集合 剩 15 條 INFO conf ≤6;B. A2 Step 5 defer 集合 17 條 INFO conf ≤6;C. A1.1 defer 集合 23 條 conf ≤7 doc governance;D. **本 D 條目 pending**(需 Linux CI evidence 累積後才重新拍板 Phase 1);E. Milestone B1(新開)。
> **check:claims 逐條處置**:0 命中(base=1e873f2)——bookkeeping-only diff 無新增絕對化宣稱句。
> 📊 成本:CC ~1.5h / 跨模型 review 6 rounds(plan review r1-r5 5 rounds + Codex Phase 0 report + STOP 決策 x1)/ Step 4/5 未觸發(無 code diff)/ Phase 0 evidence audit:20 iterations 本機、0 failure、無 deterministic evidence 支持 Phase 1
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、evidence audit + bookkeeping);Codex gpt-5.6-terra high(全程 CI race audit review effort 全 high)plan r1-r5 + Phase 0 report + STOP 決策;baseline SHA `1e873f2235124709453f2f72a2c225787cae1588`;來源分佈:CI-observed 1 failure(未歸因、非本 sprint 引入)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan review r1-r5(5 rounds、4 rev、r5 APPROVE)+ CodeGraph reframe stale TODO / 2 ✅ Codex r5 APPROVE + GO Step 3 Phase 0 / 3 ✅ fresh worktree wt-d2-mutate-sigterm-race-audit + npm ci + Phase 0 evidence audit(scratchpad-only、無 commit)+ STOP #1/#7 觸發 / 4 未觸發(無 code diff、無 Step 4 commit-object review)/ 4.5 ✅ CSO 標準車道人工 CSO_NOT_REQUIRED / 4.6 ✅ 未觸發(無 UI diff)/ 5 未觸發 adversarial(無 code diff)/ Phase 2 加 ⑥ + archive ⑤ 至 progress-2026-09 + TODOS D 條目**保持 pending**(不 strikethrough)+ 加 Phase 0 evidence audit 段(scratchpad reference + STOP 結論)+ doc-size D8 4 段 gate + entry-count conservation:base archive 29 + current 1(⑤)= pre 30;新增 ⑥ 草稿後 archive 29 + current 2(⑤、⑥)= 31;final archive 30(搬入 ⑤)+ current 1(⑥)= post 31、每 entry 恰 1 次 / 6-7 待執行(Owner sprint-loop 授權)

> 更早的 entries:2026-09-06 ⑤ A3 defer ①、2026-09-06 ④ A3 defer ⑬⑭⑮、2026-09-06 ③ D-①、2026-09-06 ② P2#2 defer ⑦、2026-09-06 ① P2#2 defer ⑤、2026-09-05 ⑧ P2#2 defer ⑨、2026-09-05 ⑦ P2#2 defer ③、2026-09-05 ⑥ P3 delivery-refs 移除集合 ①+②、2026-09-05 ⑤ P2#3 defer ⑮、2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
