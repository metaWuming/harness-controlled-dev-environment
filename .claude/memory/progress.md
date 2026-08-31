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

📅 2026-08-31 ① — **PR A1.1:A1 review residual 三條(F1 效能重構 / F2 repo-local ADR / F3 docstring)**

> **緣起**:Codex 對 `641065..e1408a3` 做獨立 review,留下三條 P2 residual。獨立 PR、不重做 A1。隔離:全程在乾淨 worktree `fix/a1-review-residuals`,frozen baseline `e1408a34e0b4fa6df1fac74d7c7e958732110c81`(= HEAD = origin/main,range 起手為空)。dirty main worktree 全程未讀、未動。
> **F1(行為)**:舊版對 `baseline..HEAD` 每個 rev 各跑 3 次 `git show` + 3 次 `grep`,其中 main pathspec 產出兩份相同 patch → **同一份 patch 被提取兩次**;成本隨歷史單調成長、會撞 CI 十分鐘上限,而 baseline 是治理決策不能為效能推進。改成:rev 分批(50/批)、每批**一次**不帶 pathspec 的 patch producer、每 rev **只解析一次**成 `Map<path, 新增行>`、同一份 Map 分兩桶供三組 policy 共用、三次 `grep -r` 批掃目錄。subprocess `15 + 6N` → `15 + ceil(N/50) + 3`。掃描語意與判定結果**未變**。
> **F1 新增攻擊面與防線**:pathspec 過濾從 git 移到 JS → 必須自己解析 patch 檔頭路徑。probe 實測到三個非顯然形狀:檔名含空白時 `+++ b/x` 後**多一個 TAB**;`core.quotePath=false` **不解 tab / newline 檔名的 C-quote**;使用者 `diff.noprefix=true` 會讓 header **沒有 `b/`**。修法:`--src-prefix` / `--dst-prefix` / `-c core.quotePath=false` 釘死(實測壓得過 repo config),加 `decodeGitCQuote` + `parsePatchDstPath` + `splitPatchStream` + `stripExcludeMagic`,**任一解析不明確一律 scanner error → exit 非 0**,不得把 section 當空。
> **F2(文件治理)**:committed 引用指向版控外的私人規劃文件、progress 還指個人絕對路徑。新增 canonical ADR(去識別化掃描的 history baseline cutover),記錄決策、source-term 與秘密掃描的政策邊界、template / 下游新歷史 / shallow clone 三情境、baseline 變更授權、導入步驟、效能四條不變量、已知限制、provenance(交付 PR 號 + 首次 baseline SHA)。canonical path 引用**恰 5 處集中在 4 個 consumer**,每處指到穩定 H2 標題。`check-doc-refs` SCAN_DIRS 加一個目錄。**未複製**外部規劃文件內容。
> **F3(散文)**:`validateBaseline` docstring 的分派表寫「跳過 history scan」,與實作及測試相反(round 2 P1a 已改成降級全史掃)。只改文字。
> **改動**:9 檔(含 bookkeeping 2 檔)—— `scripts/check-no-source-terms.ts`(F1 實作 + F3 + 新純函式 6 個);`tests/check-no-source-terms.test.ts`(+33 條:shim T1-T3 / scale C1-C7 / e2e E1-E7b / 注入式 E5・N2・N8a-d / 純函式 U1-U12);`tests/check-doc-refs.test.ts`(+6 條 G1-G5 doc governance);`docs/architecture/`(新 ADR);`scripts/check-doc-refs.ts`(SCAN_DIRS 一行);`.github/workflows/ci.yml` + `scripts/source-term-baseline.json` + `.claude/memory/progress.md`(引用改寫);bookkeeping 2 檔(`progress.md` 本 entry + `progress-archive/progress-2026-08.md` 收批 11、批 12)。**out of scope**:A2/A3/B/C 全部;`--all` 全史 tree-scan 路徑的效能(supervisor 裁示 OUT);三條 A1 deferred 限制不修、只在 ADR 登錄。
> **審查**:plan 走 **3 輪 supervisor review 才批准**。R1 要求 scale contract implementation-neutral、delimiter deterministic fail-closed、parser 邊界契約、doc test 放對位置、shim 透明性、dirty-main 紀律。R2 **否決我提的 B2 雙串流方案**——我把 INV-1 改寫成「每個 pathspec view 一次」等於繞過「每個 commit patch 只提取一次」,理由成立,回到單一 extraction 並補齊全套 parser 契約。**安全關 4.5** `check:cso` fail-closed(表空)→ 模板 repo 例外,**人工視同 CSO_REQUIRED、進高風險車道**(本刀重寫守門的偵測路徑,bug = false green)。**視覺關 4.6** not-applicable(無 UI 檔)。**Step 4 跨模型 review 由 Codex supervisor 執行,我不自證**。
> **驗證**:先寫契約、對**舊實作**跑一次記錄基線 —— 8 條 scale 契約紅(C1/C2a/C2b/C2d/C3/C4/C5p/C6)、15 條行為契約綠;實作後全部轉綠。16 檔 546 tests / typecheck / lint / check:doc-refs 256 引用 0 失效 / check:doc-size(archive 批 11 後 75%)/ check:hooks / check:todos / check:no-source-terms 主線綠(0.43s)。
> **mutation 探針**:13 條(M1-M11 + M4b/M4c),`npm run mutate` **exit 0 全數被抓**,綁定最後一個非 bookkeeping commit。第一輪 **M7 存活**:拿掉 `grep -a` 之後仍會回報命中(印「Binary file … matches」、exit 0),只斷言 exit code 的既有測試抓不到 —— 真正退化的是診斷能力。補 E7b 斷言輸出必須含命中內容本身,再跑轉為被抓。
> **⭐ 教訓**:①**「效能重構」在守門碼裡會換掉信任邊界,不只是換快**——把 pathspec 過濾從 git 移到 JS,等於承接整個 patch 檔頭解析的攻擊面(trailing TAB / C-quote / noprefix 三個形狀都不是讀碼想得到的,是 probe 撞出來的)。動守門碼前先跑唯讀 probe 拿真實輸出,比推論可靠。②**被否決的方案要接受,不要重新定義不變量**——R2 抓到我把「每個 commit 一次」改寫成「每個 view 一次」。改寫定義來讓自己的方案成立,是最難自己發現的一種繞過。③**mutation 存活不一定是「補一條斷言」就好,要先問「這條 mutation 真正退化了什麼」**——M7 退化的不是偵測而是診斷,所以補的斷言是輸出內容而非 exit code。照舊直覺加測試會加錯地方。④**commit-msg hook 再次擋下裸 PR 井號引用**(訊息要用 squash 格式)——這是模板 hook 的 dogfood,第二次生效。
> **⏭️ 下一棒候選**(hint 非 truth):A. PR A2(Template/Adopted mode + Adoption Readiness Gate);B. PR A3(Control Catalog,順帶收 ADR 已知限制 1-3);C. `--all` 全史 tree-scan 路徑的 subprocess 成本(ADR 已知限制第 4 條,目前無指派)。
> **check:claims 逐條處置**:見 PR 描述(pre-merge 於 Step 6 貼)。
> 📊 成本:CC ~3h / 跨模型 review 由 supervisor 執行(plan 階段 3 輪)/ P1 0 個 / P2 3 個(F1/F2/F3,全修)/ Step5 獨立發現 1 個(自審抓到批次體積退化風險,已修)。
> 📐 量測:主迴圈 claude-opus-5 預設 effort / baseline SHA `e1408a34e0b4fa6df1fac74d7c7e958732110c81` / 來源分佈:初始 patch 內既有缺陷 0・初始 patch 漏改的外部 consumer 0・baseline 後新增/修改引入 2(M7 覆蓋缺口 + 自審的批次體積退化,兩者都是本刀新實作帶進來的面)。
> **7 步 checklist 狀態**:1 ✅(plan 在 repo 外、含 impact radius / 正反契約 / mutation / migration / rollback / D1-D11)/ 2 ✅(supervisor R1-R2 修訂後 R3 批准;Owner-only decision = none)/ 3 ✅(6 commits,每 phase gate 綠)/ 4 ⏳ 交 Codex supervisor 獨立 review(我不自證)/ 4.5 ✅(高風險車道:13 條探針 exit 0 綁 SHA)/ 4.6 ✅(not-applicable)/ 5 ✅(自審 1 條 finding 已修 + 本 entry)/ 6-7 待執行

📅 2026-08-29 ① — **PR A1:主線通過自身 source-term gate(baseline cutover + downstream fork 相容 + patch-scan 加固)**

> **緣起**:Codex 產出的優化方案(版控外的規劃文件)拆出的第一個 PR;設計正本已落地為 repo-local ADR `docs/architecture/source-term-history-baseline.md`「決策」。主線 `check:no-source-terms` 紅:`scripts/check-doc-refs.ts:241` 註解與 6 個歷史 commit 的 blob 都含來源專案識別詞、不能重寫公開歷史卻要讓 gate 綠。起手 git 核實:HEAD = origin/main = plan 內 baseline 641065... 完全對齊、baseline 是 HEAD 祖先(等值)、`.codegraph/` + `.gbrain-source` 兩 untracked 保留不刪不 add。
> **改動**:5 檔 —— `scripts/check-doc-refs.ts`(單行註解去識別化,來源專案識別詞 → 中性敘述「下游採用者專案」);`scripts/source-term-baseline.json`(新、schemaVersion=1、`template:641065...` prefix + `_comment` 說明治理);`scripts/check-no-source-terms.ts`(+新純函式 `parseBaselineConfig` / `validateBaseline` / `extractAddedLinesFromPatch` / `scanRevDiff` / `scanBaselineToHeadDiffs`,`BaselineDecision` 三態 ok/template-fallback/fail;`scanGitHistoryBlobs` baseline 給 → per-commit diff scan、null → tree scan 舊行為 / D3-D4 相容;main 三態分派、印 history scan range);`tests/check-no-source-terms.test.ts`(+18 條:P1a-P1i / P1x / P1y / P1z / P1z2 / P1yy / P1zz / P1zz3-9 + `extractAddedLinesFromPatch` 6 條單元);`.github/workflows/ci.yml`(檔頭 + Source-term step 註解:gitleaks 全史 vs source-term baseline cutover 兩條獨立政策)。**out of scope**:PR A2 之後全部項目、不重寫 main history、不刪 denylist、不加全域 allowlist、不改 commit-msg hook、不刪 untracked。
> **審查**:**Codex CLI 6 rounds、9 條 findings 全修**(R1 P1 template pinning + P2 unchanged blob tree-scan 誤報 / R2 P1 template-fallback 永久 skip + P1 patch parser 沒 strip / R3 P2 combined merge-diff + P2 test 隔離 + P3 敘述漂移 / R4 P2 shallow clone 誤降級 / R5 P1 rename dance + P1 .gitattributes -diff / R6 P1 NUL byte binary 短路 + P2 merge grandfathered 誤紅);**R7 剩一條 P2 false positive**(long-lived pre-baseline branch merge 誤紅 cleanup PR),**Owner 拍板 A defer 給 A3**(control catalog 治理層)——理由:非 release blocker、非漏抓、A1 scope 只做 self-verification 不做 baseline governance 機器化。**安全關 4.5** `check:cso` fail-closed(表空)→ 模板 repo 例外人工判定**不進高風險車道**(本 PR 不動 auth/migration/守門碼修改語意、只加去識別化 gate 的 baseline 支援)。**視覺關 4.6** 未觸發(無 UI 檔)。**Step 5** adversarial-reviewer fresh 審(非驗 codex 結論、從 diff 出發):0 CRITICAL / 6 INFORMATIONAL,conf ≥ 6 一條(治理旁路)defer 給 A3、conf 4 一條(grep `-n` 假 line number)+ conf 3 一條(scanCommitMessages 沒 mirror `-a`)順手修、conf ≤ 3 其餘 3 條 skip。cross-model agreement ≈ 0(codex 抓 patch-scan 邊角、adversarial 抓治理層與品質)再度驗證。
> **驗證**:typecheck / lint / test 16 檔 484 passed / check:no-source-terms 主線綠 / check:doc-refs 237 引用 0 失效 / check:doc-size / check:hooks / check:todos / mutation probe 1 條(拿掉 `validateBaseline` ancestor 檢查 → P1e 立刻轉紅 → 手動 kill 成功後還原)。
> **⭐ 教訓**:①**「tree scan → diff scan」語意轉換打開整個新攻擊面家族**——patch format 的 rename detection / -diff attribute / NUL byte / combined merge / --first-parent / shallow / 檔頭 vs hunk 分界 逐輪被抓,6 輪修完仍有 R7 邊角。這說明**選 diff-based 就要承擔全部 diff-format 攻擊面**;A3 之後可考慮「baseline..HEAD tree scan + 對 baseline tree 求差集」的混合模式(見上方 defer 說明)。②**Codex CLI `--base` 是「跨輪固定」不是「每輪往前推」**(round 1 base=origin/main、round 3 base 用了 round 2 fix 完的 SHA → codex 說 diff empty)——SOP Step 4「送第一輪之前先固定 baseline」的 baseline 只用來分類 finding 來源、每輪 review 送審對象都是 origin/main..HEAD 整支 branch。check:claims 的 base 才是「上一輪送審 HEAD」推進。③**commit-msg hook 是 defense-in-depth 的最後底線**——第一次改 commit message 時把來源專名原樣寫進訊息、hook 立即擋、逼我改中性描述;這正是模板 hook 的 dogfood。④**Feature branch 內部 reset --soft 是允許 SOP**(memory `feedback_branch_squash`)——原 Phase 1 test commit 在前、blob-scan 語意讓「未動的 check-doc-refs 版本」被抓,reset --soft origin/main 後把 Phase 3 fix(來源專名去識別化)排最前解決;後來 R1 P2 修完(改 diff-scan)後這個順序約束消失,但已 reorder 就不再翻。
> **⏭️ 下一棒候選**(hint 非 truth):A. PR A2(Template/Adopted mode + Adoption Readiness Gate);B. PR A3(Control Catalog——順帶收乾 R7 baseline 治理旁路 + long-branch merge 誤紅 corner case);C. weekly health check 累積本 sprint 6-round cost metadata(supports docs/EFFORT.md sweep)。
> **check:claims 逐條處置**:命中總計 5 處全留 A —— round 4 diff 1 處(`.codegraph/.gitignore` 外部工具檔文字「never」);round 5-6 diff 各 0/1(同上外部工具);Step 5 adversarial 之後 diff 3 處(check-no-source-terms.ts:1004「只有全史掃才抓得到」= 洗白場景其他三段皆不抓中間 blob、集合可列;`.gitignore` 兩處外部工具檔)。0 降級 B。
> 📊 成本:CC ~4h / Codex review 6 rounds + defer R7 / P1 6 個 / P2 6 個 / Step5 獨立發現 6 個(0 CRITICAL、5 收 3 修 2 skip / 1 defer 給 A3)/ 累計 15 findings 內 9 修 + 3 順手 + 3 skip + 1 defer。
> 📐 量測:主迴圈 claude-opus-4-7 預設 effort / Codex r1-r7 non-interactive medium / adversarial-reviewer default / baseline SHA:`3f3616e`(Step 4 送第一輪前 HEAD;origin/main + Phase 1-4 的最後一 commit)/ 來源分佈:初始 patch 內既有缺陷 2(R1 P1 template pinning + R1 P2 tree-scan 誤報,直接 diff scan 換架構帶進來的家族第一批)・初始 patch 漏改的外部 consumer 0(commit-msg hook 是獨立 code path、不受本 PR 影響)・baseline 後新增/修改引入 7(R2-R6 全部 7 條 P1/P2 都是「R1 P2 修法引入 diff-scan 之後」的 patch-format 攻擊面 + Step 5 adversarial 6 條 informational 中 3 條處置)。
> **7 步 checklist 狀態**:1 ✅(plan file `~/.claude/plans/pr-a1-main-self-verification.md`;含 impact radius / 正反契約 / mutation / 相容性 / rollback / D1-D7 sensible defaults)/ 2 ✅(D1-D7 全 sensible default、無真實 trade-off、直接進 3)/ 3 ✅(Phase 0-4 + reorder 後 3 個 fix source-term/config-checker/test commits + R1-R6 fix commits + Step 5 順手修 = 12 commits;每 phase gate 綠)/ 4 ✅(6 rounds 修 9、R7 defer 給 A3、Owner 拍板 A)/ 4.5 ✅(fail-closed 模板例外 + 人工不進高風險車道)/ 4.6 ✅(未觸發)/ 5 ✅(adversarial fresh 收 3 修 1 defer 2 skip)/ 6-7 待執行

> 更早的 entries(2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
