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

📅 2026-09-05 ② — **P2#3 defer ⑫:e2e case ⑤「外部檔未成為輸入」斷言穩定化(unique marker + 必然 drift 直接證明、不依 spec 數量)**

> **緣起**:TODOS `TODOS.md` L80 P2#3 Step 5 defer 集合 ⑫(conf 6):「e2e case ⑤『外部檔未成為輸入』斷言靠 `not.toContain('對得上')`、fixture 加第二個合法 spec 就失效」。Owner sprint-loop continuous 授權下,Codex supervisor 拍板本 sprint 單條、標準車道;frozen full base `730714f7cfd28278c2560c55b341b80e70aecfce`(origin/main tip = defer ⑨ PR #61 merged squash);plan 3 rev(r1 D2 marker observability flaw、r2 CLI channel 措辭 stdout→stderr、r3 APPROVE + GO Step 3)。**Ground truth trace(CodeGraph)**:`tests/check-mutation-specs.test.ts` L348-361 case ⑤ 現行斷言 `expect(r.err).not.toContain('對得上')` 依賴「fixture 唯一 spec 就是 symlink target」——若 fixture 加第二個合法 spec、stderr 印「對得上」→ assertion fail 但實際保護仍有效(false positive)。
> **改動**:**1 檔 tests/check-mutation-specs.test.ts case ⑤(inline scope、+12/-3)**;無 runtime / CI / catalog / mutation specs / production script / 其他 e2e cases 動;fixture makeRepo helper / describe wrapping / imports 全 0 動。Phase 1(`a4c2488`):加 EVIL_LABEL 常量 `'DEFER12_EVIL_EXTERNAL_MARKER_MUST_NOT_APPEAR'` + EVIL_SENTINEL 常量 `'DEFER12_EVIL_FIND_SENTINEL_NEVER_IN_SRC'`(inline case ⑤ 內);evil.json 從 JSON.stringify(GOOD_SPEC) → JSON.stringify(EVIL_SPEC)(find=EVIL_SENTINEL 對 src/guard.ts 不存在、必然 drift、shape 合法 parseSpecs 通過);斷言刪脆弱 `not.toContain('對得上')`、新加 `r.err.not.toContain(EVIL_LABEL)`(主通道 stderr)+ `r.out.not.toContain(EVIL_LABEL)`(defensive no-leak 雙通道);保留 code=2 + '目標是 symlink' rejection。**Precise contract**:若防線回歸(evil.json 被讀入)必走 checkSpecFile → applyMutation 找不到 EVIL_SENTINEL → problems.push(含 label,check-mutation-specs.ts:257)→ formatReport 回 **code=1** → CLI main 走 `console.error(report.text)` → **EVIL_LABEL 在 stderr**、主斷言抓;`r.out` defensive hedges future stdout redirect / log-path change。**禁區守住**:runtime / CI / catalog / mutation specs / production script / 其他 e2e cases(④⑥⑦⑧⑨⑩⑪⑬⑰-⑳)全 0 line 動;shared main read-only(CLAUDE.md M 保留、不 carry / 不 inspect);3 支老 stash / `.claude/worktrees/agent-*` / feature/sync-check-claims 不動。
> **驗證(`a4c2488702e62b2335601f4861ba07f544532e6b` 實測、isolated scratchpad worktree wt-defer-12-case5-assertion 隔離跑)**:**Pre-flight 唯一性**:git grep -F 兩 marker 全 repo 0-hit(exit 1、確認 EVIL_LABEL / EVIL_SENTINEL 唯一、無 leak);typecheck / lint 綠;`npx vitest run tests/check-mutation-specs.test.ts` **44 passed + 1 skipped**(含改後 case ⑤ pass);`npm test` 全 suite **30 files / 1021 passed + 3 skipped**(其他 case / 其他 test 不受影響);`npm run check:mutation-specs` 綠(12 spec 130 條探針);`npm run check:catalog` 綠(32 controls);目視 1 檔 diff、無 CLAUDE.md 誤 add。
> **審查**:Codex plan review 3 rev(r1 D2 marker observability flaw 修 = evil.json 從 GOOD_SPEC 換 EVIL_SPEC / 加 EVIL_SENTINEL 必然 drift、r2 channel 措辭 stdout → stderr 精確、r3 APPROVE + GO Step 3);Codex Step 4 commit-object 對 Phase 1 tip `a4c2488` **APPROVE**(isolated clean clone、frozen full base/tip、ancestry + diff scope 一次通過、兩 marker 僅在 case ⑤、唯一路徑回 code1 CLI 輸出 stderr、scope 無漏出);Step 5 adversarial-reviewer round 1 **0 CRITICAL、0 INFORMATIONAL、無 finding**(12 項 adversarial check 全 clean:contract correctness / marker uniqueness / short-circuit / assertion order / fixture stability / substring collision / test scope / comment accuracy / PLACEHOLDER collision / silent scope leak / run() channel separation / intact-defense EVIL_SENTINEL 不現形);Step 5 直接收乾。標準車道 CSO fail-closed REQUIRED = 模板 repo 例外(路徑表為空 = 設計、人工判定 = e2e test assertion 改動、no auth / authorization / payment / PII / audit or production logic)。
> **⭐ 教訓**:①**「間接證明缺席」assertion 依賴 fixture 具體形狀**——現行 `not.toContain('對得上')` 是「若外部被讀就會印『對得上』」的間接反證、依賴「fixture 唯一 spec 就是 symlink target」;fixture 加合法 spec 就 false positive assertion fail。**直接證明** = unique marker + 必然 drift + acceptance 路徑必印 marker 的 contract、marker 不現形 ↔ 未成為輸入。②**必然 drift 是 marker 可觀測性的關鍵**——若 evil spec 為「合法且對得上」= status=ok、formatReport 對 ok 只印 rel/探針數不印 label、marker 斷言 false negative(supervisor r1 抓)。用 unique sentinel find(對 target 不存在)強制走 drift 路徑、problems.push 含 label、CLI code=1 走 console.error → stderr。③**主 stderr + 雙通道 defensive** = 精確對齊 CLI code=1 行為 + hedges 未來 CLI text/log 路徑改變(supervisor r2 明列 channel 措辭)。④**adversarial-reviewer 12 項 check 全 clean** = 極窄 scope + contract 精確 + marker uniqueness pre-flight 驗證的組合效果;single test 檔 inline scope 常量、無 module-level 污染、endsSubject-verb agreement 對齊 codebase pattern。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):A. P2#3 defer 剩 3 條(⑬⑭⑮ 逐條 0.5h);B. A3 defer 剩 19 條;C. A2 defer 集合 17 條 INFO;D. P2#2 defer 集合 剩 7 條;E. A1.1 defer 集合 23 條;F. Milestone B1。
> **check:claims 逐條處置**:0 新命中(本 sprint 純 e2e test assertion 改動、無新絕對化宣稱句加入 lib docstring / docs 主張)。
> 📊 成本:CC ~2h / 跨模型 review 4 rounds(plan r1/r2/r3 supervisor + Step 4 supervisor + Step 5 adversarial round 1 0 findings)/ P1 0 個 / P2 0 個 / Step5 獨立發現 0 個(0 CRITICAL / 0 INFORMATIONAL)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、極窄 sprint 單 case 斷言修);Codex gpt-5.6-terra medium(w6:p4)plan 3 rev + Step 4 + Step 5 approve;baseline `730714f7cfd28278c2560c55b341b80e70aecfce`;來源分佈:既有缺陷 1(現行 case ⑤ `not.toContain('對得上')` 脆弱、defer ⑫ 條目登錄時已為既有缺陷)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan 3 rev + CodeGraph ground truth trace / 2 ✅ Codex r3 APPROVE / 3 ✅ isolated worktree(wt-defer-12-case5-assertion)+ pre-flight 唯一性驗證 + Phase 1 atomic e2e commit(`a4c2488`、tests/check-mutation-specs.test.ts +12/-3)/ 4 ✅ Codex Step 4 對 `a4c2488` APPROVE / 4.5 ✅ CSO fail-closed = 模板 repo 例外(路徑表為空 = 設計、人工判定 = e2e test assertion 改動、no auth / authorization / payment / PII / audit or production logic、標準車道)/ 4.6 ✅ 未觸發(無 UI diff)/ 5 ✅ adversarial-reviewer round 1(0 CRITICAL、0 INFORMATIONAL、0 findings、12 項 check 全 clean)/ Phase 2 archive ④ + 加 ⑫ + TODOS ⑫ ✅ + entry-count conservation ✅(pre 18 + 新增 ⑫ = post 19、每 entry 恰 1 次)/ 6-7 待執行(Owner sprint-loop 授權)

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

> 更早的 entries:2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
