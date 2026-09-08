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

📅 2026-09-08 ⑮ — **Sprint 17 B1 milestone:agent adapter architecture v1(CLAUDE.md canonical policy surface + AGENTS.md thin Codex adapter + requiredAgentAdapters 兩 adapter shipped default)、A′ 收斂版一次關閉**

> **緣起 & scope**:Sprint 16 repo-done 達成後、Owner continuous-auto 命令繼續 staged roadmap A1.1→A2→A3→**B1**→B2→C1→C2→C3 之 B1 milestone。Supervisor A′ 收斂版拒 B rename(36 檔引用重構超 bounded)+ 拒 C docs-only(不交付 thin adapter)。Scope:root AGENTS.md thin Codex adapter(獨立整行 `@CLAUDE.md` + capability-aware minimal overlay)+ shipped default `requiredAgentAdapters ["claude","codex"]` + 3 shipped-default mirror fixtures + NEW shipped-artifact regression test 3 assertion + docs/OVERVIEW.md B1 架構段 + docs/ADOPTION.md §0 兩 adapter 語意。Frozen base `294d60e518e14c3381e1d28fa6a4c2c75345b6fa`(PR #82 live merge tip)。
> **改動**:**Phase 1 = 7 檔 +73/-7 = commit A(5 檔) + commit B(2 檔)**;**commit C(bookkeeping)= 3 檔 +41/-28**;**full range 294d60e..HEAD = 10 檔 +114/-35**。commit A 5 檔:AGENTS.md new + harness.config.json + 3 fixture + tests/harness-config.test.ts NEW regression test 3 assertion(loadHarnessConfig 兩 adapter / `git ls-files --error-unmatch` 真 tracked probe / 剝 HTML comment 後恰一行 `@CLAUDE.md`)。commit B 2 檔:OVERVIEW agent adapter 架構段(事實可證的 Part 1-3 共用 + Claude-specific 呼叫方式並存表述、含 A6.codex.link 判定 wording);ADOPTION §0 requiredAgentAdapters 條目擴 codex-tracked 要求。commit C 3 檔:progress ⑮ + TODOS Sprint 17 交付段 + archive Sprint ⑬(doc-size 補救、承 Sprint 12/14 pattern)。runtime / A6 semantics / KNOWN_ADAPTERS / loader / CLAUDE.md 全 zero-diff。
> **審查**:Codex plan review r1-r4(3 revisions、r4 APPROVE + GO Step 3);Step 4 commit-object review r1-r2 iterate(r1 P1 AGENTS-CAPABILITY-MISSTATEMENT → capability-aware overlay 收縮、r2 APPROVE);Step 5 adversarial-reviewer 0 CRITICAL / 2 INFORMATIONAL WONTFIX-bounded(N1 test-vs-checker asymmetry safer direction、N2 ADOPTED_CFG:54 override cosmetic no-op);Frozen full-range review r3-r4 iterate(r3 P1 DOC-ARCH-FACTUAL-CONTRADICTION → OVERVIEW「agent-neutral / 不綁 runtime」絕對宣稱窄修為事實可證表述、r4 APPROVE 0 findings);Step 4.5 CSO fresh classification = CSO_NOT_REQUIRED(governance config + doc + test、非 auth/PII/payment/audit-trail 邊界);Step 4.6 不觸發(無 UI)。
> **驗證**:typecheck / lint / test 31 files 1109 passed 3 skipped / check:adoption template mode 3 expected exceptions T3/T4/T5 + info T7 / check:catalog 32 controls / check:doc-refs 767 refs 0 失效(full-range tip fresh 量) / check:doc-size progress 15.0 KB / 20 KB(75%)+ LESSONS 24.2 KB / 60 KB(40%) / check:mutation-specs 全對應 / check:bookkeeping HEAD allowlist 綠 / git diff --check clean。反向探針:AGENTS.md 未 stage 時 assertion 2 因 `git ls-files --error-unmatch` 真 tracked probe 轉紅(實測、restore 後綠、mutation-sensitive)。CI 狀態去 GitHub PR page 看。
> **⭐ 教訓**:①A′ 收斂版拒絕 rename + docs-only、只做 thin adapter reference impl = bounded scope 的分寸拿捏(比 A 少 36 檔重構、比 C 多實體交付);②Supervisor r1 P1 抓「絕對否定 Codex 能力」= AI 對 runtime capability landscape 的 over-assertion、capability-aware wording(先用等價、實際不可用時 fallback)是正確替代;③Supervisor r3 P1 抓「內容 agent-neutral / 不綁 runtime」與 CLAUDE.md 事實矛盾 = 「canonical」不等於「agent-neutral」、須具體描述哪些共用哪些是 Claude-specific;④test 較 checker 嚴格(N1 剝 HTML comment)是安全側、非阻擋;⑤override 因 shipped-default 改動變 no-op 是可預測 cosmetic 後果、承 Sprint 15/16 WONTFIX-bounded pattern(N2)不進 sprint scope。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):候選 B2(Owner staged roadmap 下一 milestone、內容到時拍板);P3 D-② watchlist 若出現具名 Linux CI deterministic regression 則 reopen(承 Sprint 16 唯一 reopen condition)。無 self-review low-risk backlog、無新 defer、承 Sprint 15/16 closure rule。
> **check:claims 逐條處置**(base=`294d60e518e14c3381e1d28fa6a4c2c75345b6fa`、實測):114 added lines / 2 hits(皆在 progress ⑮ entry 內、皆為同一「唯一 reopen condition = P3 D-② SIGTERM 的新 Linux CI deterministic failing regression」宣稱、承 Sprint 16 supervisor 拍板 bounded reopen condition 語意 = 單一 named canonical item、非泛稱 external event、SSOT 在 TODOS 「External evidence watchlist」段)、**全 KEEP**;D9 anti-overclaim 全程守。
> 📊 成本:CC ~2h / 跨模型 review = plan r1-r4 + Step 4 r1-r2 + adversarial 1 round + full-range r3-r4 / P1 = 3(commit A r1 capability + full-range r3 doc-arch)/ P2 = 0 / Step 5 獨立發現 2 INFORMATIONAL WONTFIX-bounded。
> 📐 量測(供 `docs/EFFORT.md` sweep):每輪 effort:plan medium-high、Phase 1 code high、Step 4/5 review high、frozen final review high;baseline SHA `294d60e518e14c3381e1d28fa6a4c2c75345b6fa`;來源分佈:staged roadmap milestone(來源 Owner 拍板、非既有缺陷、非漏改 consumer、非 baseline 後引入)。

📅 2026-09-08 ⑭ — **Repo remaining-backlog convergence audit + repo-done for current evidence / active backlog exhausted(ACTIONABLE=0、bookkeeping-only)**

> **緣起 & scope**:Sprint 15 A2 collection 17/17 closed;Owner 2026-09-08 拍板 Sprint 16 = repo remaining-backlog convergence audit / repo-done decision(不做單條或單一 collection 修補 sprint)。硬收斂規則(supervisor):只 current frozen tree deterministic reproduce + behavior false-green/false-red / active operational contradiction / security-trust regression / required CI blocker 才 ACTIONABLE。frozen base `734719153c7eda63f4fc39f83bc33a3198595b46`(PR #81 live merge tip)。
>
> **改動**:3 檔 bookkeeping-only(worktree wt-sprint16-repo-convergence、Sprint ⑫ 已 archive):`TODOS.md` 4 處(delivery-refs 集合加交付 PR #66 段 + A1.1 集合 header/內容 strikethrough + 交付段 + P3 D-② SIGTERM item 加 strikethrough + terminal marker + `## ✅ Repo-done for current evidence / active backlog exhausted(Sprint 16)` 章節含 External evidence watchlist 子段);`progress.md` 加 Sprint 16 ⑭ entry。Object acquisition:Sprint 14 r8 anchor + Sprint 15 local bundle pattern(local bundle from `/tmp/harness-s16-audit` + validate_and_promote);primary_status=0、fallback 未觸發、before/after origin OID = 2307a44 unchanged、shared main 233858f + CLAUDE.md M / stash / 19 個既有 worktrees 全保留、另有本 sprint worktree(cleanup 後回 19)/ remote 全 0 line 動。
>
> **審查**:plan review r1-r6(5 revisions、r6 APPROVE + GO Step 3);Explore audit(a4d628e2、151814 subagent tokens、409243 ms);Codex Step 4 commit-object bookkeeping-only 依流程執行;Step 4.5 CSO_NOT_REQUIRED(Owner 明列);Step 4.6 無 UI;Step 5 adversarial 不派(0 code、Owner 明列除非 audit facts 有爭議);bookkeeping frozen full-range review 依流程執行。
>
> **驗證**:worktree wt-sprint16-repo-convergence 內 check:doc-size / check:doc-refs / check:bookkeeping HEAD / check:claims --base=7347191 / git diff --check 全綠。
>
> **⭐ 教訓 + 決策 & repo-done**:①**Repo-done for current evidence / active backlog exhausted**:6 collections + 1 standalone P3 D-② record 全 terminal;raw ledger records 88 / unique canonical items 87(S5↔P3 dedupe 後、兩口徑均 terminal);ACTIONABLE=0;②**Sprint 16 引入 External evidence watchlist(非 active backlog)子段**:canonical P3 D-② SIGTERM 移出 active TODO 語意、只在 watchlist 引用 canonical 與唯一 reopen condition;避免 pending vs terminal 矛盾;③**A1.1 defer 集合 23/23 terminal breakdown**:4 CLOSED-AS-DELIVERED(S1-S4)+ 1 CLOSED-AS-DEDUPLICATED(S5 → canonical P3 D-②、沿用 Sprint 14 A3 ⑱ 模式)+ 5 WONTFIX(G-1 到 G-5)+ 13 INSUFFICIENT-EVIDENCE(non-enumerated、evidence 散失、與 A2 ⑰ 同形);④**只 P3 D-② watch item 明列唯一具名 reopen 條件 = P3 D-② SIGTERM 的新 Linux CI deterministic failing regression**;其他 INSUFFICIENT-EVIDENCE terminal items 不帶本 ledger 預留的 reopen 條件、未來新缺陷走一般 evidence intake、不泛稱 external event、不宣稱永不再開;⑤**Closure rule 承接 Sprint 13/14/15**:no new Sprint 17 backlog from self-review low-risk;INSUFFICIENT-EVIDENCE-KEEP-FROZEN 分類成 terminal standard(Sprint 15 引入、Sprint 16 沿用擴出 External evidence watchlist 語意);⑥**Delivery-refs 移除 sprint defer 集合**(2 條)Sprint 16 bookkeeping variance 補:DR-①+DR-② 全 CLOSED-AS-DELIVERED via commit `393ef53`(pull request 編號 66、MIGRATION 附錄 A.1 換交付線 runbook 7 步 + docs wording 修)、對齊 progress-archive:457 SSOT。
>
> **⏭️ 下一棒候選**(hint 非 truth):**無主動 sprint**;唯一具名觸發 = P3 D-② SIGTERM 的新 Linux CI deterministic failing regression 才 reopen Phase 1;不泛稱 external event。shared main 233858f + CLAUDE.md M 全程 lock、1 支 stash 保留、無 remote 動作。
>
> **check:claims 逐條處置**(base=`7347191`、實測):72 added / 6 hits;分布 progress 2(:88 教訓 & repo-done 段 + :90 下一棒候選)+ TODOS 4(:161 watchlist reopen condition + :167 watchlist Sprint 17 具名觸發 + :175 P3 D-② marker + :177 P3 current disposition 補);皆 supervisor 明列拍板之具名 reopen 條件(P3 D-② SIGTERM 的新 Linux CI deterministic failing regression、單一具名 canonical、SSOT 有指涉)= **全 KEEP**;D9 anti-overclaim 全程守。
>
> 📊 成本:CC ~3h(Phase 0 Explore audit + plan r1-r6 iterated + Step 3 atomic quarantine + Phase 2 bookkeeping)/ 跨模型 plan review 6 rounds;bookkeeping frozen full-range review 依流程執行(escape hatch、不回寫尚未完成 verdict)/ Step 5 獨立發現 0(no code、no adversarial)。
>
> 📐 量測:主 session Opus 4.7 全程、Codex supervisor via Herdr pane w6:p4;baseline SHA `734719153c7eda63f4fc39f83bc33a3198595b46`;來源分佈(既有 backlog 全 terminal 分類):6 CLOSED-AS-DELIVERED(A1.1 spun-out S1-S4 + delivery-refs DR-① DR-②)、1 CLOSED-AS-DEDUPLICATED(A1.1 S5)、5 WONTFIX(A1.1 G-1..G-5)、2 INSUFFICIENT-EVIDENCE disposition groups(A1.1 non-enumerated 13 + canonical P3 D-② 1)。
