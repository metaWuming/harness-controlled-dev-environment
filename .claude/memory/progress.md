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

📅 2026-09-05 ⑥ — **P3 delivery-refs 移除集合 ①+②:換交付線 runbook(minimum viable、非推薦操作)+ deliveryBranches 白名單語意 docs 精確化(atomic 4 檔、標準車道人工 CSO)**

> **緣起**:P2#3 集合 100% closed(defer ⑮ squash 53c3d0c、pull request 編號 65)後、supervisor 拍板下一 sprint = **P3 delivery-refs 移除 sprint defer 集合 ①+②**(TODOS.md L64;上一 sprint 交付 P2#2/P2#3 主體、本次收 P3 集合):**① runbook 缺失**(conf 8):MIGRATION.md 「本版不提供換交付線指引」;缺 adopted-mode fixture 實跑 evidence;**② docs 錯誤教學**(conf 6):docs/ADOPTION.md L125 / docs/MIGRATION.md L44 / CHANGELOG.md L43 三處字面「出廠 ci.yml 含 develop——要嘛把 develop 列進 deliveryBranches、要嘛從三行拿掉」;deliveryBranches 語意已變成「允許的 origin/HEAD 目標白名單」、多列或少列都改 A5.ci.if 期望。**Frozen base**:`53c3d0c840029e60b031e7c83ed67d55eba81549`(defer ⑮ squash);shared local main 仍在 233858f + CLAUDE.md M(全程不 pull/touch)。**scope literal**:narrowly scoped SOP-adjacent coverage repair + decision closure;不擴 P2#2 / A3 / 其他 defer 集合;保留最小必要 runtime/test/docs 變更;標準車道人工 CSO(governance docs、無 auth/authorization/payment/PII/audit or production logic 邊界)。
> **改動**:**Phase 1 atomic 4 檔(+188/-6)**:(a) `docs/MIGRATION.md`(+29/-3):[Unreleased] 導入者 bullet wording 改「提供 minimum viable runbook」+ 加附錄 A.1 「換交付線 runbook」7 步(前置決策 / harness.config / ci.yml if 行 + push.branches / hooks / gates 驗證 / runtime evidence / 收尾);每步附 evidence source reference;+ L44 wording 修「deliveryBranches 白名單語意」;(b) `docs/ADOPTION.md`(+3/-1)L125:同 pattern wording 修 + reference MIGRATION 附錄 A.1;(c) `CHANGELOG.md`(+2/-1)L43:同 pattern wording 修 + reference 附錄 A.1;(d) **`tests/p3-runbook-fixture.e2e.test.ts`(+160、new、D5 Option A)**:沿用既有 `makeRepo` + CI_TEMPLATE/CI_ADOPTED infrastructure、canonical state = default-branch-only 交付線(deliveryBranches:['main']、protectedBranches:['main']、ci.yml 三處 if 逐字對應 `expectedCiIfLine(['main'])`)、跑 check:adoption 驗 exit 0 + ADOPTED_MODE READY + `not.toContain('[fail]')` = runbook 步驟 5 machine-verifiable acceptance。**Step 5 fix commit**(F1-F4、+3/-3):F1 anchor 改描述式(去 GitHub CJK slugger 未驗風險)/ F2 CHANGELOG「A5 期望」→「A5.ci.if 期望」對齊 MIGRATION / F3 runbook step 3「push.branches 由 A5.ci.push 對 protectedBranches 驗、依步驟 2 同步」澄清 / F4 line-pin `:502` → symbol reference `expectedCiIfLine`。**禁區守住**:scripts/check-adoption-readiness.ts A5.ci.if 契約(L499-524)/ scripts/lib/delivery-refs.ts / .github/workflows/ci.yml / SOP / catalog / mutation specs / hooks 全 0 line 動;shared main / CLAUDE.md M / 老 stash / 保留 worktrees / feature/sync-check-claims 全不動。
> **驗證(`2613441c5bc80d1543d01e6ef6af7d45523148a9` 實測、fresh worktree wt-p3-delivery-refs-runbook 隔離跑、supervisor fresh 建 lock)**:typecheck / lint 綠(F1-F4 修後 imports 全用、無 unused);`npm test` 全 suite **31 files(pre 30 + 新 p3-runbook)/ 1024 passed + 3 skipped**(+1 新 e2e);`npm run check:todos` 11 個 PR 完成宣稱、11 有 merge 證據、0 失效;`npm run check:doc-refs` **599 refs、0 失效**(3 docs cross-reference 全通);`npm run check:doc-size` progress.md 14.2 KB / 20 KB(71%);`npm run check:mutation-specs` 12 spec 130 條探針全對得上;`npm run check:catalog` CATALOG_OK 32 controls;`npm run check:adoption`(本 repo TEMPLATE_MODE)例外正確;full diff stat vs base:**4 檔 188+/-6**。
> **審查**:Codex plan review r1 APPROVE + D5 Option A 拍板;Codex Step 4 commit-object 對 Phase 1 tip `5908863` **APPROVE**(獨立 clean clone、frozen full range、4 檔 atomic scope 與 diff-check clean、三處白名單語意一致、MIGRATION A.1 七步 evidence source + D9 anti-overclaim 到位、新 e2e 只驗 adopted default-main A5.ci.if canonical acceptance、無 scope leak、0 findings);Step 5 adversarial-reviewer round 1 **0 CRITICAL、8 INFORMATIONAL、10 檢查 8 PASS + 2 PARTIAL/UNVERIFIED**;supervisor 分類拍板:**F1-F4 修**(anchor / A5→A5.ci.if / push.branches 澄清 / line-pin → symbol)、**F5-F8 skip 記非阻斷**(e2e per-sub-check / anti-overclaim 無 gate / promotion PR 邊角 / dead cwd param;conf ≤3、非 accuracy);Step 5 rereview 對 F1-F4 fix tip `2613441` **APPROVE**(F1-F4 只改 docs wording、累積 4 檔範圍不變、無新 actionable findings)。**標準車道人工 CSO**(governance docs、無 auth/authorization/payment/PII/audit or production logic 邊界;模板 repo 路徑表為空 = 設計)。
> **⭐ 教訓**:①**「不提供指引」的空白 target 需 minimum viable runbook + adopted-mode fixture 實跑 evidence 才收條**——defer ① 「本版不提供指引」為 pre-existing gap、conf 8 意味需 empirical evidence 支持;runbook 只寫敘述無實跑 fixture = 缺 machine-verifiable acceptance;沿用既有 makeRepo + CI_ADOPTED infrastructure、canonical state = default-branch-only 交付線、跑 check:adoption 驗 exit 0 + ADOPTED_MODE READY = minimum viable acceptance signal。②**adversarial finding 分「wording drift 對齊」與「line-pin 漂移」兩類都是 doc fragility**——F2(A5 vs A5.ci.if)+ F3(push.branches 誤導)+ F4(line-pin :502)三 CONFIRMED findings、全 doc wording accuracy 缺陷、conf ≤5 但實質誤導風險;修法都 single-line wording swap safe。F1(anchor 未驗)是 machine-verify gap、supervisor 拍板 「不加 anchor gate」避 automation 違 D9、改描述式 cross-reference 是 minimum safe repair。③**preserve legacy paths 是 adopted-repo backward compat 的關鍵**——SOP 是 template、adopted repo 若 TODOS 在 legacy `.claude/memory/*`、grep 對缺檔 no-hit 不 fail、無破壞;defer ② 修 wording 只擴 semantic 精確度、不改 semantic;single-line 修 wording × 3 檔 + reference 統一 = 最 minimal safe repair。④**Step 5 F1-F4 修 vs F5-F8 skip 的分類判準**——CONFIRMED findings(F2/F3/F4)= 對 downstream reader 有實質誤導風險、修法 safe = 修;PLAUSIBLE finding(F1)= machine-verify gap + supervisor scope literal「不加 anchor gate」= 修 wording 而非 gate;conf ≤3 doc fragility(F5/F6/F7/F8)= parity / cosmetic / out of sprint scope = skip 記 defer。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):**P3 delivery-refs 移除集合 100% closed**(①+② 收條);A. P2#2 defer 集合 剩 7 條;B. A3 defer 剩 19 條 INFO;C. A2 defer 集合 17 條 INFO;D. A1.1 defer 集合 23 條;E. 單條 defer(grep.column-z NUL / mutate.ts SIGTERM);F. Milestone B1。
> **check:claims 逐條處置**:0 新命中(本 sprint 純 docs wording 精確化 + minimum viable runbook + e2e acceptance、無新絕對化宣稱句加入 lib docstring / docs 主張)。
> 📊 成本:CC ~2.5h(含 plan r1 APPROVE + Step 4/5/rereview 6 review rounds)/ 跨模型 review 6 rounds(plan r1 supervisor + Step 4 supervisor + Step 5 adversarial round 1 + Step 5 supervisor 分類拍板 + Step 5 rereview supervisor)/ P1 0 個 / P2 0 個 / Step5 獨立發現 8 個(0 CRITICAL / 8 INFORMATIONAL、F1-F4 修 / F5-F8 skip)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、docs wording + minimum viable e2e、Phase 1 atomic 4 檔 + Step 5 fix wording swap);Codex gpt-5.6-terra medium(w6:p4)plan r1 + Step 4 + Step 5 + rereview approve;baseline `53c3d0c840029e60b031e7c83ed67d55eba81549`;來源分佈:既有缺陷 2(defer ①「本版不提供」為 pre-existing gap、defer ② 三處字面錯誤教學為 0.2 breaking 交付時期遺留)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan r1 + context 掃(docs 三處 wording / A5.ci.if 契約 / 既有 e2e infrastructure)/ 2 ✅ Codex r1 APPROVE + D5 Option A / 3 ✅ fresh isolated worktree(wt-p3-delivery-refs-runbook、supervisor fresh 建 lock)+ Phase 1 atomic 4 檔 commit(`5908863`、188+/-6)+ Step 5 F1-F4 fix commit(`2613441`、3+/-3)/ 4 ✅ Codex Step 4 對 `5908863` APPROVE / 4.5 ✅ 標準車道人工 CSO(governance docs、無 auth/authorization/payment/PII/audit or production logic)/ 4.6 ✅ 未觸發(無 UI diff)/ 5 ✅ adversarial-reviewer round 1(0 CRITICAL、8 INFORMATIONAL、10 檢查 8 PASS + 2 PARTIAL、F1-F4 修 / F5-F8 skip)+ rereview 對 `2613441` APPROVE / Phase 2 加 ⑯ + entry-count conservation ✅(pre 22 + 新增 ⑯ = post 23、每 entry 恰 1 次)/ 6-7 待執行(Owner sprint-loop 授權、Step 6 用修後 SOP L423-425 command dogfood 第二次 observed run)

> 更早的 entries:2026-09-05 ⑤ P2#3 defer ⑮、2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
