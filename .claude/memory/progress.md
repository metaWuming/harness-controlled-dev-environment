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

📅 2026-09-05 ⑦ — **P2#2 defer ③:loadAllowedPrs exit(2) 前不建 cnst-* pattern 目錄(順序前置、fixture tmpdir 集合守恆 regression test)**

> **緣起**:TODOS.md L72 P2#2 Step 5 defer 集合 ③(conf 9):「`check-no-source-terms.ts` 新 `process.exit(2)` 在 `main()` mkdtemp 之後、`finally` 清理不跑、本機反覆失敗會留 `cnst-*` 目錄;修法建議:把 `loadAllowedPrs` 移到 pattern file 建立前、或改回傳值」。P3 delivery-refs 集合 100% closed(2026-09-05 ⑥ squash `pull request 編號 66`)後、Codex supervisor w6:p4 gpt-5.6-terra 拍板本 sprint = P2#2 defer ③ 單條、標準車道;frozen full base `393ef536303fb7669c629bbb0a5d65366ef4ac58`(origin/main tip = P3 集合 closed squash);shared local main 仍在 233858f + CLAUDE.md M(全程不 pull/touch、下 session lock 該 pattern);plan APPROVE + GO Step 3 首輪(supervisor 校正 4 條:①註解 wording 機制描述、②assertion 用排序 before/after 集合守恆 + created.push、③impact radius 補 tests/invoked-as-main.e2e.test.ts + scripts/mutations/delivery-refs.json DR-M5 regression coverage、④supervisor model gpt-5.6-terra + D3 反向探針屬 implementation verification 非 Step 4 evidence)。
> **改動**:**2 檔 atomic Phase 1**(+33/-6、tip `7694a0ca531dd2d2a5b7877ca2ecfaee7e422838`):①`scripts/check-no-source-terms.ts` main() 內 `loadAllowedPrs(root)` + 隨後 `console.log("── allowedPrs: ...")` **移到** partitionPatterns / writePatternFile × 3 前(於 drift check 後);加 1 行機制註解 `// loadAllowedPrs may exit(2); resolve it before creating temporary pattern files.`;無其他 line 動(+7/-6、net +1、單一區塊移動)。②`tests/check-no-source-terms.test.ts` 加 `readdirSync` 於既有 fs imports + 1 新 e2e case「🟢 P2#2 defer ③:loadAllowedPrs exit(2) 前不建 cnst-* pattern 目錄(fixture tmpdir 集合守恆)」(插在 L900 base.missing case 後、L902 origin/develop case 前、+26/-0):`mkdtempSync(join(tmpdir(), "cnst-defer3-tmproot-"))` 建 fixture tmpdir、`created.push(fixtureTmp)` 沿既有 afterEach cleanup registry、`readdirSync(fixtureTmp).filter(f=>f.startsWith("cnst-")).sort()` 排序集合 before/after 對比守恆、`runChecker(dir, { TMPDIR: fixtureTmp })` 傳 env override 讓 SUT `os.tmpdir()` 拿到 fixture-scoped path、`makeRepo({ ..., noOrigin: true })` 觸發 `[base.missing]` 早退、assert `code === 2` + `out.toContain("[base.missing]")` + `after.toEqual(before)`。**Precise contract**:loadAllowedPrs 於 drift check 後、writePatternFile 前、任何 cnst-* 建立前執行;若 delivery-ref 驗證 fail(base.missing/base.undeclared/base.noncanonical/base.unresolvable/config.invalid 五碼共走 `console.error(formatRejections) + process.exit(2)` 二行 shared exit path)→ 此時尚無 cnst-* 目錄 → 無 leftover。**禁區守住**:loadAllowedPrs signature / exit(2) 語意 / delivery-ref fail-closed 邊界 / 錯誤訊息 / writePatternFile / cleanup callback / mkdtempSync cnst- 前綴 / 3 個 scan 段 / baseline decision / try-finally 骨架 / bootstrap / detectInvocation / reportIfNotMain / CI / control-catalog / mutation specs(含 delivery-refs.json DR-M5 loadAllowedPrs 內 find 樣本)/ SSOT docs / shared main 233858f + CLAUDE.md M / 3 支 stash / 保留 worktrees / remote 全 0 line 動。
> **驗證(worktree wt-p2p2-defer-3-cnst-leak 內、frozen tip `7694a0ca` 上實測、非 preflight)**:git diff 393ef536..7694a0ca --stat 2 檔 +33/-6(逐字對得上、diff hash `42619f40f3e3ff11e8ce59b9c96cb7576f0963ffe4f5cf480683ded10f6d0840`);typecheck (`npx tsc --noEmit`) 綠;lint (`npm run lint`) 綠;`npx vitest run tests/check-no-source-terms.test.ts` **174 passed**(base 173 + 新 1);`npm test` 全 suite **31 files / 1025 passed + 3 skipped**(base 30 files / 1021 passed);`npm run check:mutation-specs` 12 spec 130+ 條探針全對得上(含 delivery-refs.json DR-M5 loadAllowedPrs 內 find 樣本 無 drift);`npm run check:catalog` CATALOG_OK 32 controls。**反向探針**(手動、Claude implementation verification、非 Codex Step 4 evidence):`git stash push` 隔離 runtime fix、跑新 case → assertion 轉紅、`expect(after).toEqual(before)` fail、實測 after = ['cnst-kAbJGC', 'cnst-z1aOHm'](2 個殘留 cnst-*)、before = [];`git stash pop` 恢復 fix、case 恢復綠 → 行為級 test 真守 order 契約、mutation-sensitive、非 prose。
> **審查**:Codex plan review round 1 APPROVE + GO Step 3(supervisor 校正 4 條 wording 執行約束、不重送 plan);Codex Step 4 commit-object review 對 Phase 1 tip `7694a0ca` **APPROVE + GO Step 4.5/4.6/Step 5**(獨立 clean clone、frozen full base/tip、逐字 patch 顯示 loadAllowedPrs 位於 drift guard 後 / 任何 cnst-* 建立前;獨立 clone targeted e2e 1 passed、mutation drift 12 specs 130 probes 對得上;首次 sandbox tsx IPC socket EPERM 假紅、非 sandbox runtime 重跑通過;7 項逐條 clean);Step 4.5 CSO 標準車道人工判定 CSO_NOT_REQUIRED(模板 repo 路徑表為空 = 設計、diff 無 auth/authorization/payment/PII/audit or production logic 邊界);Step 4.6 未觸發(無 UI diff);Step 5 adversarial-reviewer round 1 **0 CRITICAL / 6 INFORMATIONAL** (conf 3-8):F1 (conf 8) before snapshot 折疊、F2 (conf 6) fixture 前綴 cnst-、F3 (conf 4) 註解未列 rejection 碼、F4 (conf 5) 只鎖 base.missing 一路、F5 (conf 5) fixture payload unused、F6 (conf 3) scan-phase cnst-diff-* 混淆;**supervisor 分類 6 條全 KEEP**(F1 集合守恆比硬碼 [] 更準確表達契約 + 保留未來 fixture 預置語意、F2 只掃 fixtureTmp 內部 children 不掃 parent 安全、F3 註解描述共通控制流不列 rejection 清單以免同步負擔、F4 5 碼共用同一 exit path 單 case 覆蓋等效、F5 payload 為觸發 base.missing 必要 fixture 形狀、F6 保留 cnst-diff-* 更保守避掩蓋未來 ordering regression);actionable = 0、backlog-worthy = 0、Step 5 收乾。
> **⭐ 教訓**:①**「exit 前不建資源」是最小 surgical 修法** → 避免全域 signal handler / temp framework / signature 變化的 scope 擴大;修法在 process.exit 呼叫點 upstream(在建立資源之前完成所有可能 exit 的預檢)比 downstream(改 exit 為 return + caller finally)diff 面小、契約邊界不動。②**TMPDIR env override + 排序集合守恆 = mutation-sensitive 行為級 test 的乾淨 pattern**:`before === after` 表達「無新增」比 `after === []` 表達「絕對空」語意更精確(蓋 fixture 可能未來預置);`created.push` 沿既有 afterEach cleanup registry 避加 module-level machinery;反向探針(手動 stash + rerun)直接證明 mutation-sensitive、實測數量(2 個殘留)非空集合。③**supervisor 分類拍板全 KEEP 於低-中 confidence findings 收乾 round 2 迭代**:F1-F6 每條 KEEP 論證都在「文檔敘述 SSOT vs 現有形狀 vs 未來假設情境」三軸精確落位——F1 反向論證「集合守恆比硬碼 [] 更準確表達契約」、F3 反向論證「列舉 rejection 碼會製造同步責任」、F6 反向論證「保留 cnst-diff-* 更保守避掩蓋未來 regression」——三例都是 supervisor 拿「可能負向 side effect」對抗「表面收益」、KEEP 是低 confidence findings 的 default 而非 FIX;round 數壓縮的關鍵。④**worktree 需獨立 `npm ci` 安裝 node_modules**——vitest 內 execFileSync spawn tsx 用 `join(REPO_ROOT, "node_modules/.bin/tsx")`、REPO_ROOT 從 `git rev-parse --show-toplevel` 拿 worktree path、若無 node_modules 則 tsx binary ENOENT、86/174 e2e 全 fail(status undefined → -1、out 空)、只有 pure-function unit test 過;`npm ci` 安裝後 174/174 綠。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A. P2#2 defer 剩 6 條(④隨 env 移除自然消失 / ⑤ tag DoS conf 6 / ⑦ harnessConfigJson 重複 conf 6 / ⑨ LESSONS/OVERVIEW 舊 env conf 5 / ⑧ 隨 env 移除自然消失);B. A3 Step 5 defer 剩 19 條 INFO ≤7;C. A2 Step 5 defer 17 條 INFO ≤6;D. A1.1 defer 23 條 conf ≤7;E. 單條:grep.column NUL 錯位(conf 8、0.5-1h)/ mutate.ts SIGTERM 不還原(conf 8、1h、P3);F. Milestone B1(新開)。
> **check:claims 逐條處置**:0 新命中(本 sprint 純 runtime 順序調整 + 行為級 regression test、無新絕對化宣稱句加入 lib docstring / docs 主張)。
> 📊 成本:CC ~1.5h / 跨模型 review 4 rounds(plan review 1 rev + Step 4 commit-object + Step 5 adversarial round 1 + supervisor 分類 KEEP)/ P1 0 個 / P2 0 個 / Step5 獨立發現 6 個(0 CRITICAL / 6 INFORMATIONAL 全 KEEP)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、極窄 sprint 2 檔 33-line diff);Codex gpt-5.6-terra medium(w6:p4)plan APPROVE + Step 4 APPROVE + Step 5 supervisor 分類;baseline SHA `393ef536303fb7669c629bbb0a5d65366ef4ac58`;來源分佈:既有缺陷 1(main() 內 loadAllowedPrs 呼叫位置導致 exit(2) 繞過 finally 的 cnst-* leftover、defer ③ 條目登錄時已存在)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan file + impact radius + Sensible Defaults 9 條 + 起手記憶對抗檢查 / 2 ✅ Codex plan review APPROVE + GO Step 3(校正 4 條 wording) / 3 ✅ isolated worktree wt-p2p2-defer-3-cnst-leak + `npm ci` + Phase 1 atomic 2 檔 commit `7694a0ca` / 4 ✅ Codex Step 4 commit-object review APPROVE(獨立 clean clone、frozen base/tip、7 項逐條 clean) / 4.5 ✅ CSO 標準車道人工 CSO_NOT_REQUIRED(模板 repo 路徑表為空 = 設計) / 4.6 ✅ 未觸發(無 UI diff) / 5 ✅ adversarial-reviewer round 1(0 CRITICAL / 6 INFORMATIONAL / supervisor 分類全 KEEP / 0 actionable / 0 backlog-worthy) / Phase 2 archive 前 sprint entry pending(依 doc size 決定) + 加 ⑦ + TODOS ③ ✅ + PR 引用位待 Step 6 補號 + entry-count conservation ✅(pre 20 + 新增 ⑦ = post 21、每 entry 恰 1 次)/ 6-7 待執行(Owner sprint-loop 授權)

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
