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

📅 2026-09-07 ⑧ — **A3 defer ⑦⑧⑫ YAML parser mini-batch(structured outcome、fail-closed diagnostic)+ ⑥⑪ WONTFIX decision record**

> **緣起**:TODOS.md A3 Step 5 defer 集合 5 條 YAML parser 邊角(⑥/⑦/⑧/⑪/⑫);Codex Sprint 10 拍板 mini-batch。Phase 0 evidence audit(Explore agent + CodeGraph)核實 parser 為 hand-rolled 縮排掃描、無 YAML lib;逐項 5 條表拍板 FIX ⑦/⑧/⑫、WONTFIX ⑥/⑪(hand-rolled parser 無法在不擴 YAML structure 解析下穩定辨識、觸 STOP #1)。frozen full base `63a166234e38b8613201323f281479f27ce90742`;shared local main 233858f + CLAUDE.md M(全程 lock)、1 支 stash 保留、agent-* worktrees 保留、remote 0 動。plan review r1-r5(5 rounds、r5 APPROVE):逐輪校正 outcome API、caller 接線、paired control、WONTFIX 判準與 STOP 引用精確化。
>
> **改動**:3 檔(worktree wt-a3-defer-yaml-mini-batch、frozen tip `74222b0c` + `f8-nit` 校正、full-range +427/-41):`scripts/check-control-catalog.ts` +210/-26(ExtractionOutcome<T> discriminated union、evaluateCatalogSnapshot production-used seam、⑦ duplicate direct name、⑧ single+multi-line flow-style + paired empty control、⑫ normalizeStepName 重寫 + escape table + Object.hasOwn + 空 quoted per-step unsupported + 死碼刪除);`tests/check-control-catalog.e2e.test.ts` +210/-8(13 A3-⑦⑧⑫ 增量 case:核心 6 + wrapper 契約 1 + seam 契約 2 + Step 5 新增 4[multiline flow 2 + empty quoted 2]);`scripts/mutations/control-catalog.json`(M13/M14 find 對齊、intent 保留)。**⑥/⑪ WONTFIX decision record**:現況 silent behavior 保留、不宣稱 fail-closed 或已支援 detection、Owner 若要收需整體重構 parser 或改 YAML lib。
>
> **審查**:Codex plan r1-r5 APPROVE;Step 4 chronology 4 rounds(r1:main TOCTOU fail-open sentinel -1 → r2:false-coverage T-toctou-guard 消 double-read → r3:抽 evaluateCatalogSnapshot seam + 消未捕捉 throw → r4:test wording 精確化 APPROVE);Step 4.5 CSO 標準車道人工 CSO_NOT_REQUIRED(governance / YAML parser、無安全邊界);Step 4.6 無 UI 檔跳過;Step 5 adversarial round 1 → 8 INFO / 0 CRIT(F1 conf 7 multiline flow-style bypass、F2 conf 8 invariant unreachable、F3 conf 8 dead regex、F4 conf 6 empty quoted、F5 conf 6 stepCount 契約、F6 conf 5 duplicate 定位、F7 conf 5 mdReadCount over-couple、F8 conf 4 prototype key);supervisor 分類:F1/F2/F3/F4/F5/F7/F8 FIX、F6 KEEP;Step 5 fix commit(F1 multiline flow paired control + F2/F5 union rework 消 invariant arm + F3 死碼刪 + F4 empty quoted → per-step unsupported + F7 md 去 over-couple + F8 Object.hasOwn);adversarial round 2 → 0 findings + 1 doc nit(順修)。
>
> **驗證**:typecheck / lint 全綠 / vitest tests/check-control-catalog.e2e.test.ts 35/35 pass / npm test 全 suite 31 files 1071 pass / 3 skip(base 1058 + 13 = 1071)/ check:mutation-specs 12 spec / control-catalog 14 探針對齊 / check:catalog 32 controls / check:doc-refs 697 refs 0 失效 全綠。反向探針:base parser + new tests → 完全不擋、restore new parser → 全 pass、mutation-sensitive。
>
> **⭐ 教訓**:①**hand-rolled parser 的 WONTFIX 判準**——需在不擴 YAML structure 解析下能穩定辨識 target 形狀;否則 fail-closed diagnostic 會誤殺合法輸入(⑥ block-scalar tab / ⑪ nested sequence);Owner 若要收要走整體重構或 YAML lib;②**production-used seam 是 test 該鎖的路徑**——先前 T-single-snapshot 只手動測局部 yml、未鎖 main 的 realIo → ymlSnapshot → cachedIo 接線;抽 evaluateCatalogSnapshot(catalog, realIo) production-used seam 才鎖 wiring、test 用 counting realIo 驗 CI 恰讀一次;③**union arm 若 provably unreachable + 無 test 則屬 dead-code**——pure-function 一致性保證第二次呼叫必成功、r3 引入的 invariant arm 不可達;改為 seam 內 throw + main try/catch、刪除 union arm、消 diagnostic silent rot;④**discriminated union 依 findings 有無區分 stepCount 語義**——findings 空 → stepCount:number、findings 有 → stepCount:null(不宣稱 count 完成、避免 consumer 誤讀 0);⑤**paired control 為 legal YAML 邊界的正確做法**——⑧ multiline flow-style detection 需加 paired empty flow `[]` short-circuit、避免誤殺合法 0-item;⑥**Object.hasOwn 是 escape table 低成本 hardening**——避 prototype key 誤命中、未來擴多字元 escape 不會咬繼承屬性。
>
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):
>   - **A**:A3 defer 集合其他項(③/④/⑤/⑨/⑯–㉑ 剩 conf ≤7、逐條 0.5h 或 mini-batch)
>   - **B**:A2 defer 集合(check:adoption 邊角、17 條 conf ≤6)
>   - **C**:P2#3 defer ⑦⑧⑩ 未收條目
>   - 卡外部:無;shared main 233858f + CLAUDE.md M(全程 lock)、1 支 stash 保留、無 remote 動作
>
> **check:claims 逐條處置**(base=63a1662、實測 7 hits;分兩類):
>   - **「唯一」4 hits KEEP**:皆為契約性單一路徑宣稱、可由 code inventory 驗證。TODOS.md「唯一 orchestration seam」= evaluateCatalogSnapshot 是 main 呼叫的單一 seam;scripts/check-control-catalog.ts「push 唯一 ci.yaml.<...> finding」= 每種 problemKind 一 finding;tests 註解「唯一 seam」+「唯一 comparator core」為契約引用。
>   - **「保證」3 hits KEEP(defensive 條件宣稱)**:progress ⑧ 教訓 ③「pure-function 一致性保證第二次呼叫必成功」= JS 純函式定義本身的一致性(同輸入 → 同輸出)、屬 language-level 屬性、非本 sprint 引入的可疑絕對化;scripts/check-control-catalog.ts:341 comment「一致性保證不可注入」= 同上、對 pure-function 屬性的描述;TODOS.md 交付段「保留」為狀態描述、非可疑絕對化。三處皆為 defensive / conditional claim、無需降級。
>
> 📊 成本:CC ~5h(Phase 0 audit + plan r1-r5 + Phase 1 + Step 4 r1-r4 + Step 5 round 1/2 + Phase 2)/ 跨模型 review 11 rounds(plan 5 + Step 4 4 + adversarial 2)/ P1 3 個(TOCTOU sentinel、T-toctou-guard false coverage、未捕捉 throw)/ P2 2 個(test wording accuracy)/ Step 5 獨立發現 8 個(F1-F8、其中 F1 conf 7 multiline flow 為 sprint 頭號目標的覆蓋補洞)。
>
> 📐 量測:主 session Opus 4.7 全程、Codex supervisor gpt-5.6-terra effort high;baseline SHA `63a166234e38b8613201323f281479f27ce90742`;來源分佈(既有缺陷 5・漏改 consumer 0・baseline 後引入 3 P1):既有缺陷 = ⑦/⑧/⑫ 三種 legal/borderline YAML 形狀未 fail-closed、⑥/⑪ 兩種 illegal YAML 形狀 silent misparse(WONTFIX 明列邊界);baseline 後 3 P1 = main TOCTOU sentinel(r1)、false-coverage T-toctou-guard(r2)、未捕捉 throw(r3)。

---

📅 2026-09-06 ⑦ — **A3 defer ② PR-number placeholder token detection(phase-aware、delivery-tip-relative blob multiset)**

> **緣起**:TODOS.md A3 Step 5 defer 集合 ②「canonical placeholder token 佔位 TODOS Markers Check 不抓,靠 Step 6 補」(conf 6);Codex Sprint 9 拍板單條 evidence-first sprint。CodeGraph 已核實現行 `extractPrCitations` regex `#(\d{2,5})\b` 完全不匹配該 placeholder(下劃線非 digit)、`parseTodosMarkers` 空 prs 條目根本不進 completionClaims、checker 對 placeholder 完全盲 → Step 6 若忘補號 CI 不擋、merge 後 orphaned placeholder。frozen full base `5e3348cee9daedd51100f88e9ab8d535ef25f497`;shared local main 233858f + CLAUDE.md M(全程 lock)、1 支 stash 保留、agent-* worktrees 保留、remote 0 動。plan review r1-r5(5 rounds、r5 APPROVE):4 態 fixture(base 已有 placeholder / HEAD 新增 / 新增行已補真 PR # / local 無 self-PR 不啟用)+ invalid MARKER_SELF_PR 經 validator 回 null 不啟用;delivery-tip-relative delta(base = `resolveDeliveryRefsFromRepo(REPO_ROOT).refs[0]`、非 immutable PR base SHA)+ multiset semantics(current[line] - base[line] > 0 為 violation、非 Set 差集)+ blob 邊界(base 中路徑不存在視為空、其他 I/O 失敗明確診斷 exit 2 不當空假綠)。
>
> **改動**:3 檔(worktree wt-a3-defer-2-placeholder-detection、code tip `0395df9e`、full-range +493/-17):`scripts/check-todos-markers.ts` +253/-17(canonical literal + multiset comparator + orchestration wrapper + loader seam + delivery ref 單次解析 + 啟用條件 `acknowledgeSelfPr` !== null);`tests/check-todos-markers.test.ts` +240/-0(14 case:CLI 6 + comparator 3 + wrapper 3 + loader seam 2 含 current-read failure 鎖 fail-closed);`TODOS.md` Phase 2(② strike + 交付段 + 描述行 canonical literal 改中文語義、F1 pre-emptive)。
>
> **審查**:Codex plan r1-r5 APPROVE;Step 4 chronology:187a753 initial review 3 findings(current I/O 契約 + blob 邊界 unit + docstring)→ afec661 rereview 中 F1 stale-revert 為 codex 自撤 false positive、另 stat 校正 + 2 actionable gaps → c29e852 rereview 抓 comparator duplication + 雙 current-read/TOCTOU → d85461e rereview 抓 production-used current-read failure seam / 註解契約 vs 實作 → 5eb4f28 APPROVE。Step 4.5 機器判 CSO_REQUIRED(路徑表空 fail-closed)、人工 CSO_NOT_REQUIRED(governance/test infra);Step 4.6 無 UI 檔跳過;Step 5 adversarial round 1 → 9 INFO / 0 CRIT(F1 conf 8 line-keyed FP TODOS 描述行 / F2 conf 6 delivery ref 雙解析 / F3-F9 conf ≤6)→ supervisor 分類 F1 Phase 2 FIX / F2+F8 Phase 1 FIX / F3-F7+F9 KEEP;Phase 1 fix commit 0395df9 → Step 4 rereview APPROVE;adversarial round 2 → 0 findings。
>
> **驗證**:typecheck / lint 全綠 / vitest tests/check-todos-markers.test.ts 59/59 pass / npm test 全 suite 31 files 1058 passed + 3 skipped(base 1044 + A3-② 14 = 1058)/ check:mutation-specs 12 spec / check:catalog 32 controls / check:doc-refs 697 refs 0 失效 全綠。反向探針手動 evidence:base checker + new tests → 對 canonical placeholder 完全不擋、restore new checker → 全 pass、mutation-sensitive on 新行為。
>
> **⭐ 教訓**:①**line-keyed multiset 對 backtick-inline mention 天生噪聲**——契約「只鎖 canonical literal」技術上符合、但下 sprint 改該行任一字元就誤報;F1 pre-emptive 改描述是低成本必要;②**production-used seam 是「有測試」的實際路徑**——r3 抽 `loadCurrentDocs` 前 main inline readCurrentBlob + inline process.exit 無 seam、error 分支無 deterministic test;註解稱「可 inject」時實作必須存在 production caller、否則自然 dead-code;③**delivery ref 單次解析共用**——merge-evidence + placeholder base 必須看同一 snapshot,不然某窄視窗兩 consumer 看不同 ref;修法用 param 顯式傳遞、不新增 caching layer 或 module-level state;④**F1 pre-emptive fix vs defer 判準**:INFORMATIONAL 只在「有可觀察 delivery-time cost 且低成本」時 pre-empt(若後續修改該行且仍保留 canonical literal、line-keyed comparison 會把新字面視為新增 occurrence)、否則 KEEP;⑤**「evidence-first」sprint 節奏**——CodeGraph 起手核實現行行為缺口(regex 不匹配 → 空 prs → 條目不進 completionClaims)、不從 spec 想像 gap;比先寫測試再改 code 更節省 round;⑥**F2 vs F8 分類差異——輕微冗餘 vs 慣例違反**:F2 delivery ref 雙解析是 correctness-margin(CI 場景視窗極窄、explicit design intent 仍值 FIX)、F8 fixture git add . 是 style 慣例(CLAUDE.md 4.6 明文禁);兩者都值 FIX、但 supervisor 明確標「不動既有 makeRepo 歷史用法」控 scope。
>
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):
>   - **A**:A3 defer 集合其他項(③–⑨、⑪、⑫、⑯–㉑ 逐條 0.5h、7-8 條可打包 mini-batch)
>   - **B**:A2 defer 集合(check:adoption 邊角、17 條 conf ≤6、部分已在 A3 catalog 交付)
>   - **C**:P2#3 defer ⑦⑧⑩ 未收條目(見前 sprint archive)
>   - 卡外部:無;shared main 233858f + CLAUDE.md M(全程 lock)、1 支 stash 保留(此為現況上限)、無 remote 動作
>
> **check:claims 逐條處置**(base=5e3348c、實測 2 hits):TODOS ② 交付段 comparator 單一路徑契約 + runtime delivery-ref 單一來源契約皆可由本 range / code inventory 驗證,KEEP;教訓段原有兩處硬詞已改為條件式敘述;本 disposition 不再重現掃描字面。
>
> 📊 成本:CC ~4h(evidence audit + plan + Phase 1 + 4 rounds Step 4 rereview + Step 5 adversarial round 1/2 + Phase 2 bookkeeping)/ 跨模型 review 5 rounds(plan)+ 4 rounds(Step 4 rereview)+ 2 rounds(adversarial)/ P1 3 個(comparator 雙份、雙讀、current-read failure seam)/ P2 1 個(型別註解 vs 實作)/ Step 5 獨立發現 9 個(F1-F9、含 line-keyed false positive TODOS 描述行的具體 line evidence)。
>
> 📐 量測:主 session Opus 4.7 全程、Codex supervisor gpt-5.6-terra effort high(全程 plan / Step 4 / Step 5 / final full-range review);baseline SHA `5e3348cee9daedd51100f88e9ab8d535ef25f497`;來源分佈(既有缺陷 1・漏改 consumer 0・baseline 後引入 3 P1):既有缺陷 = extractPrCitations regex 對 canonical placeholder 完全不匹配的長期盲點;baseline 後 3 P1 = comparator 雙份(Round r2)、main 雙 current-read TOCTOU 假綠(Round r2)、抽 seam 後 current-read failure test regression(Round r3)。

---


> 更早的 entries:2026-09-06 ⑥ D-② SIGTERM Phase 0、2026-09-06 ⑤ A3 defer ①、2026-09-06 ④ A3 defer ⑬⑭⑮、2026-09-06 ③ D-①、2026-09-06 ② P2#2 defer ⑦、2026-09-06 ① P2#2 defer ⑤、2026-09-05 ⑧ P2#2 defer ⑨、2026-09-05 ⑦ P2#2 defer ③、2026-09-05 ⑥ P3 delivery-refs 移除集合 ①+②、2026-09-05 ⑤ P2#3 defer ⑮、2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
