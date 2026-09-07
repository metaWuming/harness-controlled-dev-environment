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

📅 2026-09-07 ⑫ — **A3 remaining-8 extinction audit + collection closure(bookkeeping-only、21/21 terminal)**

> **緣起 & scope**:Sprint 13 wording chain closure 完工;Owner 2026-09-07 拍板 Sprint 14 = A3 remaining-8 extinction audit、目標關閉 A3 collection(21/21 全 terminal disposition)。8 條 target ④/⑤/⑯/⑰/⑱/⑲/⑳/㉑;frozen base `a671ab170f32789dbedecca65137fec1d8733fda`(GitHub live main、Sprint 13 pull request 編號 79 squash);local origin/main 保持 stale 2307a44(Owner 明列)。Phase 1 code = none(bookkeeping-only)。
>
> **改動**:2 檔 bookkeeping-only(worktree wt-sprint14-a3-extinction);TODOS.md 8 條 disposition markers + A3 集合 header 更新 21/21 closed + Sprint 14 交付段;progress.md 加 Sprint 14 ⑫ entry。**Object acquisition**:atomic quarantine(pre-fetch guard + candidate refs/temp/sprint14-candidate + `validate_and_promote` 函式 + inline auto fallback via /tmp audit clone bundle + shell control-flow guards);primary_status=0、無 fallback 觸發、origin/main 保持 stale(無 fetch 副作用)。
>
> **審查**:Explore r1 audit 讀 233858f stale tree(supervisor 明列 stale evidence provenance 撤)→ `/tmp/harness-s14-audit` clean clone re-audit at a671ab;Codex plan r1-r8 iterated APPROVE(P1 7 個全處置:evidence provenance + cardinality 21 vs 20 + ⑱ CLOSED-AS-DEDUPLICATED new category + object acquisition atomic quarantine 5-iteration shell control-flow tightening);Step 4.5 CSO_NOT_REQUIRED;Step 4.6 無 UI;Step 5 adversarial 不派(0 code、closure rule 承接 Sprint 13、supervisor 明列)。
>
> **驗證**:worktree wt-sprint14-a3-extinction 內 check:doc-size / check:bookkeeping HEAD / check:doc-refs / check:claims --base=a671ab 全綠;Object acquisition assertions 全 PASS(before/after origin OID = 2307a44 unchanged、candidate = a671ab frozen、worktree HEAD = a671ab、每 mutation `||` guard 通過);runtime / catalog / schema / workflow 全 zero-diff、禁區守住。
>
> **⭐ 教訓 + 決策 & closure rule**:①**A3 collection extinction 21/21 terminal**(11 delivered + 2 WONTFIX ⑥⑪ + Sprint 14 4 CLOSED-AS-DELIVERED ⑤⑯⑳㉑ + 1 CLOSED-AS-DEDUPLICATED ⑱ + 3 WONTFIX ④⑰⑲)、collection closed;②新 terminal category **CLOSED-AS-DEDUPLICATED**(⑱ = A3 duplicate/cross-reference marker、canonical D-② SIGTERM race remains pending in P3、no repair/delivery claim、避免 backlog re-creation);③**Object acquisition atomic quarantine 5-iteration**(supervisor r1-r8):pre-fetch guard + candidate slot + validate_and_promote reusable function + inline auto fallback + failure-path ordering(origin/main drift first)+ mutation `||` guards + fallback status refresh + shell control-flow guard;④**Evidence provenance 必用 /tmp clean clone at frozen**(不依賴 shared repo tree、避免 CodeGraph stale bias、supervisor 明列 r1 → r2 P1);⑤**Closure rule 承接 Sprint 13**:no new Sprint 15 from low-risk wording findings。
>
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A3 已 closed;Sprint 15+:A2 defer 集合(17 條 conf ≤ 6、部分已在 A3 catalog 交付)/ P2 / P3 defer 剩餘 backlog(P3 D-② SIGTERM race canonical remains pending);卡外部:無;shared main 233858f + CLAUDE.md M 全程 lock、1 支 stash 保留、無 remote 動作。
>
> **check:claims 逐條處置**(base=`a671ab`、Phase 2 時序 4 跑):本 sprint diff 全 bookkeeping;D9 anti-overclaim 全程守;預估 0-1 hit(archive-move blob if archive 需要)。
>
> 📊 成本:CC ~3h(Phase 0 Explore + /tmp re-audit + plan r1-r8 iterated + Step 3 atomic quarantine + Phase 2 bookkeeping)/ 跨模型 review 8 rounds(plan r1-r8)/ P1 7 個 / P2 0 / Step 5 獨立發現 0(no code、no adversarial round)。
>
> 📐 量測:主 session Opus 4.7 全程、Codex supervisor via Herdr pane w6:p4;baseline SHA `a671ab170f32789dbedecca65137fec1d8733fda`;來源分佈(既有/KEEP 8・漏改 consumer 0・baseline 後引入 0):既有 = A3 remaining-8 全 documentation/schema-cosmetic/delivered-status/cross-reference marker、all terminal by evidence-verified disposition。

---

📅 2026-09-07 ⑪ — **A3 CTRL-CI-012 wording chain closure(Sprint 12 defer 收乾、freeze wording chain、closure sprint)**

> **緣起 & scope**:Sprint 12 明列 DEFER F1/F2/F6 集合(downstream SSOT drift、STOP #2 explicit defer)收乾 + freeze CTRL-CI-012 wording chain(closure rule:no new Sprint 14 from low-risk wording findings、only reproducible behavior defect / active operational contradiction / MAJOR blocker)。3 檔 Phase 1 atomic:`docs/ADOPTION.md` Baseline Governance checklist paragraph + `docs/MIGRATION.md` GitFlow upgrade acceptance-evidence label(括號簡短版)+ `.github/workflows/ci.yml` Baseline Governance step comment(2 段 common pattern)+ Protected Branches Drift step comment(1 詞刪)、兩份 docs wording + ci.yml comment-only、workflow logic / if / env / run / steps / triggers / permissions / job topology zero change(awk machine-verified、set -o pipefail、portable BSD/macOS)。
>
> **改動**:3 檔 +5/-6(worktree wt-sprint13-wording-closure、frozen tip `bdd22b50ce15cb4fd7681a318f94ff3f5c3d2e5b`、frozen base `8c6d213152ee43f1bb59752f21d3a8616ff46d73`)。D1 common pattern:「同 repo PR 的 `--head` 所帶分支名,若存在於 merge-base 那側 `harness.config.json` 的 `protectedBranches`,腳本明文 SKIPPED」——明列 CLI input + policy trust source、不 expose internal field name(headRef)、不宣稱 base protected;MIGRATION.md GitFlow upgrade acceptance-evidence label 使用括號簡短版;ci.yml Baseline Governance step 兩段 comment 用 common pattern。
>
> **審查**:Codex plan r1-r3(supervisor via Herdr Codex pane w6:p4)APPROVE;Codex Step 4 commit-object review r1 NEEDS-REVISION 1 P1(散文級 conf 9、ci.yml 多「的」1 字)→ delta r2 APPROVE;Step 4.5 CSO_NOT_REQUIRED(Owner 明列、governance docs / comment-only 車道、非安全繞過);Step 4.6 無 UI 檔;Step 5 adversarial-reviewer round 1(fresh subagent、tip bdd22b5):0 CRITICAL / 4 INFORMATIONAL、無 STOP、無 fix、無 round 2;**F1-F4 supervisor classification = KEEP / FROZEN by closure rule**(F1 conf 6 catalog/runtime 各自語意正確、exact prose alignment 非契約;F2 conf 5 fork PR 子句 pre-existing 措辭差、語意等價;F3 conf 4 MIGRATION.md GitFlow upgrade acceptance-evidence label 括號簡短版足夠上下文;F4 conf 3 語氣差不影響語意)。
>
> **驗證**:worktree wt-sprint13-wording-closure 內 typecheck / lint 綠 / npm run test 全 suite 31 files 1074 pass + 3 skipped 綠 / check:doc-refs 742 refs 0 失效 / check:catalog CATALOG_OK 32 controls(sanity、本 sprint 不改 catalog)/ **workflow comment-only awk machine-verified proof**(set -o pipefail 涵蓋 git diff 失敗、ignore diff headers、only whitespace-prefix # or blank lines、ci.yml non-comment content byte-identical 3904 == 3904 bytes、adversarial re-verified)。catalog / runtime / schema / 其他 CTRL entries / A3 其他 defer / KEEP contexts(MIGRATION.md GitFlow upgrade-specific promotion scenario(F3) + CHANGELOG.md Baseline Governance Added exact-condition historical entry F5 + test case (19) F7 promotion-shaped characterization fixture)/ shared main 233858f + CLAUDE.md M / stash / agent-* worktrees / remote 全 zero-diff、禁區守住。
>
> **⭐ 教訓 + 決策 & closure rule**:①**Sprint 13 = closure sprint**、freeze CTRL-CI-012 wording chain;②**common pattern D1**(明列 CLI input + policy trust source、不 expose internal field name、不宣稱 base protected)適用 ADOPTION checklist + ci.yml Baseline Governance step comment 逐字一致、MIGRATION.md GitFlow upgrade acceptance-evidence label 使用括號簡短版;③**Workflow comment-only machine-verified proof**(awk + set -o pipefail + ignore diff headers + only whitespace-prefix # or blank lines)portable BSD/macOS、可推廣所有 workflow comment-only sprint;④**F1-F4 KEEP / FROZEN by closure rule**、不寫 DEFER 避免重新製造 backlog、破壞收斂;⑤**Fetch side effect Step 3 前**:frozen base 8c6d213 不在 local obj、`git fetch origin main:refs/temp/<ref>` 副作用 update refs/remotes/origin/main、已 `git update-ref` 精確 revert 回 stale 2307a44、worktree HEAD + refs/temp 保持 8c6d213、supervisor A APPROVE;retro:未來這種「暫時更新後精確 update-ref 復原」需列為顯式授權流程、否則 STOP。
>
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實、**closure rule 明列不列 F1-F4 為 Sprint 14 candidate**):
>   - Sprint 14+ A:A3 defer 集合剩餘項 mini-batch(④/⑤/⑯–㉑ 8 條 conf ≤ 7)
>   - Sprint 14+ B:A2 defer 集合 / P2 / P3 defer 剩餘或其他 backlog
>   - 卡外部:無;shared main 233858f + CLAUDE.md M 全程 lock、1 支 stash 保留、無 remote 動作
>
> **check:claims 逐條處置**(base=`8c6d213`、Phase 2 時序 4 跑):本 sprint diff 全為 wording 校正、無新增絕對化宣稱;D9 anti-overclaim(a-e)全程守;實測 33 added lines / 0 hits(check:claims --base=8c6d213)、無需處置。
>
> 📊 成本:CC ~2h(Phase 0 + plan r1-r3 + Phase 1 + Step 4 r1-r2 delta + Step 5 adversarial + Phase 2 bookkeeping)/ 跨模型 review 6 rounds(plan r1-r3 = 3 + Step 4 r1-r2 delta = 2 + adversarial 1)/ P1 1 個(Step 4「的」字 delta)/ P2 0 / Step 5 獨立發現 4 個(F1-F4 全 KEEP/FROZEN by closure rule)。
>
> 📐 量測:主 session Opus 4.7 全程、Codex supervisor via Herdr pane w6:p4;baseline SHA `8c6d213152ee43f1bb59752f21d3a8616ff46d73`;來源分佈(既有/KEEP 4・漏改 consumer 0・baseline 後引入 1):既有 = F1/F2 catalog/runtime SSOT wording drift + fork PR 措辭差 pre-existing、F3/F4 MIGRATION.md GitFlow upgrade acceptance-evidence label 括號簡短版語意精度既有邊界(all KEEP/FROZEN);baseline 後 = Step 4 P1「的」字 delta。

