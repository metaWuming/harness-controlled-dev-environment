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

📅 2026-09-07 ⑩ — **A3 CTRL-CI-012 catalog wording drift(Sprint 11 defer 收乾、限授權 STOP #3/#6 解除、evidence-first)**

> **緣起**:Sprint 11 progress ⑨ entry 明列 defer(A3 defer ③⑨ 收乾但 catalog wording drift 觸 STOP 3/6);Owner 2026-09-07 拍板 Sprint 12 有限授權收(`scripts/control-catalog.json` 內 CTRL-CI-012 `locator` + `evidence` 兩 field wording + 用既有 renderer 重生 `docs/CONTROL-CATALOG.md`)。frozen full base `2307a447363ce49ac3a23f28cc5ce1b37d491781`(origin/main = pull request 編號 77 squash merge);shared local main 233858f + CLAUDE.md M(全程 lock)、1 支 stash 保留、agent-* 18 支 worktrees 保留、remote 0 動。plan review r1-r2(r2 APPROVE):r1 NEEDS-REVISION 3 findings(Phase 2 bookkeeping 四段時序缺、數字 line pins 需 symbol anchor、D9(c) 精確化);r2 全部處置。
>
> **改動**:2 檔(worktree wt-sprint12-catalog-drift、Sprint 12 frozen tip `78ee155fd66f8da646b7dd36a47cfd6c3379b481`、full-range +5/-5):
> - `scripts/control-catalog.json` CTRL-CI-012.locator 尾段「者為 promotion PR、明文 SKIPPED」→「則明文 SKIPPED」(加「head 」前綴、去 promotion PR taxonomy)
> - `scripts/control-catalog.json` CTRL-CI-012.evidence 中段「SKIPPED(promotion PR,政策讀自 merge-base)」→「SKIPPED(head ∈ merge-base 那側 protectedBranches、政策讀自 merge-base)」
> - `docs/CONTROL-CATALOG.md` regenerate via `npm run catalog:render`(不手改、renderer 決定性硬驗)
> - 對稱 Sprint 11 D8v2(catalog documentation 對稱 runtime SKIPPED msg 同一原則)
>
> **審查**:Codex plan r1-r2 APPROVE(supervisor via Herdr Codex pane w6:p4);Codex Step 4 commit-object review APPROVE(independent clean clone、direct parent、只 2 檔、renderer hash A === B === `bdc27814...`、5 STOP boundary、finding source:漏改 consumer);Step 4.5 CSO_NOT_REQUIRED(Owner 明列、governance documentation、非安全繞過);Step 4.6 無 UI 檔;Step 5 adversarial-reviewer round 1(fresh subagent、tip 78ee155):**0 CRITICAL / 7 INFORMATIONAL**;**STOP #2 WAS triggered by discovery of active out-of-scope consumers、resolved by explicit defer to Sprint 13**;supervisor classification:**DEFER Sprint 13** = F1 conf 7 `docs/ADOPTION.md` current guidance、F2 conf 6 `docs/MIGRATION.md` acceptance-evidence label、F6 conf 5 `.github/workflows/ci.yml` comment-only scope(comment-only 需另 sprint 授權、workflow logic remains locked);**KEEP** = F3 conf 6 `docs/MIGRATION.md` GitFlow upgrade sequence(accurate specific promotion scenario、not drift)、F4 conf 4 catalog「那側」vs runtime SKIPPED「的」(semantically equivalent、Owner intentional)、F5 conf 4 `CHANGELOG.md` Unreleased 段(exact head condition dominates parenthetical historical label、optionally include in Sprint 13 bounded inventory)、F7 conf 3 tests/e2e case (19) title「(promotion PR)」(characterizes promotion-shaped fixture);round 2 rereview 不跑(Owner 明列 GO Phase 2)。
>
> **驗證**:worktree wt-sprint12-catalog-drift 內 typecheck / lint / vitest 全 suite 31 files 1074 passed + 3 skipped;**renderer 決定性硬驗**(不靠 source 目視):第 1 次 `npm run catalog:render` → sha256 A = `bdc27814e05f672d3ce83cd8e340bfb21818a511ac44abb1a1fa0287309ac385`、第 2 次 render → hash B、確認 A === B(zero diff、相對第一次 render 無新增變化);`npm run check:catalog` CATALOG_OK 32 controls;`npm run check:doc-refs` 724 refs 0 失效;runtime / CI workflow / catalog schema / 其他 31 CTRL entries / A3 其他 defer / shared main + CLAUDE.md M / stash / agent-* worktrees / remote 全 zero-diff、禁區守住。
>
> **⭐ 教訓**:①**catalog SSOT drift 收乾方法**:json 改 → renderer regenerate → renderer 決定性硬驗(render 兩次記 hash、confirm A === B、不靠 source 目視);Sprint 12 首次採用 hash 硬驗、可推廣到所有 renderer-generated 產物 sprint;②**canonical PR-number placeholder token**:literal `PR` + 井號 + 三下劃線 = `PR #___`;Sprint 11「pull request 編號 ___」非 canonical 靜默過 CI、Sprint 12 收 canonical convention(check:todos-markers 認 canonical);③**downstream SSOT drift 分類**(supervisor 明列):**DEFER** = current guidance / acceptance evidence label / comment-only 需另 sprint 授權;**KEEP** = specific accurate scenario / semantically equivalent / characterization-purposeful fixture — 判準看「wording 是否 current operational guidance 或 acceptance evidence」;④**Herdr Codex supervisor 互動**:用 `herdr agent prompt w6:p4` 送 review request、supervisor mid-turn 給 verdict;避免 codex CLI 的 scope flag 與 prompt 互斥(Sprint 11 教訓 ①);⑤**STOP #2 WAS triggered 事實記錄**:adversarial 發現 out-of-scope consumers 屬 STOP #2 觸發、由 explicit defer to Sprint 13 resolved;不寫「STOP #2 untriggered」— supervisor 明列 correct the record。
>
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):
>   - **Sprint 13 DEFER 集合**(本 sprint 明列):F1 `docs/ADOPTION.md` current guidance + F2 `docs/MIGRATION.md` acceptance-evidence label + F6 `.github/workflows/ci.yml` comment-only(workflow logic locked、需 Owner 明列 comment-only 另授權)+ optional bounded inventory F5 CHANGELOG.md(not required fix)
>   - **Sprint 13+ B**:A3 defer 集合剩餘項 mini-batch(④/⑤/⑯–㉑ 8 條 conf ≤ 7)
>   - **Sprint 13+ C**:A2 defer 集合 / P2 / P3 defer 剩餘
>   - 卡外部:無;shared main 233858f + CLAUDE.md M 全程 lock、1 支 stash 保留、無 remote 動作
>
> **KEEP 明列**(不修、Sprint 13+ 也 not required):F3 MIGRATION L80(accurate specific promotion scenario)、F4 catalog vs runtime wording(semantically equivalent、Owner intentional)、F7 test case (19) title(characterizes promotion-shaped fixture)。
>
> **check:claims 逐條處置**(base=`2307a44`、Phase 2 時序 4 跑):本 sprint diff 全為 wording 校正、無新增絕對化宣稱;D9 anti-overclaim(a-e)全程守。
>
> 📊 成本:CC ~3h(Phase 0 + plan r1-r2 + Phase 1 + Step 4 review + Step 5 adversarial + Phase 2 bookkeeping)/ 跨模型 review 4 rounds(Codex plan r1-r2 + Codex Step 4 + adversarial 1)/ P1 0 個 / P2 0 個 / Step 5 獨立發現 7 個(F1-F7、STOP #2 WAS triggered + resolved by explicit defer)。
>
> 📐 量測:主 session Opus 4.7 全程、Codex supervisor via Herdr pane w6:p4;baseline SHA `2307a447363ce49ac3a23f28cc5ce1b37d491781`;來源分佈(既有缺陷 3・漏改 consumer 4・baseline 後引入 0):既有 = F4/F5/F7(catalog vs runtime wording / CHANGELOG / case (19) title);漏改 consumer = F1/F2/F3/F6(ADOPTION/MIGRATION/ci.yml、Sprint 11 defer 遺漏 downstream)。

---

📅 2026-09-07 ⑨ — **A3 defer ③⑨ evidence / diagnostic mini-batch(③ WONTFIX + ⑨ FIX、standard governance diagnostic、catalog wording drift 明列 defer)**

> **緣起**:TODOS.md A3 Step 5 defer 集合 2 條(③/⑨、0 CRITICAL 未修);Codex Sprint 11 拍板 mini-batch。Phase 0 evidence audit(Explore agent + CodeGraph)核實 ③ `repoFilePathViolation` 下游全 exact-match(`tracked.has(p)` on `git ls-files -z` Set + `startsWith('tests/')` + `endsWith('.json')`)、無 shell/regex/argv 插值 → WONTFIX + 2 characterization test;⑨ SKIPPED wording promotion-only、對 backflow 誤導但 logic 對 → FIX 純 wording + docstring + header comment 兩例 + 1 deterministic backflow e2e。frozen full base `1549ed8beb2abbdaf70240ccf4e0dd09c9f100e9`(origin/main = pull request 編號 76 squash);shared local main 233858f + CLAUDE.md M(全程 lock)、1 支 stash 保留、agent-* 18 支 worktrees 保留、remote 全 0 動。plan review r1-r3(r3 APPROVE):逐輪校正 characterization comment 範圍(不擴 dollar/semicolon)、⑨ 訊息不固化 promotion/backflow 為 runtime taxonomy、e2e fixture deterministic 檢查(head=main ∈ merge-base protectedBranches)。**前 session context 用盡於 Codex Step 4 round 1 派工後、本 session 從 P1 收乾 round 2 接手**。
>
> **改動**:3 檔(worktree `wt-a3-defer-3-9-diagnostic`、Step 5 tip `49d500be30757afcdb9e728f15a2d05ec602df68`、full-range +55/-21):`scripts/check-baseline-governance.ts` +8/-9(SKIPPED msg 只描述 head 條件 D8v2、docstring 對稱簡化、header comment 兩例(`promotion develop → main`、`backflow main → develop`)、infoLines 2 處「不套用『head ∈ protectedBranches』豁免」、A3 defer ⑭ 註解引用對稱更新);`tests/check-baseline-governance.e2e.test.ts` +38/-13(加 case (29) backflow deterministic e2e:`--base=develop --head=main`、head=main ∈ merge-base protectedBranches、鎖新 wording + 舊 promotion-only wording 不重現;4 assertion + 對應 error msg + comments 對稱新 wording);`tests/control-catalog.test.ts` +8/-0(加 ③ characterization test 2 case、僅 pipe + backtick、**不擴** `$`/`;`)。**③ WONTFIX decision record**:runtime + `scripts/lib/control-catalog.ts` docblock 皆不動、僅 tests 加 case + progress + TODOS bookkeeping 留 decision record。**⑨ 拍板 D8v2 [Owner 可否決] 訊息模板**:「head ∈ merge-base 的 protectedBranches;其內容已逐 PR 受本 gate 檢查」(只描述 head 條件、不宣稱 base 也是 protected、對稱 D9(b) 精確度)。**明列 defer**(下一 sprint 候選、觸 STOP 3/6):catalog wording drift(`scripts/control-catalog.json` line 359/363 + `docs/CONTROL-CATALOG.md` line 49 CTRL-CI-012 locator / evidence field 內 promotion PR 分類名)。
>
> **審查**:Codex plan r1-r3 APPROVE(前 session);Codex Step 4 chronology 4 rounds(r1:P1-1 comment 固化跨模組 inventory 過度概括(違 D9(c))+ P1-2 negative lookahead bug(舊訊息後方本有 `(fork...)`、negative lookahead 讓舊字面也不 match 假空轉)→ r2 收乾 characterization comment 收窄純觀察事實 + `not.toContain('保護分支之間的 promotion PR,')` 精確 substring 帶尾逗號;r2:P1 散文級 conf 9 promotion wording 4 處殘留(runtime infoLines + docstring + 既有 fixture + catalog)→ r3 收乾 3 檔內全改「不套用『保護分支之間 PR』豁免」+ catalog defer 明列;r3:P1 散文級 conf 9「保護分支之間的 PR」誤宣稱 base 也是 protected(實 code 只 check head ∈ protectedBranches@merge-base、base 是什麼都無所謂、觸 D9(b))→ r4 收乾 SKIPPED msg 刪冗餘「:保護分支之間的 PR(...)」+ docstring 簡化「→ SKIPPED」+ 只描述 head 條件 + 拍板 D8v2;r4:APPROVE)。Step 4.5 CSO_NOT_REQUIRED(標準車道人工 CSO、governance diagnostic wording、非安全繞過、模板 repo 路徑表空為設計);Step 4.6 無 UI 檔跳過;Step 5 adversarial-reviewer round 1(fresh subagent、tip `45cd974`):0 CRITICAL / 6 INFORMATIONAL(F1 conf 8 case 編號 (23) collision Sprint 11 新加 vs 既有 A3 ⑬、F2 conf 4 describe「16 條」與實際 case 數 drift(既有)、F3 conf 3 negative regression guard 覆蓋窄(設計取捨)、F4 conf 3 SKIPPED msg「已逐 PR 受本 gate 檢查」遞歸豁免宣稱(觸 D9(d) STOP 2、既有 semantic gap、留給後續 sprint)、F5 conf 2 case 23 fixture 依賴未列(非 real defect)、F6 conf 3 序列跳號(與 F1 同 root cause));supervisor 分類:F1 FIX(改 23→29 line 278 title、與 line 381 既有 A3 ⑬ 區隔、僅字串改動)、F2-F6 KEEP per SOP `INFORMATIONAL` confidence < 5 skip;Step 5 F1 fix commit `49d500b`;round 2 rereview 不跑(依 SOP 壓輪數紀律⑴「行為級已 0、只剩散文 → 套用完就出貨、不再送審」)。
>
> **驗證**:worktree `wt-a3-defer-3-9-diagnostic` 內 typecheck / lint / vitest 全 suite 31 files 1074 passed + 3 skipped;catalog(`scripts/control-catalog.json` + `docs/CONTROL-CATALOG.md`)/ library(`scripts/lib/control-catalog.ts`)/ workflow(`.github/workflows/**`)/ SOP(`.claude/sop/**`)全 zero-diff、runtime 邏輯零改動(僅 wording)。禁區守住(shared main 233858f + CLAUDE.md M 全程 lock、1 支 stash 保留、agent-* worktrees 保留、remote 全 0 line 動、exemption logic / trust source / status code / exit code / merge-base 讀取全不動)。
>
> **⭐ 教訓**:①**`codex review` scope flag 與 prompt 互斥**——`codex review --base <ref>` 排除 `[PROMPT]`;要塞 scope note 走 `codex exec` heredoc 或 `codex review [PROMPT]` 無 --base mode(prompt 內含 base + tip 讓 codex agentic 拿 diff);SOP `.claude/sop/codex-review-scope-note-template.md` 明列;②**Codex「該做更多」型 finding**(擴 scope 到 catalog)——D2 明列「純 wording + docstring」scope 內、但 catalog SSOT drift 屬 STOP 3(generated catalog artifact)+ STOP 6(超 3 檔);需在 Codex prompt scope note 明確授權 defer boundary、避免每輪重提(round 2 提後 round 3/4 提示 Owner 授權 defer、Codex 就 respect);Owner 選 A(3 檔內全改 + catalog defer)確保 sprint 不 blow scope;③**wording precision 修法可以是散文級**——挑戰 Owner 拍板 D8 template wording 屬 D8 [Owner 可否決] scope、AI 可拍板 D8v2 標可否決進 progress entry、不必每個 wording 微調 escalate;SOP 散文級規則「照抄替換句 + 機械核對、不再送審」允許收尾出貨;④**adversarial-reviewer 獨立於 Codex 的 diversity**——case 編號 (23) collision(F1 conf 8)只有 adversarial 抓到(Codex 4 rounds 全未提)、cross-model + intra-model 雙審有實益、不是 duplicative ceremony;⑤**「保護分支之間的 PR」wording 誤宣稱 base**——code 觸發只 check `head ∈ protectedBranches@merge-base`,base 是什麼都無所謂;wording 直描述 head 條件(D8v2)避 D9(b) anti-overclaim。
>
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):
>   - **A**:A3 defer 集合剩餘項(⑯–㉑ conf ≤ 7、逐條 0.5h 或 mini-batch);或本 sprint 明列 defer 的 catalog wording drift(`scripts/control-catalog.json` line 359/363 + `docs/CONTROL-CATALOG.md` line 49 CTRL-CI-012 locator / evidence field 內 promotion PR 分類名)、下一 sprint 需另開授權觸 STOP 3/6
>   - **B**:P2 defer 剩餘或其他 backlog
>   - 卡外部:無;shared main 233858f + CLAUDE.md M(全程 lock)、1 支 stash 保留、無 remote 動作
>
> **check:claims 逐條處置**:本 sprint diff 全為 wording change、無新增絕對化宣稱;D9 anti-overclaim(a-d)全程守(不宣稱擴 shape validation 有安全收益、⑨ 只宣稱「消 promotion-only 誤導」、③ 不宣稱「library 沒 shell consumer」為跨模組事實、不改 CI 契約 / trust source / exit code / promotion exemption)。預估命中 0-1(待跑 check:claims 驗)。
>
> 📊 成本:CC ~4h(接手 + Codex Step 4 r2-r4 + Step 5 adversarial + Phase 2)/ 跨模型 review 5 rounds(Step 4 4 rounds + Step 5 adversarial 1 round)/ P1 4 個(r1 有 2 + r2/r3 各 1)/ P2 0 個 / Step 5 獨立發現 1 個(F1 case 編號 collision conf 8)。
>
> 📐 量測:主 session Opus 4.7 全程、Codex supervisor gpt-5.6-sol effort low(reasoning summaries: none);baseline SHA `1549ed8beb2abbdaf70240ccf4e0dd09c9f100e9`;來源分佈(既有缺陷 2・漏改 consumer 1・baseline 後引入 3):既有缺陷 = r3 P1「保護分支之間」D8 template wording 從 sprint 前既有 + F4 conf 3(SKIPPED 遞歸豁免宣稱、既有 D9(d) 邊界);漏改 consumer = r2 P1 promotion wording SSOT drift(docstring / infoLines / e2e fixture 沒隨 SKIPPED msg 同步);baseline 後引入 = r1 P1-1 comment 太寬(前 session 加的跨模組宣稱)+ r1 P1-2 negative lookahead bug + Step 5 F1(case 編號 collision、前 session 加 case 未查號)。

---


> 更早的 entries:2026-09-07 ⑧ A3 defer ⑦⑧⑫、2026-09-06 ⑦ A3 defer ②、2026-09-06 ⑥ D-② SIGTERM Phase 0、2026-09-06 ⑤ A3 defer ①、2026-09-06 ④ A3 defer ⑬⑭⑮、2026-09-06 ③ D-①、2026-09-06 ② P2#2 defer ⑦、2026-09-06 ① P2#2 defer ⑤、2026-09-05 ⑧ P2#2 defer ⑨、2026-09-05 ⑦ P2#2 defer ③、2026-09-05 ⑥ P3 delivery-refs 移除集合 ①+②、2026-09-05 ⑤ P2#3 defer ⑮、2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
