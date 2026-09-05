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

📅 2026-09-06 ③ — **D-①:parseGrepZLine 支援 grep.column=true 三-NUL 格式(diagnostic framing accuracy、非安全繞過)**

> **緣起**:TODOS.md L133「grep.column=true 時 git grep -z 是三個 NUL、顯示會錯位」(conf 8):`grep.column=true` 下 `git grep -z -n` 輸出 `path\0line\0column\0content`,現行 parseGrepZLine 只切前兩個 NUL、把 column 當 content 前綴,displayGrepHit 顯示錯位、hitContent 多保留 column。**對判定無安全影響**(CA/self-PR 抽 extractor 仍抽得到全部引用、方向多保留)、僅修 diagnostic accuracy。#70 P2#2 defer ⑦ squash 後 P2#2 集合 closed、Codex supervisor w6:p4 gpt-5.6-terra 拍板 Sprint 5 = D-① 單條 diagnostic parser correctness、標準車道 CSO_NOT_REQUIRED、review effort medium(plan / Phase 1 / adversarial)+ high(frozen full-range final);frozen full base `cf2feaac2e78b529ff5730c3dd5f51f9a775dc0d`(origin/main tip = #70 squash);shared local main 233858f + CLAUDE.md M(全程 lock)。plan review r1-r3(3 rounds、2 rev、r3 APPROVE):r1 P1 影響描述矛盾(TODO 明列無安全影響、plan 卻寫「可能誤放行」)、P1 HitFraming docstring 漏同步、P2 test 數量與既有重複 → r2 精確修影響、Scope 加 docstring、test 改增量;r2 3 nit(舊 5-6 case 殘文、Phase 1 條件寫法、fixture baseline 未設 config 受 user global 污染)→ r3 全修;r3 APPROVE + GO Step 3。
> **改動**:**Phase 1 atomic + Step 4 review fix + Step 5 adversarial fix、2 檔基礎 + 累積 +169/-4 folded**(Phase 1 final tip `7280ca264fee64d9bd353a56e7e3bc39b5194b94`):
> - Phase 1(`0234a69`、+121/-4、2 檔):`scripts/check-no-source-terms.ts`(parseGrepZLine L276 加 3-NUL 偵測:line + column 兩 field 皆非空純數字才視 3-NUL、剝除 column、對外仍回 `{path, line, content}`;不滿足維持 2-NUL 保守解析。同步 HitFraming "grep-z" docstring L344-354 兩種格式描述、不擴 union)/ `tests/check-no-source-terms.test.ts`(加 5 D-① case:3-NUL parser / displayGrepHit / hitContent / non-digit fallback / 真 Git fixture)
> - Step 4 review fix(`3890fcb`、+13/-0、test-only):Codex P2 wording finding(對稱 coverage、line 非數字 fallback、鎖 D1 line 半 guard)
> - Step 5 adversarial fix(`7280ca2`、+35/-0、test-only):Codex 分類 F1 / F3 / F5 FIX(F2 / F4 KEEP、不 defer)——F1a line 空字串 fallback + F1b column 空字串 fallback + F3 history scan 3-NUL(rev:path\0line\0column\0content)
>
> **禁區守住**:三個 gitGrep production caller 業務邏輯 / hitContent 邏輯(依 framing 選 parser、grep-z 兩種格式共用同 parser)/ HitFraming union / other parser / mutation specs / CI workflow / catalog register / SOP / shared main 233858f + CLAUDE.md M / 2 支 stash / 保留 worktrees / remote:全 0 line 動。
> **驗證(fresh worktree wt-d1-grep-column-nul、frozen tip 7280ca2、非 preflight)**:git diff cf2feaa..7280ca2 --stat 2 檔 +169/-4 folded;typecheck / lint 綠;`npx vitest run tests/check-no-source-terms.test.ts` **183 pass**(base 174 + 9 D-① 增量);`npm test` 全 suite **31 files / 1032 passed + 3 skipped**(base cf2feaa 1027 + 5 unit + 1 fixture);check:mutation-specs 12 spec / check:catalog CATALOG_OK 32 controls / check:doc-refs / check:adoption T8 全綠;`package-lock.json` 未進 diff。**反向探針**(base parser + new tests):5 target case(3-NUL parser / display / hitContent / real Git fixture)全轉紅、restore new parser 全綠 → mutation-sensitive。
> **審查**:Codex plan review r1-r3(3 rounds、2 revision、r3 APPROVE);Codex Step 4 對 `0234a69` NEEDS-REVISION 1 P2(對稱 line 非數字 coverage)→ 修為 `3890fcb` APPROVE。Step 4.5 CSO 標準車道人工 CSO_NOT_REQUIRED(diagnostic parser correctness、無 auth/authorization/payment/PII/audit or production logic 邊界)。Step 4.6 未觸發(無 UI diff)。Step 5 adversarial round 1 **0 CRITICAL / 5 INFORMATIONAL**(F1 conf 5、F2 conf 4、F3 conf 3、F4 conf 4、F5 conf 6);supervisor 分類:F1 FIX(對稱鎖兩半空 field guard)、F2 KEEP(runtime assert on gitGrep args 超本 sprint scope、當前不可達)、F3 FIX(對稱 history rev:path 3-NUL)、F4 KEEP(whole-file test fixture hardening 超本 sprint scope、非本 diff 引入)、F5 FIX(progress bookkeeping 用 9 個總數);round 2 rereview 0 actionable、F1 / F3 收斂、F2 / F4 未夾帶。
> **⭐ 教訓**:①**Field boundary + numeric guard 判定 3-NUL 比 content-shape 推論保守**——production `-I` 排除 binary 確保 grep content 不含 raw NUL、但 parser layer 仍靠 NUL field boundary + numeric line/column(非空純數字)判定、不猜內容,避免 R1 P1「framing 由產生端宣告、不從內容猜」教訓在 3-NUL 場景重演。②**「無已知判定影響」的診斷 accuracy fix 值得做**——現況 hitContent 多保留 column、判定仍正確(方向多保留),但 diagnostic 錯位讓讀者誤判 hit 位置;非安全繞過,developer experience 明顯改善;plan 影響描述必須精確反映 TODO 現況(r1 P1)、不擴大到「可能誤放行」。③**對稱 coverage 鎖 guard 兩半**——Step 4 P2 fix 加 line 非數字 case、Step 5 F1 又加 line / column 各自空字串 case,把 `/^\d+$/`(而非 `/^\d*$/`)的兩半保證都機器化鎖住;鎖 guard 契約時、對稱 case 是 mutation-lock 的最小組合。④**真 Git fixture 用 repo-local `git config --local grep.column false` 建 baseline** 避 user global grep.column=true 污染 flaky test(plan r2 → r3 修正);makeRepo 亦有 global commit.gpgsign fragility(F4 KEEP、whole-file hardening 未來另開)。⑤**單條 parser fix review round 密度合理**:plan r1-r3(3 rounds、2 rev)+ Step 4 x2(1 P2 rev)+ adversarial x2(5 INFO、supervisor 分類 3 FIX / 2 KEEP、round 2 0 actionable)= 8 rounds、對比 defer ⑤ 的 15 rounds、屬單條 diagnostic accuracy fix 的合理密度。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A. A3 Step 5 defer 集合 剩 19 條 INFO conf ≤7;B. A2 Step 5 defer 集合 17 條 INFO conf ≤6;C. A1.1 defer 集合 23 條 conf ≤7 doc governance;D. 單條:mutate.ts SIGTERM 不還原(conf 8、1h、P3);E. Milestone B1(新開)。
> **check:claims 逐條處置**:預計 25 hits(base cf2feaa)+ 少量本 sprint 引入敘述性 wording(如 hitContent 描述、diagnostic accuracy 措辭)——Phase 2 gate 執行後逐條分類、非安全繞過本身即 anti-overclaim 精神。
> 📊 成本:CC ~2h / 跨模型 review 8 rounds(plan review r1-r3 3 rounds + Codex Step 4 x2 對 0234a69/3890fcb + adversarial rounds x2 (round 1 + round 2 rereview) + supervisor 分類 x1) / Step 4 P2 wording actionable findings 1 個(非 CRITICAL、對稱 coverage、修為 3890fcb 收) / Step 5 獨立發現 5 個(round 1 5 INFO、supervisor 3 FIX / 2 KEEP、round 2 0 actionable)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、單條 parser diagnostic fix);Codex gpt-5.6-terra medium(plan / Phase 1 / adversarial)+ high(frozen full-range final、Step 6 起)(w6:p4)plan r1-r3 + Step 4 x2 + adversarial x2 + supervisor 分類 x1 + frozen full-range final(Step 6 前);baseline SHA `cf2feaac2e78b529ff5730c3dd5f51f9a775dc0d`;來源分佈:既有缺陷 1(grep.column=true 三-NUL 未支援、A1.1 Step 5 r3 I11 conf 8、defer 條目登錄時已存在)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan review r1-r3(3 rounds、2 rev、r3 APPROVE) + Codex plan review + D2 inventory / 2 ✅ Codex r3 APPROVE + GO Step 3 / 3 ✅ fresh worktree wt-d1-grep-column-nul + npm ci + Phase 1 atomic 2 檔 commit `0234a69` + Step 4 review fix `3890fcb` + Step 5 adversarial fix `7280ca2` / 4 ✅ Codex Step 4 x2 對 `0234a69`(P2 wording NEEDS-REVISION)+ `3890fcb`(APPROVE) / 4.5 ✅ CSO 標準車道人工 CSO_NOT_REQUIRED / 4.6 ✅ 未觸發(無 UI diff) / 5 ✅ adversarial round 1(5 INFO)+ supervisor 分類 3 FIX + 2 KEEP + round 2 rereview(0 actionable、F1 / F3 收斂、F2 / F4 未夾帶) / Phase 2 加 ③ + archive ② 至 progress-2026-09 + TODOS D-① ✅ + pull request 引用位待 Step 6 補號 + entry-count conservation:base archive 26 + current 1(②)= pre 27;新增 ③ 草稿後 archive 26 + current 2(②、③)= 28;final archive 27(搬入 ②)+ current 1(③)= post 28、每 entry 恰 1 次 / 6-7 待執行(Owner sprint-loop 授權)

> 更早的 entries:2026-09-06 ② P2#2 defer ⑦、2026-09-06 ① P2#2 defer ⑤、2026-09-05 ⑧ P2#2 defer ⑨、2026-09-05 ⑦ P2#2 defer ③、2026-09-05 ⑥ P3 delivery-refs 移除集合 ①+②、2026-09-05 ⑤ P2#3 defer ⑮、2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
