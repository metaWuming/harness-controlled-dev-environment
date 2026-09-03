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

📅 2026-09-03 ④ — **P2#3 defer ①② 後續:遷 remaining 8 支 script 到 invoked-as-main lib**

> **緣起**:PR #50 sprint 中 repo-wide grep 發現 owner-scoped 3 支以外仍有 8 支同款舊 isMain 寫法(A/B 兩派、皆未 realpath、symlink 目錄呼叫可能 silent exit 0)。Owner 拍板 Q7=B(遷移進獨立 sprint)、supervisor plan approve 6 rev 收乾(rev4 Phase 9 條件式跳過、rev5 D6 full suite 掛點、rev6 §12 算術)、Owner「plan approve 即 go」持續授權。frozen base `0174b0dc954168f9f4eced70a9135611ffdd396c`(main post-#50),主 worktree `feat/invoked-as-main-migration-remaining`。
> **改動**:**13 檔 / 13 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count`,含 Step 4/5 fix)。8 支 script(A 派:check-doc-size / check-bookkeeping-commit / check-no-source-terms;B 派:check-cso-trigger / check-adoption-readiness / check-doc-refs / check-baseline-governance / render-control-catalog)全遷 `detectInvocation + reportIfNotMain + caller 顯式 exit(2)` pattern;unused fileURLToPath / pathToFileURL imports 各支按需清理。8 個新 wrapper.mjs 在 tests/fixtures/;既有 e2e 檔 CONSUMERS 加 8 條 = 44 case(11 支 × 4 場景)。**B4 3-step wrapper**(cache check-bookkeeping-commit + check-no-source-terms 化解 static chain)+ **check-control-catalog wrapper 同 Phase 8 升級為真 2-step**(sprint 3 defensive 假設今成真、render-control-catalog 遷完會撞 chain)。`scripts/mutations/invoked-as-main-migration.json` 8 條 caller-wiring mutant(每支刪 else-if exit(2) branch、由 e2e case #4 精確 kill)。catalog **6 個 control**(CTRL-CI-005/006/007/009/012 + CTRL-SOP-007)追加 lib 到 implementation(D7 jq `.id` evidence);docs/CONTROL-CATALOG.md render 同步;scripts/mutations/README.md 列新 spec;TODOS P3 條目 ✅ + PR #___ + 修 sprint 3 遺留「7→8」不一致。
> **驗證(`6820efe` 實測)**:typecheck / lint / **27 檔 958 passed + 2 skipped**;`npm run mutate --spec invoked-as-main-migration.json --cmd "npx vitest run tests/invoked-as-main.e2e.test.ts"` **8/8 全被抓** 綁 `6820efe323295b0f8b1d061b8a832624b42638d0`;check:mutation-specs(10 spec 112 探針)/ check:catalog(31 controls / 17 steps)/ check:doc-size / check:claims 綠。
> **審查**:Codex Step 4 r1 **P2 散文級**(TODOS「7→8」sprint 3 遺留不一致、依 SOP 不另跑輪) → APPROVE。Step 5 兩道 review:**標準審 APPROVE**(0 CRITICAL、2 INFO conf 3 skip);Step 5 **高風險 worktree 審 r1 CRITICAL**(check-bookkeeping-commit case #1/#2 硬綁 `expectedMainExit: 1`,round 1 P2 散文 fix 讓 HEAD 變 bookkeeping-only commit → direct exit 0、CI 硬紅擋 merge、mutate 對照 tie 到 failing tests 8/8「無法判定」——這正是 SOP 5 高風險車道要抓的「主 session 在舊 checkpoint 跑過綠、散文 fix 沒重跑套件」形貌)→ 修 `expectedMainExit: number | readonly number[]` + assertExpectedExit helper + check-bookkeeping-commit `[0, 1]` 接受兩合法狀態 + matcher 收窄「目標 commit:」前綴 → **r2 APPROVE**(fresh worktree 44/44 綠、mutate 8/8 killed 綁 6820efe、全套 954 綠、IAMM-M2 與 [0,1] 鬆化獨立驗過)。
> **⭐ 教訓**:①**「exit 依 HEAD 內容變」的 test 不能硬綁單一 exit code**——check-bookkeeping-commit direct exit 依 HEAD 是 bookkeeping/code commit 分別為 0/1,兩者皆合法。sprint 中段作者在含 code 的 checkpoint 上寫 test、綁 exit 1、綠;round 1 散文 fix 讓 HEAD 變 bookkeeping-only → direct 正確回 0、test 紅、CI 擋 merge。修法:期望改為 `[0, 1]` array + matcher 收窄到共同 stdout 特徵(此處為「目標 commit:」前綴)。②**「散文 fix 沒重跑全套」是主 session 常見盲點**——check:bookkeeping 顯示 095f91b 是 bookkeeping-only 就以為 gate 全通、但實際 test suite 依賴 HEAD 內容的 test 會壞。修法:非 bookkeeping fix 之外,**bookkeeping-only fix 也要跑 full suite** 一次(或至少跑 dependent tests),不能只靠 bookkeeping check。SOP D6 已改「Phase 8 後 + Phase 10/11 最終跑全套」是對的方向,但這個 sprint 沒在 095f91b commit 後跑 full suite、跳過了 Step 5 標準審之前的 gate → Step 5 worktree 車道抓到。③**worktree 車道存在的意義驗證**——本次 CRITICAL 唯有乾淨 worktree 從 tip 跑 vitest 才會現形;主 session 因 e2e case #1/#2 在 4ae2754(sprint 中段)綠過、後續 095f91b 沒重跑套件、以為套件仍綠,worktree 審打穿。SOP 高風險車道加 worktree 審設計正確、值得保留。
> **⏭️ 下一棒候選**(hint 非 truth):A. Milestone B1;B. P2#3 defer ③-⑮ 其他條目(含 defer ③ 「fileURLToPath 非-file URL 頂層 throw、caller 無法 graceful 處理」);C. A2/A3 defer 集合;D. sprint 3/4 累積的 P3 defer 條目清單 pending 者。
> **check:claims 逐條處置**:0 處新命中(sprint 3 已解 3 處、本 sprint 遷移不引入新宣稱)。
> 📊 成本:CC ~4h / plan 6 rev / Codex Step 4 1 輪(P2 散文)/ Step 5 標準審 1 輪 + worktree 審 2 輪 / mutate 3 輪(初 8 + round 2 重跑 8 + fix 後重跑 8)/ P1 1 個(worktree r1 CRITICAL)/ P2 3 個(Codex r1 散文 + worktree r1 CRITICAL + 其餘 INFO skip)/ Step5 獨立發現 6(1 CRITICAL、5 INFO;修 1、skip 5)
> 📐 量測:claude-opus-4-7[1m] effort xhigh(主 session)+ adversarial-reviewer 標準審 + isolation:worktree 審 x2 輪;Codex gpt-5.6-terra medium(w2:p8);baseline `0174b0dc954168f9f4eced70a9135611ffdd396c`;來源分佈:既有缺陷 1(TODOS heading sprint 3 遺留)・漏改 consumer 0・baseline 後引入 5(worktree r1 CRITICAL 由初 e2e patch 引入、其餘 INFO 由初 patch)
> **7 步 checklist**:1 ✅ plan 6 rev / 2 ✅ Codex APPROVE + Owner 持續授權(plan approve = go)/ 3 ✅ Phase 1-8 + 10 + 11 atomic commits(Phase 9 條件式跳過)/ 4 ✅ Codex r1 P2 散文 PASS / 4.5 ✅ 人工判高風險車道,探針 8/8 綁 `6820efe323295b0f8b1d061b8a832624b42638d0`(8 caller-wiring mutant 由 e2e case #4 精確 kill)/ 4.6 ✅ 未觸發(diff 不碰 UI)/ 5 ✅ 標準審 APPROVE + worktree r1 修 CRITICAL → r2 APPROVE / 6-7 待執行(Owner 已授權 CI 綠自動 merge)

📅 2026-09-03 ③ — **P2#3 defer ①②:invoked-as-main 共用 lib(fail-closed CLI 入口不再靜默 exit 0)**

> **緣起**:TODOS P2#3 Step 5 defer ①②(supervisor 拍板 Q7=B、Owner 授權 go)。①`mutate.ts` / `check-control-catalog.ts` 的 `isMain` 未 realpath,經 symlink 目錄呼叫靜默 exit 0(fail-closed 守門自 fail-open;r1 C1 只修了 check-mutation-specs);②`check-mutation-specs.ts:invokedAsMain` 兩端 realpath 有單邊 fallback,一邊拋仍可能不等 → 靜默 exit 0,根本解是「路徑不可判定必印 stderr、被當 import 用完全靜默」。plan 4 rev(rev1→2 discriminated outcome、rev2→3 sanitize + wrapper 2-step、rev3→4 jq `.id` empty-result-evidence)。frozen base `a8df8d7d3d878f97832fbf7e7d9451f6ff89a2b1`(main post-#49),主 worktree `feat/invoked-as-main-lib`。
> **改動**:**11 檔 / 8 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count`,含 Step 4/5 fix)。新 `scripts/lib/invoked-as-main.ts`:discriminated union `main` / `import-or-not-main` / `indeterminate`(+ 5 個 IndeterminateReason 列舉),`detectInvocation` 純函式無 side effect / 無 throw,`reportIfNotMain` 唯一 stderr 副作用點(對 import 靜默、對 indeterminate 印恰一行 sanitized 診斷,控制字元 escape 為 `\xNN`、超長 200 字截斷附 `...(truncated;len=<n>)`)。三 consumer(mutate.ts:1373-1388 / check-control-catalog.ts:239-245 / check-mutation-specs.ts:180-203)接線;caller 對 indeterminate 顯式 `process.exit(2)`(不 silent exit 0)。tests:17 unit(3 態 + fallback + sanitize + reporter)、12 e2e(三 consumer × direct/symlink/import/indeterminate 四場景);wrapper 檔 `tests/fixtures/invoked-as-main-wrapper/*.mjs`,`check-mutation-specs-wrapper.mjs` 2-step dynamic import 化解 `check-mutation-specs → mutate` static import chain(先在正常 argv1 下 import mutate 讓 module cache、再改 dangling、再 import target),精確驗 caller exit(2) branch。`scripts/mutations/invoked-as-main.json`:8 條探針(5 lib + 3 caller-wiring exit(2) branch)。catalog CTRL-SOP-003 / CTRL-CI-011 / CTRL-CI-013 追加 implementation(依 D7 jq `.id` grep evidence);docs/CONTROL-CATALOG.md 重生成;scripts/mutations/README.md 列新 spec;TODOS P2#3 ①② ✅ + `PR #___` placeholder + 新 P3 條目「其他 8 支 script 同款 invoked-as-main 舊寫法」(未修 8 / 總計 11、含 render-control-catalog.ts、含 wrapper 遷移 coupling note)。
> **驗證(`be25d9b` 實測)**:typecheck / lint / **27 檔 926 passed + 2 skipped**;`npm run mutate --spec invoked-as-main.json --cmd "npx vitest run tests/invoked-as-main*.ts"` **8/8 全被抓** 綁 `be25d9b1797146bfaad75aaf5bcb1f409fcc788d`(對照重跑回綠);check:mutation-specs(9 spec 104 條)/ check:catalog(31 controls / 17 steps) 綠。
> **審查**:Codex Step 4 全範圍 r1 **P1 baseline 後新增 / 行為級**(check-mutation-specs case #4 靠 hasSomeLabel loop 接受任意 label、chain 掩蓋自身 exit(2) branch 沒被驗到;修法 2-step wrapper + 精確 label + M6/M7/M8 caller-wiring mutant)→ r2 **P2 散文級**(README.md/TODOS.md 探針數 5→8,依 SOP 散文級照抄不另跑輪)→ **PASS**。Step 5 兩道 review:標準審 5 findings(0 CRITICAL)—— F1 conf 8(TODOS 漏 render-control-catalog)/ F2 conf 7(check-control-catalog-wrapper 缺 chain defensive 註解)/ F3-4-5(cosmetic 或 pre-existing skip);Step 5 高風險 worktree 審 r1 **APPROVE with 1 finding**(IAM-M3 label 誇大 e2e 覆蓋、只有 unit #10 kill、修法補 case #3 全空 stderr/stdout 斷言讓 e2e 自 kill)→ r2 **APPROVE 0 findings**(fix commit be25d9b 綁定;empirical:3 wrapper case #3 stderr/stdout 全 0 bytes、IAM-M3 mutant 由 case #3 直接 kill 不用 unit #10 兜底)。修合計 3 條(F1、F2、worktree F1)、skip 3 條(F3-4-5)。
> **⭐ 教訓**:①**「hasSomeLabel loop」等於接受任意來源觸發 fail-closed**——本意驗 caller 自身 exit(2) branch,卻允許 static import chain 上任何一個先觸發都算過。ESM 靜態依賴會先 evaluate,dangling argv1 下先跑到頂層的 module 先 exit(2)、後面的頂層根本沒跑。修法:e2e wrapper 對有 static chain 的 consumer 用 2-step dynamic import(先 cache 依賴、再改 argv1、再 import target),斷言精確鎖 label。②**「mutation 被抓」不代表「target test 抓到」**——IAM-M3 靠 unit #10 兜底、e2e case #3 全部漏抓;label 寫「e2e case #3 也會轉紅」是誇大。修法:每條 mutant 逐個驗**哪條 test 實際 fail**、label 只寫真被 kill 的那條;e2e 靜默契約要用 `.toBe("")` 而非「不含特定字面」。③**移植守門一致性:同款 fail-open 有 10+ 支**——本 sprint 只修 3 支(Owner 拍),但盤點時發現另 8 支(A/B 兩派,含 `scripts/render-control-catalog.ts` 這支 CLI 入口)。避免下 sprint 又是「只修一小塊、其餘等下下 sprint」,已在 TODOS 新 P3 條目列完整清單 + 每支 line + 派別 + wrapper 遷移 coupling。
> **⏭️ 下一棒候選**(hint 非 truth):A. **P2#3 defer ①② 後續**——遷移未修 8 支 script 到 invoked-as-main lib(新 P3 條目、獨立 sprint、~1-2h);B. Milestone B1;C. P2#3 defer ③-⑮ 其他條目;D. A2/A3 defer 集合。
> **check:claims 逐條處置**:3 處命中全留 A —— `scripts/lib/invoked-as-main.ts:16`「唯一 stderr 副作用點」= 設計契約字面(lib 內 `process.stderr.write` 只出現在 `reportIfNotMain`);`check-mutation-specs-wrapper.mjs:18`「reporter 靜默、什麼都不會發生」= wrapper 步驟 A 預期,unit #10 + e2e case #3 全空斷言驗證;`tests/invoked-as-main.test.ts:5`「單行保證」= unit #11-13 + e2e case #4 diagLine 斷言字面驗。同步貼進 PR 描述。
> 📊 成本:CC ~5h / plan 4 rev / Codex Step 4 2 輪(r1 P1 + r2 P2 散文)/ Step 5 標準審 1 輪 + worktree 審 2 輪 / mutate 3 輪(初 5 mutant → +3 caller-wiring = 8) / P1 1 個(r1 e2e chain 掩蓋)/ P2 4 個(r2 探針數同步 + 標準 F1/F2 + worktree F1)/ Step5 獨立發現 6(0 CRITICAL、修 3、skip 3)
> 📐 量測:claude-opus-4-7[1m] effort xhigh(主 session)+ adversarial-reviewer 標準審 + isolation:worktree 審 x2 輪;Codex gpt-5.6-terra medium(w2:p8);baseline `a8df8d7d3d878f97832fbf7e7d9451f6ff89a2b1`;來源分佈:既有缺陷 0・漏改 consumer 0・baseline 後引入 6(r1 P1 由初 e2e 引入、r2 P2 由 round 1 fix 引入、Step 5 F1/F2/worktree F1 由初 patch 引入)
> **7 步 checklist**:1 ✅ plan 4 rev / 2 ✅ Codex APPROVE + Owner go / 3 ✅ Phase 1-5 atomic commits / 4 ✅ Codex r1 P1 修 + r2 P2 散文 PASS / 4.5 ✅ 人工判高風險車道(cso 路徑表模板為空、守門 CLI 修 fail-open 屬橫切保守項),探針 8/8 綁 `be25d9b1797146bfaad75aaf5bcb1f409fcc788d`(3 caller-wiring exit(2) mutant 由 e2e case #4 精確 kill)/ 4.6 ✅ 未觸發(diff 不碰 UI)/ 5 ✅ 標準審 + worktree r1 修 F1 → r2 APPROVE 0 findings / 6-7 待執行


> 更早的 entries:2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
