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

📅 2026-09-06 ④ — **A3 defer ⑬⑭⑮:check-baseline-governance 三處診斷資訊完整性(dangling「見 info」+ UNDETERMINED 早退丟 infoLines + 顯示契約缺 assertion、非安全繞過)**

> **緣起**:TODOS.md L121「A3 Step 5 defer 集合」⑬⑭⑮:⑬ 舊值 null 時 OK 訊息宣稱「見 info」但無對應 info line(dangling reference、conf 7);⑭ config.head.invalid / config.base.invalid 兩 UNDETERMINED 早退丟掉 infoLines(如 promotion「不套用豁免」info,conf 6);⑮ e2e 缺 UNCHANGED + info 與 directionChecked 顯示契約 assertion(conf 5)。#71 D-① squash 後、Codex supervisor w6:p4 gpt-5.6-terra 拍板 Sprint 6 = A-A3 defer ⑬⑭⑮ 三條小集合(共用結果組裝 / 診斷呈現邊界、適合一 sprint、每條獨立 regression);標準車道 CSO_NOT_REQUIRED(governance diagnostic correctness、非安全繞過);review effort plan/adversarial medium + Phase 1 commit-object/frozen full-range final high。frozen full base `1fe770f1465da1f570c9645ffe25874a3ef86286`(origin/main tip = #71 squash);shared local main 233858f + CLAUDE.md M(全程 lock)。plan review r1-r4(4 rounds、3 rev、r4 APPROVE):r1 3 P1(⑭ regression 需以非空 infoLines 的 head/base invalid 獨立 case、D3 固定 exact e2e test + 6 契約觀測點、⑬ 插入條件 + doc-size D8 4 段時序明文化 + 清除數字式 line pin);r2 3 P1(⑭ 錯把 template baseline fallback 當 promotion info 來源、assertion 計數 5→6、Phase 1 / targeted command wildcard + 殘留 line pin 修正);r3 1 finding(仍混淆 template fallback 與 promotion 前置、改為傳 headRef 且令 merge-base 的 scripts/harness.config.json 缺失 / 解析失敗、⑮a 同步採該前置);r4 全數修正後 APPROVE + GO Step 3。附記 D「mutate.ts SIGTERM 不還原」= Codex 認定 stale TODO(現行 async child process + process-group SIGTERM→SIGKILL + single-flight beginShutdown + restoreAll + SIGINT/SIGTERM handler、非未實作 1h code sprint、需另核實交付來源、不在本 sprint scope)。
> **改動**:**Phase 1 atomic 2 檔 +131/-2**(tip `46aad274d040dbf2bac214980f0e6d19a90b128e`):
> - `scripts/check-baseline-governance.ts`:⑬ 在 newVal 40-hex + nvSha 可解析 + oldVal===null(非 template)分支內 push infoLines「首次設定 baseline(舊值為 null / 缺),無舊值可對照、略過方向檢查」;⑭ config.head.invalid / config.base.invalid 兩 early-return 改用 push-then-return pattern(對照 diff.unavailable)附 infoLines
> - `tests/check-baseline-governance.e2e.test.ts`:加 6 個獨立契約 case((23) ⑬ / (24) ⑭a config.head.invalid + promotion info / (25) ⑭b config.base.invalid + promotion info / (26) ⑮a UNCHANGED + info / (27) ⑮b directionChecked=true / (28) ⑮c 方向略過必有 info)
>
> **禁區守住**:READY/UNDETERMINED/UNCHANGED/FAIL 判定與 exit code 語意 / 全 finding code / fail-closed / baseline / delivery-ref / protectedBranches / adoption trust boundary / mutation specs / CI workflow logic / catalog schema / mutation runner / shared main 233858f + CLAUDE.md M / 2 支 stash / 保留 worktrees / remote:全 0 line 動。
> **驗證(fresh worktree wt-a3-defer-13-14-15、frozen tip 46aad27、非 preflight)**:git diff 1fe770f..46aad27 --stat 2 檔 +131/-2;typecheck / lint 綠;`npx vitest run tests/check-baseline-governance.e2e.test.ts` **30 pass**(base 24 + 6 A3);`npm test` 全 suite **31 files / 1042 passed + 3 skipped**(base 1fe770f 1036 + 6 A3);check:mutation-specs 12 spec / check:catalog CATALOG_OK 32 controls / check:doc-refs / check:adoption T8 全綠。**反向探針**(base parser + new tests):**4 個 mutation-sensitive case**((23) ⑬ / (24) ⑭a / (25) ⑭b / (28) ⑮c)全轉紅、**2 個 characterization case**((26) ⑮a / (27) ⑮b)兩版皆過(鎖既有顯示契約 wording 避未來 renderer 漂移、非本 sprint mutation 觸及範圍);restore new parser → 6/6 pass。
> **審查**:Codex plan review r1-r4(4 rounds、3 revision、r4 APPROVE);Codex Step 4 commit-object 對 `46aad27` APPROVE(逐 hunk clean、控制流正確、⑭b fixture 「merge-base baseline invalid + HEAD baseline valid」確實形成、⑮a/b/c 契約鎖住,非阻斷觀察:(23)(28) fixture 相似但 assertions 表達不同契約)。Step 4.5 CSO 標準車道人工 CSO_NOT_REQUIRED(governance diagnostic correctness、非安全繞過、無 auth/authorization/payment/PII/production trust-boundary 放寬)。Step 4.6 未觸發(無 UI diff)。Step 5 adversarial round 1 **0 CRITICAL / 5 INFORMATIONAL**(F1 conf 6 (26)(27) characterization-not-⑬⑭⑮ scope、F2 conf 5「首次設定」info 洩漏到 FAIL、F3 conf 5 (23)(28) 重複、F4 conf 4 (28) 未斷 exit code、F5 conf 3 info order 未鎖);supervisor 分類:**F1 FIX**(僅 bookkeeping accuracy、progress/TODOS 需寫「4 mutation-sensitive + 2 characterization」)、**F2-F5 KEEP 不 defer**(F2「首次設定」是狀態描述非治理判定成功宣稱、與 FAIL 不矛盾且提供有用 rationale、加 f.length===0 gate 會失去 FAIL 診斷資訊;F3 (23) 驗 ⑬ 新增 info、(28) 驗 ⑮c「任何方向略過訊息都必須有對應 info」是獨立顯示契約、契約不同不刪不合併;F4 (28) status 已由同形 (23) 鎖、單獨補 exit assertion 收益低會增重複斷言;F5 info order 非公開契約、鎖順序增測試脆性);Phase 1 tip 46aad27 不動、無 round 2 adversarial 需要(F1 純 bookkeeping、F2-F5 全 KEEP)。
> **⭐ 教訓**:①**「見 info」dangling reference 是 diagnostic UX 缺口非 correctness bug**——原 fix 不改判定/exit code/finding code、僅 push info line 補完 OK renderer 承諾的 rationale;plan 影響描述必須精確反映現況(r1 P1「不擴大到誤放行/誤擋」)。②**早退保留 infoLines 屬 push-then-return pattern**——對照 diff.unavailable 分支既有 pattern、不新增 helper、對稱 config.head.invalid / config.base.invalid 兩處(其他早退發生在 infoLines 初始化前、無 scope 蔓延)。③**顯示契約 assertion 可以是 characterization** 而非全 mutation-sensitive:(26)/(27) 鎖既有 wording 避免未來 renderer 漂移,(23)/(24)/(25)/(28) 鎖本 sprint 新行為;bookkeeping 需**精確區分「4 mutation-sensitive + 2 characterization」**不含糊寫「6 全 mutation-sensitive」(supervisor F1 明列)。④**INFO 分類支援 KEEP 不 defer**(F2-F5):「首次設定」info 提供 rationale 資訊價值 > FAIL 混淆風險、(23)/(28) 契約分工明確、info order 非公開契約——不擴 scope 拒絕 gold-plating。⑤**單條 diagnostic fix + 集合 review round 密度適中**:plan r1-r4(4 rounds、3 rev)+ Codex Step 4 x1 APPROVE + adversarial x1 + supervisor 分類 x1 = 7 rounds、對比 defer ⑤ 的 15 rounds、taxonomy 級 refactor vs 集合式 diagnostic fix 的合理密度差。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A. A3 Step 5 defer 集合 剩 16 條 INFO conf ≤6(已扣 ⑬⑭⑮);B. A2 Step 5 defer 集合 17 條 INFO conf ≤6;C. A1.1 defer 集合 23 條 conf ≤7 doc governance;D. 單條:mutate.ts SIGTERM(Codex 認定 stale TODO、需另核實交付來源、bookkeeping closure 或另辦);E. Milestone B1(新開)。
> **check:claims 逐條處置**:30 命中(base=origin/main、1fe770f):主要為 pre-existing 於 base(D-① Sprint 5 已 merge 內容)+ archive ③ D-① entry 之 byte-for-byte 搬移(進 archive)+ 少量本 sprint 描述性 wording;全部 KEEP、0 個 actionable 新絕對化宣稱句。
> 📊 成本:CC ~1.5h / 跨模型 review 7 rounds(plan review r1-r4 4 rounds + Codex Step 4 x1 對 46aad27 APPROVE + adversarial x1(5 INFO)+ supervisor 分類 x1)/ Step 4 P actionable findings 0 個(APPROVE 一次過)/ Step 5 獨立發現 5 個(round 1 5 INFO、supervisor 1 FIX(bookkeeping)+ 4 KEEP、無 round 2 需要)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、集合式 diagnostic fix、3 條共用結果組裝邊界);Codex gpt-5.6-terra medium(plan / adversarial)+ high(Phase 1 commit-object / frozen full-range final)(w6:p4)plan r1-r4 + Step 4 x1 + adversarial x1 + supervisor 分類 x1;baseline SHA `1fe770f1465da1f570c9645ffe25874a3ef86286`;來源分佈:既有缺陷 3(⑬⑭⑮ diagnostic gaps、A3 Step 5 defer 集合登錄時已存在)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan review r1-r4(4 rounds、3 rev、r4 APPROVE)+ Codex plan review + 6 項 assertion 契約 / 2 ✅ Codex r4 APPROVE + GO Step 3 / 3 ✅ fresh worktree wt-a3-defer-13-14-15 + npm ci + Phase 1 atomic 2 檔 commit `46aad27`(單一 tip、無 review fix commit) / 4 ✅ Codex Step 4 x1 對 `46aad27` APPROVE / 4.5 ✅ CSO 標準車道人工 CSO_NOT_REQUIRED / 4.6 ✅ 未觸發(無 UI diff) / 5 ✅ adversarial round 1(5 INFO)+ supervisor 分類 1 FIX(bookkeeping)+ 4 KEEP、無 round 2 需要 / Phase 2 加 ④ + archive ③ 至 progress-2026-09 + TODOS ⑬⑭⑮ ✅ + pull request 引用位待 Step 6 補號 + doc-size D8 4 段 gate + entry-count conservation:base archive 27 + current 1(③)= pre 28;新增 ④ 草稿後 archive 27 + current 2(③、④)= 29;final archive 28(搬入 ③)+ current 1(④)= post 29、每 entry 恰 1 次 / 6-7 待執行(Owner sprint-loop 授權)

> 更早的 entries:2026-09-06 ③ D-①、2026-09-06 ② P2#2 defer ⑦、2026-09-06 ① P2#2 defer ⑤、2026-09-05 ⑧ P2#2 defer ⑨、2026-09-05 ⑦ P2#2 defer ③、2026-09-05 ⑥ P3 delivery-refs 移除集合 ①+②、2026-09-05 ⑤ P2#3 defer ⑮、2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
