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

📅 2026-09-08 ⑬ — **A2 defer 集合 17/17 terminal closure(gate correctness、3 code fixes + 1 docstring + INSUFFICIENT-EVIDENCE-KEEP-FROZEN 新分類、承接 Sprint 13/14 closure rule)**

> **緣起 & scope**:Sprint 14 A3 collection closed;Owner 2026-09-08 拍板 Sprint 15 = A2 Step 5 defer 集合 17 條 extinction audit + collection convergence。subsystem = adoption-readiness READY correctness / input validity layer。Phase 0 audit 發現 ACTIONABLE = 3、跨 shape/grammar subsystem、STOP-AND-REPORT supervisor → 拍板選 B 收斂版:①②④ atomic bounded batch + ⑦ docstring + ⑰ INSUFFICIENT-EVIDENCE 新分類。frozen base `4877792998f46d179547b1436b1e53b9af2f2d7c`(PR #80 live merge tip);local origin/main 保持 stale 2307a44。
>
> **改動**:4 檔(worktree wt-sprint15-a2-extinction):`scripts/check-adoption-readiness.ts +118/-2`(① step envelope structural sibling-indent + direct-key guard + confirmed canonical detector + tail anchor;④ `isRepoRelativeConcretePath` lexical normalized helper;⑦ 檔頭 --root trusted contract docstring);`scripts/lib/harness-config.ts +5/-1`(② `literalBranchNameViolation` 補 3 rules:endsWith('.') + per-component startsWith('.') + per-component endsWith('.lock'));`tests/check-adoption-readiness.e2e.test.ts +179/-0`(① 17 case = 原 13 + Step 5 F1 加 4;④ 9 case = 8 neg 含 backslash + 1 pos);`tests/harness-config.test.ts +45/-0`(② 8 case = 4 pos + 3 neg + git check-ref-format regression);Sprint 15 增量 = 17 + 9 + 8 = 34、npm test baseline 1074 → 1108。**Phase 1 code+test range**(`4877792..e4090f4`)= 4 檔 +347/-3;**current full range** = 7 檔 +396/-29(runtime 2 + tests 2 + bookkeeping 3)。**Object acquisition**:Sprint 14 r8 approved atomic quarantine(local bundle from `/tmp/harness-s15-audit` + validate_and_promote);primary_status=0、無 fallback、before/after origin OID = 2307a44 unchanged。
>
> **審查**:plan review r1-r5(4 次 revision、r5 APPROVE + GO Step 3);**Codex Step 4 commit-object 3 verdict**:65a3b0d initial review NEEDS(1 P1 + 3 P2)→ c249b5c rereview NEEDS(1 P1 + 1 P2)→ 0cfcbff rereview r2 APPROVE;Step 4.5 CSO 機器 fail-closed(模板 repo 例外、路徑表為空 = 設計)+ 人工 CSO_NOT_REQUIRED(governance correctness、無 auth/PII/payment/audit 邊界);Step 4.6 無 UI;**Step 5 adversarial 2 round**:round 1(0 CRITICAL / 9 INFORMATIONAL、supervisor 分類 FIX F1/F2/F5 + KEEP F3/F4/F6-F9)→ round 2 rereview APPROVE + GO Phase 2。
>
> **驗證**:worktree wt-sprint15-a2-extinction 內 typecheck / lint 綠 / npm test 31 files 1108 pass + 3 skipped(baseline 1074 + Sprint 15 增量 34)/ check:adoption template + T3/T4/T5 exception / check:catalog 32 controls / check:mutation-specs 12 spec / check:doc-refs 751 refs / 0 失效 / git diff --check clean。**反向探針**(手動 evidence):F1(revert tail anchor → 2 legit expression tests 轉紅、restore 綠)+ F5(revert backslash guard → backslash test 轉紅、restore 綠)+ P1(revert direct-key guard → scalar false-green 轉紅、restore 綠)全 mutation-sensitive。
>
> **⭐ 教訓 + 決策 & closure rule**:①**A2 collection 17/17 terminal、closed**:6 CLOSED-AS-DELIVERED(⑪-⑯ PR #44 declarative mergeStrategy)+ 3 CLOSED-AS-DELIVERED(①②④ Sprint 15)+ 7 WONTFIX-with-bounded-rationale(③⑤⑥⑦⑧⑨⑩)+ 1 INSUFFICIENT-EVIDENCE-KEEP-FROZEN(⑰ r1 defer 原文散失);②新 terminal category **INSUFFICIENT-EVIDENCE-KEEP-FROZEN**(evidence 散失或 audit 無法 recover、非 delivered/WONTFIX/deduplicated、不重建原文、不宣稱已修、不另開 sprint);③**Structural sibling-indent + direct-key guard**(shape checker 不誤傷 comment/nested env/with/block scalar;candidate 驗 runKeyIndent === itemIndent + 2 是 scalar content false-green closure 關鍵);④**Regex tail anchor `\s*(?:#.*)?$`**(canonical detector 只鎖完整 scalar 而非 prefix、避免 legit conditional 誤判 disabled;新加 4 pos/neg controls 全 mutation-sensitive);⑤**Git check-ref-format 對照 regression** 是 pure validator 邊界驗證正解(validator + git 對 3 neg + 4 pos 一致);⑥**Closure rule 承接 Sprint 13/14**:no new Sprint 16 A2 backlog;reviewer 新 low-risk finding 一律 KEEP/FROZEN(F3/F4/F6-F9);supervisor 拍板 FIX 只針對 deterministic false-green + STOP 邊界(F1)、consistency drift(F2)、mutation coverage(F5)。
>
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A2/A3 collection 均已 closed;Sprint 16+:A1.1 defer 集合 23 條(2026-09-01 PR A1.1 Step 5 doc governance)/ P2 / P3 defer 剩餘 backlog(P3 D-② SIGTERM race canonical remains pending);shared main 233858f + CLAUDE.md M 全程 lock、1 支 stash 保留、無 remote 動作。
>
> **check:claims 逐條處置**(base=`4877792`、實測):396 added lines / 0 hits、無需處置;D9 anti-overclaim 全程守、code 修法 wording 未新增絕對化宣稱。
>
> 📊 成本:CC ~6h(Phase 0 Explore + /tmp re-audit + plan r1-r5 iterated + Step 3 atomic quarantine + Phase 1 3 behavior fixes(①②④)+ 1 docstring(⑦)+ Step 4 commit-object 3 verdicts + Step 4.5 CSO 評估 + Step 5 adversarial 2 round + supervisor classification + Phase 2 bookkeeping)/ 跨模型 implementation review 10 rounds(plan 5 + Step 4 commit-object 3 + Step 5 adversarial 2)/ Step 5 獨立發現 9(supervisor 分類 3 FIX + 6 KEEP)。
>
> 📐 量測:主 session Opus 4.7 全程、Codex supervisor via Herdr pane w6:p4;baseline SHA `4877792998f46d179547b1436b1e53b9af2f2d7c`;來源分佈(既有 3 ACTIONABLE + 6 delivered pre-Sprint 15 + 7 KEEP + 1 INSUFFICIENT-EVIDENCE = 17):既有 ACTIONABLE = ①(shape checker false-green)+ ②(grammar vs git 契約)+ ④(shape check 空洞 semantic);既有 delivered = ⑪-⑯ PR #44;既有 KEEP = ③⑤⑥⑦⑧⑨⑩;INSUFFICIENT-EVIDENCE = ⑰(r1 defer 文字散失、原始 review artifact 未進 tracked)。

---


📅 2026-09-07 ⑫ — **A3 remaining-8 extinction audit + collection closure(bookkeeping-only、21/21 terminal)**

> **緣起 & scope**:Sprint 13 wording chain closure 完工;Owner 2026-09-07 拍板 Sprint 14 = A3 remaining-8 extinction audit、目標關閉 A3 collection(21/21 全 terminal disposition)。8 條 target ④/⑤/⑯/⑰/⑱/⑲/⑳/㉑;frozen base `a671ab170f32789dbedecca65137fec1d8733fda`(GitHub live main、Sprint 13 pull request 編號 79 squash);local origin/main 保持 stale 2307a44(Owner 明列)。Phase 1 code = none(bookkeeping-only)。
>
> **改動**:3 檔 bookkeeping-only(worktree wt-sprint14-a3-extinction):`progress.md` 加 Sprint 14 ⑫ entry;`TODOS.md` 8 條 strikethrough + disposition markers + A3 集合 header 更新 21/21 closed + Sprint 14 交付段;`progress-archive/progress-2026-09.md` archive Sprint ⑩ block(doc-size 補救、Sprint 12 pattern;含 archive-move relative link fix)。**Object acquisition**:atomic quarantine(pre-fetch guard + candidate refs/temp/sprint14-candidate + `validate_and_promote` 函式 + inline auto fallback via /tmp audit clone bundle + shell control-flow guards);primary_status=0、無 fallback 觸發、origin/main 保持 stale(無 fetch 副作用)。
>
> **審查**:Explore r1 audit 讀 233858f stale tree(supervisor 明列 stale evidence provenance 撤)→ `/tmp/harness-s14-audit` clean clone re-audit at a671ab;Codex plan r1-r8 iterated:7 次 revision、r8 APPROVE(evidence provenance + cardinality 21 vs 20 + ⑱ CLOSED-AS-DEDUPLICATED new category + object acquisition atomic quarantine 多輪 shell control-flow tightening);Step 4.5 CSO_NOT_REQUIRED;Step 4.6 無 UI;Step 5 adversarial 不派(0 code、closure rule 承接 Sprint 13、supervisor 明列)。
>
> **驗證**:worktree wt-sprint14-a3-extinction 內 check:doc-size / check:bookkeeping HEAD / check:doc-refs / check:claims --base=a671ab 全綠;Object acquisition assertions 全 PASS(before/after origin OID = 2307a44 unchanged、candidate = a671ab frozen、worktree HEAD = a671ab、每 mutation `||` guard 通過);runtime / catalog / schema / workflow 全 zero-diff、禁區守住。
>
> **⭐ 教訓 + 決策 & closure rule**:①**A3 collection extinction 21/21 terminal**(11 delivered + 2 WONTFIX ⑥⑪ + Sprint 14 4 CLOSED-AS-DELIVERED ⑤⑯⑳㉑ + 1 CLOSED-AS-DEDUPLICATED ⑱ + 3 WONTFIX ④⑰⑲)、collection closed;②新 terminal category **CLOSED-AS-DEDUPLICATED**(⑱ = A3 duplicate/cross-reference marker、canonical D-② SIGTERM race remains pending in P3、no repair/delivery claim、避免 backlog re-creation);③**Object acquisition atomic quarantine**(supervisor r1-r8 iterate 7 次 revision):pre-fetch guard + candidate slot + validate_and_promote reusable function + inline auto fallback + failure-path ordering(origin/main drift first)+ mutation `||` guards + fallback status refresh + shell control-flow guard;④**Evidence provenance 必用 /tmp clean clone at frozen**(不依賴 shared repo tree、避免 CodeGraph stale bias、supervisor 明列 r1 → r2 P1);⑤**Closure rule 承接 Sprint 13**:no new Sprint 15 from low-risk wording findings。
>
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A3 已 closed;Sprint 15+:A2 defer 集合(17 條 conf ≤ 6、部分已在 A3 catalog 交付)/ P2 / P3 defer 剩餘 backlog(P3 D-② SIGTERM race canonical remains pending);卡外部:無;shared main 233858f + CLAUDE.md M 全程 lock、1 支 stash 保留、無 remote 動作。
>
> **check:claims 逐條處置**(base=`a671ab`、Phase 2 時序 4 實測):本 sprint diff 全 bookkeeping;D9 anti-overclaim 全程守;實測 60 added lines / 0 hits。
>
> 📊 成本:CC ~3h(Phase 0 Explore + /tmp re-audit + plan r1-r8 iterated + Step 3 atomic quarantine + Phase 2 bookkeeping)/ 跨模型 review plan r1-r8 = 7 次 revision + r8 APPROVE / Step 5 獨立發現 0(no code、no adversarial round)。
>
> 📐 量測:主 session Opus 4.7 全程、Codex supervisor via Herdr pane w6:p4;baseline SHA `a671ab170f32789dbedecca65137fec1d8733fda`;來源分佈(既有/KEEP 8・漏改 consumer 0・baseline 後引入 0):既有 = A3 remaining-8 全 documentation/schema-cosmetic/delivered-status/cross-reference marker、all terminal by evidence-verified disposition。
