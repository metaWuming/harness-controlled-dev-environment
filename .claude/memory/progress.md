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

📅 2026-09-08 ⑯ — **Sprint 18 B2 milestone:AGENTS.md project-specific overlay override boundary(designated section + `<!-- 填 -->` fill-marker gate + visible precedence contract 3 條、A′ 收斂版一次關閉)**

> **緣起 & scope**:Sprint 17 B1 delivery 後、Owner 一句話 B2 objective:「讓下游專案可以 override AGENTS.md 的 overlay」。B2 不是 add runtime override capability(runtime free-form allowance 已足)、是提供 explicit upgrade-maintainable override boundary + documented precedence + adoption-state signaling。Supervisor A′ 收斂版 mirror CLAUDE.md Part 4 pattern。Scope:AGENTS.md restructure(visible precedence contract 3 條 + 兩 designated H2 section + `<!-- 填 -->` skeleton)+ parseAgentsOverlay helper + checkTemplateAgentsOverlaySkeleton(T10)+ 擴 codex ADAPTER_ASSERTIONS(A6.codex.overlay-fill / .parser)+ tests(≥ 22 case = 4 helper + 18 acceptance matrix)+ docs OVERVIEW / ADOPTION。Frozen base `0d0bda94762932b0274166768b2a607269748714`(Sprint 17 pull request 編號 83 squash tip)。
> **改動**:**Phase 1 = 6 檔 +277/-10 = commit A(4 檔 +267/-8) + commit B(2 檔 +10/-2)**;**commit C(bookkeeping)= progress ⑯ + TODOS Sprint 18 交付段**;**full range 0d0bda9..HEAD = 8 檔**。Commit A 4 檔:AGENTS.md(visible precedence + 兩 designated H2 + `<!-- 填 -->` skeleton)、scripts/check-adoption-readiness.ts(parseAgentsOverlay helper + T10 conditional on codex + 4 distinct message subtype + 3-step body algorithm + A6.codex.overlay-fill/.parser、TEMPLATE_CHECKS index 7 保 M12 pattern)、tests × 2(22 case 新增 + tIo/templateFiles fixture 加 AGENTS.md skeleton + 3→4 template exceptions + E-self T10 assertion)。Commit B 2 檔:OVERVIEW 表格擴 + 新加「Project-specific overlay override 邊界」段(action summary + link、不 verbatim 重述 3 條 precedence rules)、ADOPTION §2.5 加 checklist item(填 / 整段刪 / 清空、marker 必清)。runtime / A6.file/link semantics / KNOWN_ADAPTERS / loader / CLAUDE.md 全 zero-diff。
> **審查**:Codex plan review r1-r6(5 revisions、r6 APPROVE + GO Step 3);Step 4 commit-object review r1-r3 iterate(r1 P2 E2E-SHIPPED-T10-UNBOUND → E-self assertion loop 加 T10、r2 P2 bookkeeping stat mismatch → +2/-2 校正、r3 APPROVE Commit A tip `126c1e0`);Step 5 adversarial-reviewer 0 CRITICAL / 3 hypothetical KEEP-terminal(code fence out-of-scope 已文明列、`<!-- 填…` adopter annotation 為 documented contract、non-null assertions bounded safe);Frozen full-range review r1-r2 iterate(r1 P2 stat mismatch → per-commit stat 校正、r2 APPROVE);Step 4.5 CSO fresh classification = CSO_NOT_REQUIRED(governance config + doc + tests、非 auth/PII/payment/audit-trail);Step 4.6 不觸發(無 UI)。
> **驗證**:typecheck / lint / test 31 files / 1131 passed 3 skipped(baseline 1109 + Sprint 18 增量 22)/ check:adoption template mode 4 expected exceptions T3/T4/T5/T10 + info T7 / check:catalog 32 controls / check:doc-refs 767 refs 0 失效 / check:doc-size progress ~ 17 KB / LESSONS 24.2 KB / check:mutation-specs 全對應(M12 pattern 未破)/ check:bookkeeping HEAD allowlist 綠 / git diff --check clean。反向探針 11 條 mutation-sensitive(P1-P11、對應 18 case、adversarial 已 trace)。CI 狀態去 GitHub PR page 看。
> **⭐ 教訓**:①A′ 收斂版 mirror CLAUDE.md Part 4 pattern(designated section + fill-marker gate)= bounded incremental affordance、非 new runtime capability(runtime free-form allowance 已足);②Supervisor r1 P1 objective reframe:「downstream 已可自由 override(runtime)、B2 = adopter-affordance layer」= 避免宣稱 gap 不存在的東西、精確 gap 定義是 designated boundary + docs + signaling;③Supervisor r1 P1 precedence contract 3 條 pin(CLAUDE > 一切 / project-specific > template-shared / project-specific 不 override CLAUDE)+ 避免 canonical overlay wording(canonical 保留給 CLAUDE.md);④r3 P2 T10 single ID + 4 distinct messages 而非 4 IDs = finding 分類 taxonomy 精準;⑤r4 P2 3-step body algorithm pin(marker detect → cross-line comment strip → trim non-empty)= 多行 HTML comment 中 adopter 說明行不誤判 body-nonskeleton;⑥r5 P1 case 17 fixture 必 visible paragraph(非 `## `)= parser boundary contradiction 避免、⑥r6 P2 case 18 正式固定(non-marker HTML comment 由同一 normalization 覆蓋);⑦TEMPLATE_CHECKS 插入位置調整(T7 之後、T8 前 index 7)= 保 M12 mutation spec pattern 不破、mechanical consequence 而非 scope expansion。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):候選 C1(Owner staged roadmap A1.1→A2→A3→B1→B2→**C1**→C2→C3 下一 milestone、內容到時拍板);P3 D-② watchlist 若出現具名 Linux CI deterministic regression 則 reopen(承 Sprint 16 唯一 reopen condition)。無 self-review low-risk backlog、無新 defer、承 Sprint 15/16/17 closure rule。
> **check:claims 逐條處置**(base=`0d0bda94762932b0274166768b2a607269748714`、實測):322 added lines / 3 hits(progress-archive:695 + :697 archive-move 帶入的 Sprint ⑭ 舊 wording 兩處 + progress:85 Sprint ⑯ 下一棒候選 1 處、皆為同一「唯一 reopen condition = P3 D-② SIGTERM 的新 Linux CI deterministic failing regression」canonical 宣稱、承 Sprint 16 supervisor 拍板 bounded reopen condition 語意 = 單一 named canonical item、非泛稱 external event、SSOT 在 TODOS 「External evidence watchlist」段)、**全 KEEP**;D9 anti-overclaim 全程守。
> 📊 成本:CC ~3h / 跨模型 review = plan r1-r6(5 revisions)+ Step 4 r1-r3(2 fix)+ adversarial 1 round + full-range r1-r2(1 stat correction)/ P1 = 3(plan r1 objective + precedence + scope-contradiction)/ P2 累 = 8 / Step 5 獨立發現 3 hypothetical KEEP-terminal。
> 📐 量測(供 `docs/EFFORT.md` sweep):每輪 effort:plan medium-high、Phase 1 code high、Step 4/5 review high、frozen full-range high;baseline SHA `0d0bda94762932b0274166768b2a607269748714`;來源分佈:staged roadmap milestone(來源 Owner 一句話 objective、非既有缺陷、非漏改 consumer、非 baseline 後引入)。

📅 2026-09-08 ⑮ — **Sprint 17 B1 milestone:agent adapter architecture v1(CLAUDE.md canonical policy surface + AGENTS.md thin Codex adapter + requiredAgentAdapters 兩 adapter shipped default)、A′ 收斂版一次關閉**

> **緣起 & scope**:Sprint 16 repo-done 達成後、Owner continuous-auto 命令繼續 staged roadmap A1.1→A2→A3→**B1**→B2→C1→C2→C3 之 B1 milestone。Supervisor A′ 收斂版拒 B rename(36 檔引用重構超 bounded)+ 拒 C docs-only(不交付 thin adapter)。Scope:root AGENTS.md thin Codex adapter(獨立整行 `@CLAUDE.md` + capability-aware minimal overlay)+ shipped default `requiredAgentAdapters ["claude","codex"]` + 3 shipped-default mirror fixtures + NEW shipped-artifact regression test 3 assertion + docs/OVERVIEW.md B1 架構段 + docs/ADOPTION.md §0 兩 adapter 語意。Frozen base `294d60e518e14c3381e1d28fa6a4c2c75345b6fa`(PR #82 live merge tip)。
> **改動**:**Phase 1 = 7 檔 +73/-7 = commit A(5 檔) + commit B(2 檔)**;**commit C(bookkeeping)= 3 檔 +41/-28**;**full range 294d60e..HEAD = 10 檔 +114/-35**。commit A 5 檔:AGENTS.md new + harness.config.json + 3 fixture + tests/harness-config.test.ts NEW regression test 3 assertion(loadHarnessConfig 兩 adapter / `git ls-files --error-unmatch` 真 tracked probe / 剝 HTML comment 後恰一行 `@CLAUDE.md`)。commit B 2 檔:OVERVIEW agent adapter 架構段(事實可證的 Part 1-3 共用 + Claude-specific 呼叫方式並存表述、含 A6.codex.link 判定 wording);ADOPTION §0 requiredAgentAdapters 條目擴 codex-tracked 要求。commit C 3 檔:progress ⑮ + TODOS Sprint 17 交付段 + archive Sprint ⑬(doc-size 補救、承 Sprint 12/14 pattern)。runtime / A6 semantics / KNOWN_ADAPTERS / loader / CLAUDE.md 全 zero-diff。
> **審查**:Codex plan review r1-r4(3 revisions、r4 APPROVE + GO Step 3);Step 4 commit-object review r1-r2 iterate(r1 P1 AGENTS-CAPABILITY-MISSTATEMENT → capability-aware overlay 收縮、r2 APPROVE);Step 5 adversarial-reviewer 0 CRITICAL / 2 INFORMATIONAL WONTFIX-bounded(N1 test-vs-checker asymmetry safer direction、N2 ADOPTED_CFG:54 override cosmetic no-op);Frozen full-range review r3-r4 iterate(r3 P1 DOC-ARCH-FACTUAL-CONTRADICTION → OVERVIEW「agent-neutral / 不綁 runtime」絕對宣稱窄修為事實可證表述、r4 APPROVE 0 findings);Step 4.5 CSO fresh classification = CSO_NOT_REQUIRED(governance config + doc + test、非 auth/PII/payment/audit-trail 邊界);Step 4.6 不觸發(無 UI)。
> **驗證**:typecheck / lint / test 31 files 1109 passed 3 skipped / check:adoption template mode 3 expected exceptions T3/T4/T5 + info T7 / check:catalog 32 controls / check:doc-refs 767 refs 0 失效(full-range tip fresh 量) / check:doc-size progress 15.0 KB / 20 KB(75%)+ LESSONS 24.2 KB / 60 KB(40%) / check:mutation-specs 全對應 / check:bookkeeping HEAD allowlist 綠 / git diff --check clean。反向探針:AGENTS.md 未 stage 時 assertion 2 因 `git ls-files --error-unmatch` 真 tracked probe 轉紅(實測、restore 後綠、mutation-sensitive)。CI 狀態去 GitHub PR page 看。
> **⭐ 教訓**:①A′ 收斂版拒絕 rename + docs-only、只做 thin adapter reference impl = bounded scope 的分寸拿捏(比 A 少 36 檔重構、比 C 多實體交付);②Supervisor r1 P1 抓「絕對否定 Codex 能力」= AI 對 runtime capability landscape 的 over-assertion、capability-aware wording(先用等價、實際不可用時 fallback)是正確替代;③Supervisor r3 P1 抓「內容 agent-neutral / 不綁 runtime」與 CLAUDE.md 事實矛盾 = 「canonical」不等於「agent-neutral」、須具體描述哪些共用哪些是 Claude-specific;④test 較 checker 嚴格(N1 剝 HTML comment)是安全側、非阻擋;⑤override 因 shipped-default 改動變 no-op 是可預測 cosmetic 後果、承 Sprint 15/16 WONTFIX-bounded pattern(N2)不進 sprint scope。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):候選 B2(Owner staged roadmap 下一 milestone、內容到時拍板);P3 D-② watchlist 若出現具名 Linux CI deterministic regression 則 reopen(承 Sprint 16 唯一 reopen condition)。無 self-review low-risk backlog、無新 defer、承 Sprint 15/16 closure rule。
> **check:claims 逐條處置**(base=`294d60e518e14c3381e1d28fa6a4c2c75345b6fa`、實測):114 added lines / 2 hits(皆在 progress ⑮ entry 內、皆為同一「唯一 reopen condition = P3 D-② SIGTERM 的新 Linux CI deterministic failing regression」宣稱、承 Sprint 16 supervisor 拍板 bounded reopen condition 語意 = 單一 named canonical item、非泛稱 external event、SSOT 在 TODOS 「External evidence watchlist」段)、**全 KEEP**;D9 anti-overclaim 全程守。
> 📊 成本:CC ~2h / 跨模型 review = plan r1-r4 + Step 4 r1-r2 + adversarial 1 round + full-range r3-r4 / P1 = 3(commit A r1 capability + full-range r3 doc-arch)/ P2 = 0 / Step 5 獨立發現 2 INFORMATIONAL WONTFIX-bounded。
