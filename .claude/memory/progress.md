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

📅 2026-09-05 ① — **P2#3 defer ⑨:CTRL-CI-013 degradation 補 exit 2 三種 case(root 解析失敗 / argv 錯 / 未預期例外)**

> **緣起**:TODOS `TODOS.md` L80 P2#3 Step 5 defer 集合 ⑨(conf 7):「README / catalog degradation 的 exit 2 清單漏 root 解析失敗、argv 錯、未預期例外三種」。Codex supervisor(defer ④ 收工後、Owner sprint-loop 授權下)拍板本 sprint 單條、documentation/SSOT accuracy only、標準車道;frozen full base `d52c92d4d70c3b5b92c21601063cab1936f47148`(origin/main tip = defer ④ PR #60 merged squash);plan 3 rev(r1 D3 誤引用 stale ⑧⑥ / r2 D3 size-driven policy + Phase A-G + entry-count conservation / r3 wording generic argv;r3 APPROVE + GO Step 3)。**Ground truth trace(CodeGraph)**:scripts/check-mutation-specs.ts L307-310(root)+ L338-340(argv)+ L346-348(unexpected exception)。
> **改動**:**3 檔 SSOT**(scripts/mutations/README.md L111 + scripts/control-catalog.json CTRL-CI-013 degradation + docs/CONTROL-CATALOG.md L50 rendered);Phase 2 archive 動 progress-archive/progress-2026-09.md(append ⑪、size-driven Step B、依 supervisor r1 明列 archive immutable 不動 ⑥⑧);無 runtime / test / mutation spec / CI / catalog schema / script docstring 動。Phase 1(atomic docs/SSOT commit)+ Step 5 round 1 fix(F1 CRITICAL:L53 mutate.ts scope 誤 add revert)+ Step 5 round 2 fix(F3 未預期例外拉出 exit 2 clause、獨立陳述保當前 code)+ Step 5 round 3 fix(F3 值域補 0/1/2)+ Phase 2 bookkeeping(本 commit)。
> **驗證(`54e52bd975d5f2f648a856115392f917d79ce81d` 實測、isolated scratchpad worktree wt-defer-9-degradation 隔離跑)**:typecheck / lint 綠;check:catalog **CATALOG_OK — 32 controls;18 steps 雙向對應;docs/CONTROL-CATALOG.md 與 JSON 一致**;catalog:render idempotent(3 跑 sha ident 86a89a7dce1f59dfefedba2bc5bd1b8901701c9a165075335f4c5d7d05809ce9、26302 bytes);check:mutation-specs **12 spec 130 條探針樣本都對得上**;check:doc-refs **533 refs 0 失效**;check:doc-size 綠(Phase 2 archive 後 progress.md 大幅縮減、詳見 Phase 2 gates)。
> **審查**:Codex plan review 3 rev(r1 D3 stale / r2 D3 size-driven + Phase A-G / r3 wording generic argv;r3 APPROVE + GO Step 3);Codex Step 4 commit-object 對 Phase 1 tip `9966400` **APPROVE**(isolated clean clone、frozen full base/tip、ancestry + diff scope 一次通過;獨立 clone 沒 node_modules 但 tsx catalog gate 屬 review 環境不可用、不是 finding);Step 5 adversarial-reviewer round 1 **1 CRITICAL 修 F1**(L53 mutate.ts scope 誤 add、revert)+ **2 INFORMATIONAL** F2 conf 7 evidence/degradation 不對稱(scope-boundary defer)+ F3 conf 5「保 code=2」overclaim → **supervisor Step 5 fix-rereview 拒 F3 skip 明列必修**、round 2 修(未預期例外拉出 exit 2 clause)+ round 3 修(值域 0/1/2 補全);supervisor round 3 選 B APPROVE 進 Phase 2。標準車道 CSO fail-closed REQUIRED = 模板 repo 例外(路徑表為空 = 設計);未加 worktree 獨立審。
> **⭐ 教訓**:①**L53 vs L111 是兩個 script 的 exit-code section**——mutations/README.md 內部 L49 「## Exit code」(L36-47 全 mutate.ts 討論)服務 mutate.ts、L105-119 「## CI 守樣本漂移」服務 check-mutation-specs.ts。Sprint scope 若鎖 check-mutation-specs.ts SSOT,只能碰 L111 不能碰 L53(L53 是 mutate.ts docstring L60-61 逐字複製);加到 L53 = 加到別 script territory、wording 也對 mutate.ts 不精確(parseArgs 而非 parseRootArg、root 失敗被 onFatal 兜為未預期例外)。adversarial-reviewer 首 round 抓 CRITICAL、修法 revert L53 保留 L111 + JSON。②**「保 code=2」需精確描述**——實作 L336-349 code 初始化為 2、可被 L343 report.code 賦值為 0/1/2(runCheck 也回 2)、catch 只印訊息不重設 code;現行修法:「保留當前 code:runCheck 前拋 = initial 2、runCheck 回傳並賦值後拋 = 該次 report code(0/1/2)」(supervisor round 3 精確化)。SSOT accuracy 對 catch 值域精確描述、避 practical risk 低的 skip 判斷。③**generic wording vs enumerate:選 generic 避 coupling**——parseRootArg 拒 3 shapes(unsupported token / > 1 --root / empty --root=),wording 選 A generic「argv 錯(parseRootArg fail-closed)」而非 enumerate、對齊 catalog wording pattern + 未來擴展 wording 不 coupling(supervisor r2 明列)。④**supervisor scope literal 是重要 boundary**——F2 evidence/degradation 不對稱 conf 7 依「degradation only」scope boundary defer 是合理決策(不擴 sprint scope、記入 defer 供未來 sprint 一致化);但 F3 conf 5「保 code=2」被 supervisor 覆判 SSOT accuracy 錯誤必修、conf 分類不能取代 supervisor 明列。
> **⏭️ 下一棒候選**(hint 非 truth):A. P2#3 defer 剩 4 條(⑫⑬⑭⑮ 逐條 0.5h;含本 sprint Step 5 defer F2 evidence 不對稱 conf 7);B. A3 defer 剩 19 條;C. A2 defer 集合 17 條 INFO;D. Milestone B1;E. P2#2 defer 集合 剩 7 條;F. A1.1 defer 集合 23 條。
> **check:claims 逐條處置**:0 新命中(本 sprint 純 documentation/SSOT wording 補述、無新絕對化宣稱句加入 lib docstring / docs 主張)。
> 📊 成本:CC ~5h / 跨模型 review 5 rounds(plan r1/r2/r3 supervisor + Step 4 supervisor + Step 5 adversarial round 1 + Step 5 supervisor fix-rereview round 1/2 明列必修 F3 + round 3)/ P1 0 個 / P2 0 個 / Step5 獨立發現 3 個(F1 修 + F3 supervisor 覆判必修、F2 skip)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、documentation/SSOT sprint、3 SSOT 檔對齊);Codex gpt-5.6-terra medium(w6:p4)plan 3 rev + Step 4 + Step 5 fix rereview 3 round;baseline `d52c92d4d70c3b5b92c21601063cab1936f47148`;來源分佈:既有缺陷 3(3 case wording 從未寫入 3 SSOT、屬既有 gap;defer ⑨ 條目登錄時已為既有缺陷)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan 3 rev + CodeGraph ground truth trace / 2 ✅ Codex plan review r3 APPROVE + Owner APPROVE / 3 ✅ isolated worktree(scratchpad wt-defer-9-degradation)+ Phase 1 atomic docs/SSOT commit(9966400、3 檔 4+/-4)+ Step 5 round 1 fix(87cb5b5、L53 revert)+ round 2 fix(0a4d77a、未預期例外拉出)+ round 3 fix(54e52bd、值域 0/1/2)/ 4 ✅ Codex Step 4 對 9966400 APPROVE / 4.5 ✅ CSO fail-closed = 模板 repo 例外(路徑表為空 = 設計、人工判定 = documentation/SSOT accuracy、no auth / authorization / payment / PII / audit or production logic、標準車道)/ 4.6 ✅ 未觸發(無 UI)/ 5 ✅ adversarial-reviewer round 1(1 CRITICAL 修 F1、1 INFO F2 skip、1 INFO F3 supervisor 覆判必修)+ supervisor fix rereview 3 round(round 1 F3 拒 skip、round 2 F3 修拉出 clause、round 3 值域精確化、選 B APPROVE)/ Phase 2 archive ⑪ + 加 ⑨ + TODOS ⑨ ✅ + entry-count conservation ✅(pre 17 + 新增 ⑨ = post 18、每 entry 恰 1 次)/ 6-7 待執行(Owner sprint-loop 授權)

📅 2026-09-04 ④ — **P2#3 defer ④:WONTFIX 決策記錄(本地 git clone file:// fixture 兩例實測、pathToFileURL swap 對此兩例為 cosmetic、無 regression evidence)**

> **緣起**:TODOS `TODOS.md` L80 P2#3 Step 5 defer 集合 ④(conf 7):「測試手拼 `'file://'+path` 應改 `pathToFileURL`」。本 session 起手先開 code sprint plan(r1-r3 supervisor APPROVE 過)、進 Step 3 pre-flight dry-run(plan §驗證方式 §1 明列 gate)**意外通過**——本地 git clone file:// fixture 兩例(path 含 `#` 一例、path 含 literal space 一例)皆 exit 0、pathToFileURL 產出 encoded URL 對同兩例亦 exit 0、與 raw URL 無可觀察差異(**兩例範圍內**;**不推廣**至其他 chars / general URL semantics / URL parser implementation)。Codex supervisor 拍板 A. WONTFIX defer ④、關閉前 code plan(不動 `tests/check-baseline-governance.e2e.test.ts` L211)、要求開新 decision-record sprint 記錄。frozen full base `0a61c16311a757f6588db8c4472c9562895082d4`(origin/main tip post-defer ⑪ PR #59);decision-record plan 3 rev(r1 三 corrections:D6 lock ② retain Step 4 / Phase 拆兩 TODOS pre-review + progress post-Step5 / isolated scratchpad worktree、r2 shared main read-only + prose scope 限縮、r3 Context 段 prose 限縮),supervisor r3 APPROVE + GO Step 3。
> **改動**:**2 檔**(無 code / test / runtime / mutation spec 動作、純 memory / TODOS decision + bookkeeping)。**Phase 1**(`733fff4`):`TODOS.md` L78 頂列狀態句更新(含 ④ WONTFIX 決策記錄、剩 5 條 ⑨⑫⑬⑭⑮)+ L80 條目 ④ strikethrough + WONTFIX marker + L88 之後加「刻意保留(④,PR #___)」段(pattern 仿 L75 P2#2 defer 集合、wording 限縮到本地兩例、`PR #___` placeholder 待 Step 6 補號)。**Step 5 fix round 1**(`146fb76`):`TODOS.md` L78 header wording 拿掉「10/12」分數形式、避免同句「10/12」vs「剩 5」arithmetic 自我矛盾;pre-existing stale「12 條 INFORMATIONAL」count 不動(non-scope、擴 scope 應開獨立 sprint)。**Phase 2(本 commit,bookkeeping-only)**:本 entry。**禁區守住**:runtime / test / mutation spec / catalog / CI / governance 檔全 0 line 動;shared main 全程 read-only(Owner CLAUDE.md M 保留原地、不 carry 不 inspect);3 支老 stash 不動;`.claude/worktrees/agent-*` 不動。
> **驗證(`146fb7660d5d646a58f74e33f62f47c5d3fd2f93` 實測、isolated scratchpad worktree `wt-defer-4-record` 隔離跑)**:**Phase 1 gates**:typecheck / lint / check:todos exit 0(10 PR 全 merge 證據、0 失效)+ git diff --stat 目視 1 檔 TODOS.md。**Phase 2 gates**(對 `5e6f21a70ca111fdff405e8fdbcf95fbd22d4038` 實測):`npm run check:bookkeeping` **exit 0**(「共 1 檔 bookkeeping:1 violations:0 / ✅ 全部檔案都在 bookkeeping allowlist 內:.claude/memory/progress.md」)/ `npm run check:doc-size` **exit 0**(「.claude/memory/progress.md — 18.1 KB / 20 KB(91%)/ .claude/memory/LESSONS.md — 23.5 KB / 60 KB(39%)」;91% 接近 20 KB 門檻、記入下一棒 archive 候選)/ `git diff --stat HEAD^..HEAD` 目視 1 檔 progress.md 13+/-0。
> **審查**:Codex plan review 3 rev(r1 三 corrections、r2 單 prose-scope correction、r3 APPROVE);Codex Step 4 commit-object 對 Phase 1 tip `733fff4` APPROVE(isolated clean clone、frozen full base/tip、ancestry + diff scope 一次通過);Step 5 adversarial-reviewer round 1 **0 CRITICAL、1 INFO conf 7 修 F1**(L78 arithmetic 10/12 vs 剩 5 自我矛盾、修為 wording 拿掉分數)、2 INFO conf 4 skip(F2 bullet 位置與 L75 pattern nit、F3 L80 strikethrough 內 `(conf 7)` stale tag);Codex Step 5 fix round rereview 選 A(對 `146fb76` 重跑 commit-object review)APPROVE。標準車道 CSO fail-closed REQUIRED = **模板 repo 例外**(路徑表為空 = 設計);未加 worktree 獨立審。
> **⭐ 教訓**:①**pre-flight dry-run 是 plan §驗證方式 §1 明列 gate、真正救本 sprint**——若沒跑 dry-run、直接進 Phase 1 實作、Step 4 supervisor commit-object review 也可能 approve wording 上看似合理的 negative assertion,但 vitest 跑 `expect(() => clone).toThrow()` 會 fail(git 不 throw),整個 sprint 破在測試層才發現、還要 roll back。dry-run 在 Step 3 起手就把 regression 前提實測、避免 cosmetic swap 合進主線。②**本地 git clone file:// fixture 兩例觀察**:path 含 `#` 一例與 path 含 literal space 一例皆 exit 0,兩例範圍內「raw file:// URL vs pathToFileURL encoded URL」對 git clone 無可觀察差異;**不推廣**到 general URL semantics 或其他 chars(supervisor plan review r1-r3 lock scope 限縮)。③**decision-record sprint 是 defer 條目「實測後不做」的正式收條路徑**——避免 pending 條目累積成殭屍、下次接手 session 重複踩相同 sprint。TODOS 用「刻意保留」段 pattern(仿 P2#2)明確標 WONTFIX + 實測 evidence + PR # 引用。④**supervisor 起手 sprint 拍板 gate「cosmetic swap without behavior evidence is insufficient」實質有效**——dry-run pass 場景會直接命中這條 gate、trigger stop-and-report、supervisor 才能拍板 WONTFIX。若無這條 gate、可能 approved plan 直接進實作、fail 在測試層。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):A. P2#3 defer 剩 5 條(⑨⑫⑬⑭⑮ 逐條 0.5h;含本 sprint Step 5 defer F2/F3 conf 4 nit);B. A3 defer 其餘 20 條;C. A2 defer 集合(17 條 INFO);D. Milestone B1;E. P2#2 defer 集合(8 條);F. A1.1 defer 集合(23 條)。
> **check:claims 逐條處置**:0 新命中(本 sprint 純 memory / TODOS 決策 + bookkeeping、無新絕對化宣稱句加入 lib docstring / docs 主張)。
> 📊 成本:CC ~4h / 跨模型 review 4 rounds(supervisor plan r1/r2/r3 + Step 4 對 Phase 1 tip + Step 5 adversarial-reviewer round 1 + Step 5 fix round supervisor 選 A rereview)/ P1 0 個 / P2 0 個 / Step5 獨立發現 3 個(F1 修 + F2/F3 skip)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、decision-record sprint、單檔 TODOS + 單檔 progress);Codex gpt-5.6-terra medium(w6:p4)plan 3 rev + Step 4 對 Phase 1 tip + Step 5 fix round rereview;baseline `0a61c16311a757f6588db8c4472c9562895082d4`;來源分佈:既有缺陷 0・漏改 consumer 0・baseline 後引入 3(全 Step 5 adversarial-reviewer round 1、F1 修 + F2/F3 skip)
> **7 步 checklist**:1 ✅ plan 3 rev + Codex APPROVE r3(D1 wording 限縮、D2-D6 全 lock、Phase 拆兩、Step 4 保留、isolated worktree)/ 2 ✅ Codex「plan approve = go Step 3」+ Owner APPROVE / 3 ✅ isolated worktree(scratchpad path)+ Phase 1 atomic decision-record commit(`733fff4`、TODOS.md 3+/-2)+ Step 5 fix round 1 commit(`146fb76`、TODOS.md 1+/-1)/ 4 ✅ Codex Step 4 對 `733fff4` APPROVE + fix round rereview 選 A 對 `146fb76` APPROVE / 4.5 ✅ CSO fail-closed REQUIRED = 模板 repo 例外(路徑表為空 = 設計、人工判定 = test-only URL construction、no auth / authorization / payment / PII / audit or production logic、標準車道)/ 4.6 ✅ 未觸發(無 UI diff)/ 5 ✅ adversarial-reviewer round 1(0 CRITICAL、1 INFO conf 7 修、2 INFO conf 4 skip、記入 Step 5 defer)/ 6-7 待執行(Owner 授權 CI 綠自動 merge、無 no-PR / direct-push exception、supervisor final APPROVE 後執行)

> 更早的 entries:2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
