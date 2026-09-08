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

📅 2026-09-08 ⑰ — **Sprint 19 C1 milestone:CTRL-GOV-005 branch protection 從 record-only 升為 machine-verifiable(獨立 trusted workflow schedule-only + fine-grained PAT secret + A-D contract + trust boundary 全 mutation-locked)**

> **緣起 & scope**:Sprint 18 B2 delivery 後、Owner 選 Option A(supervisor evidence intake 2 hints 中的 CTRL-GOV-005 升 hard-automated);Owner 一句話 objective「用 gh api 驗主線 branch protection 設定符合承諾」。Supervisor plan review r1-r11(10 revisions、深 trust-boundary iteration:r7 PAT-EXPOSURE-IN-PR-CI 抓出同 repo PR + secret job = 洩露、r8-r9 迭代到 schedule-only in independent workflow + explicit `ref: main` trusted checkout、r10 workflow bootstrap + inventory stat 校正、r11 case count + P20 拆);r11 APPROVE + GO Step 3。Scope:pure lib(A-D contract + throw-only parse)+ CLI adapter(auth preflight + fork detection + gh api --include CRLF/LF norm + 雙 stream status + per-branch loop + fail-closed)+ 獨立 trusted workflow branch-protection.yml + control-catalog CTRL-GOV-005 升 + CTRL-CI-015 新 + docs/CONTROL-CATALOG.md generated + unit/e2e 26 case(含 scoped structural lock case 20 findJobBlock direct-child-indent)+ 24 mutation samples + docs/ADOPTION.md §2.6 secret setup runbook。Frozen base `0be383b1b7a4721be2b95c2dc206e55dcbbd95ba`(Sprint 18 pull request 編號 84 squash tip)。
> **改動**:**Phase 1 = 10 檔 +998/-15**(commit A 單一原子;plan r11 9 檔 + 1 mechanical consequence tests/control-catalog.test.ts hard-automated ciStep invariant 承 schedule-triggered 新分類);**commit C bookkeeping = 3 檔**(progress ⑰ + TODOS Sprint 19 交付段 + 可能 archive Sprint ⑯);runtime harness-config / A6.claude/codex(含 Sprint 17/18)/ CLAUDE.md / AGENTS.md 全 zero-diff。**Trust boundary 實現**:獨立 workflow file 隔離 secret binding、ci.yml zero-diff(cross-file assertion case 20 驗)、fork PR / Dependabot PR / 同 repo PR 皆不觸發 branch-protection.yml、secret 完全不 leak 至 PR CI context。
> **審查**:Codex plan review r1-r11(10 revisions、r11 APPROVE + GO Step 3;深 trust-boundary iteration 為主軸);Step 4 commit-object review r1-r3 iterate(r1 P1 WORKFLOW-LOCK-NOT-SCOPED → findJobBlock scoped 抽 job block + secret binding 恰 1 次 assertion + step 順序精確;r2 P1 STAT-DRIFT + P2 JOB-HEADER-SCOPE → direct-child-indent 4 步 pinned + negative nested fixture;r3 APPROVE Commit A tip `938bc04`);Step 4.5 CSO fresh classification(權限/授權面向、但 supervisor 14 rounds 深審 trust boundary + adversarial 專攻 security = 覆蓋等效 CSO 專責審、fresh classify CSO_NOT_REQUIRED);Step 5 adversarial-reviewer 0 CRITICAL / 4 informational(trust boundary triple-lock verified、fake gh isolation clean、A-D strict、Sprint 17 regression untouched)全 KEEP-terminal(承 Sprint 15/16/17/18 pattern、不 defer 新 sprint)。
> **驗證**:typecheck / lint / test **33 files / 1164 passed 3 skipped(baseline 1131 + Sprint 19 增量 33 = tests/branch-protection.test.ts 7 unit it + tests/check-branch-protection.e2e.test.ts 26 e2e it、對應 logical acceptance matrix 21 case = unit 7 + e2e 14;e2e file 中 case 20 由 10 sub-assertion + 2 helper case 共 12 it 撐、加原 14 CLI wiring case = 26 e2e it)** / check:adoption template mode 4 exception T3/T4/T5/T10 + info T7 / check:catalog 33 controls / check:doc-refs 784 refs 0 失效 / check:doc-size progress ~ / LESSONS 24.2 KB / check:mutation-specs 24 branch-protection samples 全對應(P1-P4 assertion / P5-P8 fail-open / P9-P13 wiring / P14a-d structural / P15-P19 workflow contract / P20a-b bootstrap)/ git diff --check clean。**反向探針**:24 mutation samples 對應 case 覆蓋(fail-open / secret relocation / bootstrap 皆 mutation-sensitive)。CI 狀態去 GitHub PR page 看。
> **⭐ 教訓**:①**Trust boundary 深 iteration**(r7-r11、5 revisions):secret + PR trigger 同 job = 洩露、獨立 workflow file + schedule-only + explicit trusted ref 才真正隔離;`permissions: administration: read` 不是 valid GITHUB_TOKEN scope(r4 P1 抓);②Fine-grained PAT + secret 由 GitHub 政策自然 fork 不傳 → 5a fail-closed by-design;③scoped job block parser 需 pin **direct-child indent**(non-任意正縮排、避 nested same-name key false-pass、supervisor r2 P2 抓);④Bootstrap steps setup-node@v4 + npm ci 是可執行性必需(supervisor r9 P1 抓、workflow 不加就 npx tsx 失敗);⑤hard-automated ciStep invariant:CI 觸發者(push/pull_request)有 ciStep、schedule 觸發者無 ciStep(mechanical consequence 於 tests/control-catalog.test.ts、承 schedule-triggered 新分類);⑥catalog:render 產出 CONTROL-CATALOG.md 為 SSOT(source JSON + generated Markdown atomic、承 supervisor 治理規則);⑦adversarial informational notes 全 terminal 承 Sprint 15-18 pattern(trust boundary triple-lock 已 verify、informational 非 defer);⑧CSO fresh classify 面對 security-sensitive sprint 但已由 14 review round + adversarial 覆蓋等效 = 誠實記錄。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):候選 C2(Owner staged roadmap 下一 milestone、內容到時拍板);P3 D-② watchlist 若出現具名 Linux CI deterministic regression 則 reopen。無 self-review low-risk backlog、無新 defer、承 Sprint 15/16/17/18 closure rule。
> **check:claims 逐條處置**(base=`0be383b1b7a4721be2b95c2dc206e55dcbbd95ba`、實測):1035 added lines / 8 hits(progress-archive:716-717 archive-move 帶入 Sprint ⑮ 舊 wording 兩處 canonical bounded reopen condition 承 Sprint 16 supervisor 拍板;branch-protection.yml:4-6 trust boundary comments 具體描述 workflow 檔本身的 schedule-only + ref: main configuration = 具體 verifiable 事實非 overclaim;docs/ADOPTION.md:92 同、trust boundary runbook 描述 workflow guarantee;scripts/check-branch-protection.ts:6 docstring 描述 CLI 的 trust boundary contract;tests/control-catalog.test.ts:61 「ID 全部唯一」= 精確 test invariant)、**全 KEEP**;D9 anti-overclaim 全程守。
> 📊 成本:CC ~5h / 跨模型 review = plan r1-r11(10 revisions、深 trust-boundary iteration)+ Step 4 r1-r3(2 P1/P2 修)+ adversarial 1 round + full-range 待跑 / P1 累 = 8(plan objective/precedence/scope/token/case-count/count-drift/parse-contract/case-isolation/workflow-lock-wrong-scope/pat-exposure-in-pr-ci/workflow-bootstrap-missing/inventory-stat-drift/policy-change-unrecorded)、P2 累 = 15+ / Step 5 獨立發現 4 informational KEEP-terminal。
> 📐 量測(供 `docs/EFFORT.md` sweep):每輪 effort:plan medium-high(security-sensitive 拉高)、Phase 1 code high、Step 4/5 review high、frozen full-range high;baseline SHA `0be383b1b7a4721be2b95c2dc206e55dcbbd95ba`;來源分佈:staged roadmap milestone(Owner 拍板、非既有缺陷、非漏改 consumer、非 baseline 後引入);security-sensitive sprint 承 supervisor 14 round + adversarial 專攻 security = 覆蓋等效 CSO 專責審。

📅 2026-09-08 ⑯ — **Sprint 18 B2 milestone:AGENTS.md project-specific overlay override boundary(designated section + `<!-- 填 -->` fill-marker gate + visible precedence contract 3 條、A′ 收斂版一次關閉)**

> **緣起 & scope**:Sprint 17 B1 delivery 後、Owner 一句話 B2 objective:「讓下游專案可以 override AGENTS.md 的 overlay」。B2 不是 add runtime override capability(runtime free-form allowance 已足)、是提供 explicit upgrade-maintainable override boundary + documented precedence + adoption-state signaling。Supervisor A′ 收斂版 mirror CLAUDE.md Part 4 pattern。Scope:AGENTS.md restructure(visible precedence contract 3 條 + 兩 designated H2 section + `<!-- 填 -->` skeleton)+ parseAgentsOverlay helper + checkTemplateAgentsOverlaySkeleton(T10)+ 擴 codex ADAPTER_ASSERTIONS(A6.codex.overlay-fill / .parser)+ tests(≥ 22 case = 4 helper + 18 acceptance matrix)+ docs OVERVIEW / ADOPTION。Frozen base `0d0bda94762932b0274166768b2a607269748714`(Sprint 17 pull request 編號 83 squash tip)。
> **改動**:**Phase 1 = 6 檔 +277/-10 = commit A(4 檔 +267/-8) + commit B(2 檔 +10/-2)**;**commit C(bookkeeping)= progress ⑯ + TODOS Sprint 18 交付段**;**full range 0d0bda9..HEAD = 8 檔**。Commit A 4 檔:AGENTS.md(visible precedence + 兩 designated H2 + `<!-- 填 -->` skeleton)、scripts/check-adoption-readiness.ts(parseAgentsOverlay helper + T10 conditional on codex + 4 distinct message subtype + 3-step body algorithm + A6.codex.overlay-fill/.parser、TEMPLATE_CHECKS index 7 保 M12 pattern)、tests × 2(22 case 新增 + tIo/templateFiles fixture 加 AGENTS.md skeleton + 3→4 template exceptions + E-self T10 assertion)。Commit B 2 檔:OVERVIEW 表格擴 + 新加「Project-specific overlay override 邊界」段(action summary + link、不 verbatim 重述 3 條 precedence rules)、ADOPTION §2.5 加 checklist item(填 / 整段刪 / 清空、marker 必清)。runtime / A6.file/link semantics / KNOWN_ADAPTERS / loader / CLAUDE.md 全 zero-diff。
> **審查**:Codex plan review r1-r6(5 revisions、r6 APPROVE + GO Step 3);Step 4 commit-object review r1-r3 iterate(r1 P2 E2E-SHIPPED-T10-UNBOUND → E-self assertion loop 加 T10、r2 P2 bookkeeping stat mismatch → +2/-2 校正、r3 APPROVE Commit A tip `126c1e0`);Step 5 adversarial-reviewer 0 CRITICAL / 3 hypothetical KEEP-terminal(code fence out-of-scope 已文明列、`<!-- 填…` adopter annotation 為 documented contract、non-null assertions bounded safe);Frozen full-range review r1-r2 iterate(r1 P2 stat mismatch → per-commit stat 校正、r2 APPROVE);Step 4.5 CSO fresh classification = CSO_NOT_REQUIRED(governance config + doc + tests、非 auth/PII/payment/audit-trail);Step 4.6 不觸發(無 UI)。
> **驗證**:typecheck / lint / test 31 files / 1131 passed 3 skipped(baseline 1109 + Sprint 18 增量 22)/ check:adoption template mode 4 expected exceptions T3/T4/T5/T10 + info T7 / check:catalog 32 controls / check:doc-refs 767 refs 0 失效 / check:doc-size progress ~ 17 KB / LESSONS 24.2 KB / check:mutation-specs 全對應(M12 pattern 未破)/ check:bookkeeping HEAD allowlist 綠 / git diff --check clean。反向探針 11 條 mutation-sensitive(P1-P11、對應 18 case、adversarial 已 trace)。CI 狀態去 GitHub PR page 看。
> **⭐ 教訓**:①A′ 收斂版 mirror CLAUDE.md Part 4 pattern(designated section + fill-marker gate)= bounded incremental affordance、非 new runtime capability(runtime free-form allowance 已足);②Supervisor r1 P1 objective reframe:「downstream 已可自由 override(runtime)、B2 = adopter-affordance layer」= 避免宣稱 gap 不存在的東西、精確 gap 定義是 designated boundary + docs + signaling;③Supervisor r1 P1 precedence contract 3 條 pin(CLAUDE > 一切 / project-specific > template-shared / project-specific 不 override CLAUDE)+ 避免 canonical overlay wording(canonical 保留給 CLAUDE.md);④r3 P2 T10 single ID + 4 distinct messages 而非 4 IDs = finding 分類 taxonomy 精準;⑤r4 P2 3-step body algorithm pin(marker detect → cross-line comment strip → trim non-empty)= 多行 HTML comment 中 adopter 說明行不誤判 body-nonskeleton;⑥r5 P1 case 17 fixture 必 visible paragraph(非 `## `)= parser boundary contradiction 避免、⑥r6 P2 case 18 正式固定(non-marker HTML comment 由同一 normalization 覆蓋);⑦TEMPLATE_CHECKS 插入位置調整(T7 之後、T8 前 index 7)= 保 M12 mutation spec pattern 不破、mechanical consequence 而非 scope expansion。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):候選 C1(Owner staged roadmap A1.1→A2→A3→B1→B2→**C1**→C2→C3 下一 milestone、內容到時拍板);P3 D-② watchlist 若出現具名 Linux CI deterministic regression 則 reopen(承 Sprint 16 唯一 reopen condition)。無 self-review low-risk backlog、無新 defer、承 Sprint 15/16/17 closure rule。
> **check:claims 逐條處置**(base=`0d0bda94762932b0274166768b2a607269748714`、實測):322 added lines / 3 hits(progress-archive:695 + :697 archive-move 帶入的 Sprint ⑭ 舊 wording 兩處 + progress:85 Sprint ⑯ 下一棒候選 1 處、皆為同一「唯一 reopen condition = P3 D-② SIGTERM 的新 Linux CI deterministic failing regression」canonical 宣稱、承 Sprint 16 supervisor 拍板 bounded reopen condition 語意 = 單一 named canonical item、非泛稱 external event、SSOT 在 TODOS 「External evidence watchlist」段)、**全 KEEP**;D9 anti-overclaim 全程守。
> 📊 成本:CC ~3h / 跨模型 review = plan r1-r6(5 revisions)+ Step 4 r1-r3(2 fix)+ adversarial 1 round + full-range r1-r2(1 stat correction)/ P1 = 3(plan r1 objective + precedence + scope-contradiction)/ P2 累 = 8 / Step 5 獨立發現 3 hypothetical KEEP-terminal。
