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

📅 2026-09-06 ⑤ — **A3 defer ①:CI 三處 push execution condition 對齊 template deliveryBranches(develop→main config-derived、docs cross-file drift 一併收、僅調整 push execution condition、其他 workflow logic 不變)**

> **緣起**:TODOS.md A3 Step 5 defer 集合 ①「模板自身 ci.yml 三處 if: 行含 develop、對 template config(deliveryBranches main)不合、A5.ci.if 只在 adopted mode 跑」(conf 6)。#72 A3 defer ⑬⑭⑮ squash 後、Codex supervisor w6:p4 gpt-5.6-terra 拍板 Sprint 7 = A-A3 defer ① 單條、標準車道 CSO_NOT_REQUIRED、review effort 全 high(CI 動)。**A3 ① 是 live defect** 非 stale TODO(Codex 拍板明列 template config `deliveryBranches: ["main"]`、CI 三處 if: 仍含硬編 develop、A5.ci.if 只 adopted mode 執行、template 自身漂移未擋)。frozen full base `4614822d4fb29f2870228ec87064738b63f2a086`(origin/main tip = #72 squash);shared local main 233858f + CLAUDE.md M(全程 lock)。plan review r1-r4(4 rounds、3 rev、r4 APPROVE):r1 3 P1(D9(c) overclaim「非 workflow logic 變化」、D2 comment wording 矛盾、D3 test 位置 + line pin)+ r2 4 residual(Scope wildcard、Phases、驗證 exact command、風險 R2)+ r3 1(車道段 wording overclaim)+ r4 APPROVE。
> **改動**:**Phase 1 atomic + Step 5 review fix + Step 4 rereview 2 fixes、5 檔基礎 + 累積 +56/-22 folded**(final tip `aa0a864f31d2e23a9d608141262d8e58526acfe4`):
> - Phase 1(`88380cc`、+50/-17、2 檔):`.github/workflows/ci.yml` 三處 governance gate step(Fetch delivery refs / TODOS Markers Check / Source-term scan)的 `if:` push execution condition 硬編 `refs/heads/develop` → `refs/heads/main`(對齊 `expectedCiIfLine(cfg.deliveryBranches)` 導出的期望行)+ 三處 adjacent comments 統一為「保留 dynamic default branch + 逐一列出 harness.config.json deliveryBranches」;`tests/ci-step-conditions.test.ts` 加 template-self structural regression 2 case(config-derived、用 production loader `loadHarnessConfig(REPO)`、含 `CI_IF_EXPECTED_COUNT` count guard 擋 vacuous pass + 逐字契約 assert `expectedCiIfLine(cfg.deliveryBranches)`)
> - Step 5 review fix(`95b2f8e`、+9/-8、4 檔):F1 docs 3 檔對齊 CI 新契約(ADOPTION §125 / MIGRATION §68 / CHANGELOG §43 出廠 `deliveryBranches: ["main"]` 語意)+ MIGRATION §15 換交付線描述改「新增 develop」;F3 ci.yml comment #3 加 SSOT 指標(見 `scripts/check-adoption-readiness.ts`)+ 移除舊「批 6 LESSONS L89」anchor
> - Step 4 rereview P1 fix #1(`e921490`、+1/-1):MIGRATION §A.1 步驟 2 去 stale 假設「(若舊 develop 就移除)」
> - Step 4 rereview P1 fix #2(`aa0a864`、+3/-3):ci.yml 三處 comment 同步清單校正實際 step 名「TODOS Markers Check / check-todos-markers / Source-term scan」→「Fetch delivery refs / TODOS Markers Check / Source-term scan」(去重前兩項、加入 Fetch step、對齊實際 governance gates)
>
> **禁區守住**:workflow triggers、job topology、permissions、checkout depth、其他 steps 邏輯、各 step 的 run: 邏輯、`harness.config.json.deliveryBranches` 內容、A5 adopted-mode 行為 / schema / catalog taxonomy、shared main 233858f + CLAUDE.md M / 2 支 stash / 保留 worktrees / remote:全 0 line 動。修法只改三個 governance gate 的 push execution condition + adjacent comments SSOT 對齊 + 新增 config-derived structural regression + 相關 active docs 對齊。
> **驗證(fresh worktree wt-a3-defer-1-ci-if-alignment、frozen tip aa0a864、非 preflight)**:git diff 4614822..aa0a864 --stat 5 檔 +56/-22 folded;typecheck / lint 綠;`npx vitest run tests/ci-step-conditions.test.ts` **6 pass**(base 4 + 2 A3-①);`npm test` 全 suite **31 files / 1044 passed + 3 skipped**(base 4614822 1042 + 2 A3-①);check:catalog CATALOG_OK 32 controls、check:adoption T8 template mode、check:mutation-specs 12 spec、check:doc-refs 678 refs 0 失效 全綠。**反向探針**(base ci.yml + new tests):逐字契約 case 轉紅(3 個 if 行仍是 develop、`expectedCiIfLine(['main'])` 產生 main clause、不等)、count guard case 兩版皆過(3 行仍存在);restore new ci.yml → 6/6 pass、mutation-sensitive。
> **審查**:Codex plan review r1-r4(4 rounds、3 revision、r4 APPROVE);Codex Step 4 對 initial commit `4ca50dd` NEEDS-REVISION 2 P(subject overclaim「非 workflow logic 變化」+ test 未用 production loader `loadHarnessConfig`)→ soft-reset squash 為 `969441f`(subject 校正、但 test loader 修改未進 commit blob——soft-reset 保留 stale index、working tree 改動未 re-add)→ Codex r2 抓到 test blob 仍 stale → 再 soft-reset + `git add` 明列兩檔 + commit `88380cc` 兩 finding 皆修 → Codex r3 APPROVE。Step 4 rereview 檢查 Step 5 review-fix `95b2f8e` r1 NEEDS-REVISION 2 P1(MIGRATION 步驟 2 stale + comment 三處清單誤 step 名)→ 修為 `e921490` + `aa0a864` r3 APPROVE。Step 4.5 CSO 標準車道人工 CSO_NOT_REQUIRED(CI governance / conformance、非安全繞過、無 auth/authorization/payment/PII/production trust-boundary 放寬)。Step 4.6 未觸發(無 UI diff)。Step 5 adversarial round 1 **0 CRITICAL / 4 INFORMATIONAL**(F1 conf 6 docs cross-file drift ADOPTION/MIGRATION/CHANGELOG、F2 conf 5 TODOS ① 描述句 + L79 段未同步、F3 conf 4 comment #3 SSOT 不對稱、F4 conf 3 extractCiIfLines prefix open-ended);supervisor 分類:**F1 MINOR/FIX**(pre-existing 但屬 active operational guidance、必須原子對齊 CI 新契約、既有 P3 defer ② 寫「與 ① 一起」而 P3 runbook ① 已交付、不能繼續 defer 保留錯誤 current guidance)、**F3 INFO/FIX**(comment #3 對齊 #1/#2 SSOT)、**F2 INFO/FIX Phase 2 bookkeeping**、**F4 INFO/KEEP 不 defer**(prefix 未來耦合風險、非本 sprint 觸發);round 2 rereview 0 findings(F1 zero、F3 三處 SSOT/同步清單/語意一致、MIGRATION A.1 clean、F2 留待 Phase 2、F4 未夾帶、scope 恰 5 檔)。
> **⭐ 教訓**:①**docs cross-file drift 屬 active operational guidance 必須原子對齊 code contract**——F1 起初判 KEEP(pre-existing 已在 defer ② 登錄)、supervisor 分類 MINOR/FIX(defer ② 寫「與 ① 一起」而 P3 runbook ① 已交付、不能繼續 defer 保留錯誤 current guidance);決策關鍵在「文件是給導入者的操作指引嗎」而非「pre-existing 或新增」。②**CI comment 統一 wording 屬 SSOT 校正 pattern**——三處 comment 對齊 config-derived 契約 + SSOT 指標(見 `scripts/check-adoption-readiness.ts`)+ 同步紀律清單校正實際 step 名(而非誤混 script 名)。③**「step 名同步清單」需引用實際 step name**——初版寫「TODOS Markers Check / check-todos-markers / Source-term scan」誤將 script 名混入、實際 3 個 governance step 是 Fetch delivery refs / TODOS Markers Check / Source-term scan。④**template-self structural regression 從 config 推導**(用 production loader `loadHarnessConfig(REPO)`)避免寫死分支名脆化;plan 明列「不可只寫死『不含 develop』」、需 config-derived。⑤**count guard 擋 vacuous pass**:`extractCiIfLines(yml).length === CI_IF_EXPECTED_COUNT` assert 恰等再進逐字契約檢查、避免空陣列 / 少行時逐字檢查空跑通過。⑥**subject overclaim 需誠實承認**——初版 subject「非 workflow logic 變化」被 Codex Step 4 抓 P1、實際 `if:` 就是 step execution logic;修為「三處 push execution condition 對齊 template deliveryBranches」誠實描述改變面。⑦**soft-reset 後需重新 git add**——soft-reset 保留 index、若在 reset 前有 working tree 改動未 stage、reset 後 commit 會用舊 index blob;Sprint 7 踩過 1 次、Codex Step 4 rereview r1 抓到 test blob 未同步。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A. A3 Step 5 defer 集合 剩 15 條 INFO conf ≤6(已扣 ①⑩⑬⑭⑮);B. A2 Step 5 defer 集合 17 條 INFO conf ≤6;C. A1.1 defer 集合 23 條 conf ≤7 doc governance;D. 單條 mutate.ts SIGTERM(Codex 認定 stale TODO、需另核實交付來源);E. Milestone B1(新開)。
> **check:claims 逐條處置**:2 命中(base=4614822):(a) TODOS.md L79「刻意保留(A3 defer ① 收後校正)」段中「唯一偵測器」wording——pre-existing base 敘述、本 sprint 只擴充 A3 收後校正備註、KEEP;(b) docs/MIGRATION.md L15「換交付線」段中「唯一」wording——pre-existing base 敘述、本 sprint 只調整「新增 develop」語意、KEEP。0 個 actionable 新絕對化宣稱句;archive move byte-for-byte 非本 claims gate 命中範疇。
> 📊 成本:CC ~2h / 跨模型 review 13 rounds(plan review r1-r4 4 rounds + Codex Step 4 initial x3(4ca50dd NEEDS-REVISION → 969441f NEEDS-REVISION → 88380cc APPROVE)+ Step 4 post-adversarial rereview x3(95b2f8e NEEDS-REVISION → e921490 NEEDS-REVISION → aa0a864 APPROVE)+ adversarial round 1(4 INFO)+ supervisor 分類 x1 + adversarial round 2(0 findings))/ Step 4 P actionable findings 4 個(4ca50dd subject overclaim + test loader → 969441f 修 subject 未修 blob → 88380cc 收兩者;95b2f8e MIGRATION 步驟 2 stale → e921490;e921490 comment 三處清單誤 step 名 → aa0a864 收)/ Step 5 獨立發現 4 個(round 1 4 INFO、supervisor 3 FIX + 1 KEEP、round 2 0 actionable)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、CI conformance sprint);Codex gpt-5.6-terra high(全程 CI 動 review effort 全 high)plan r1-r4 + Step 4 x3 (NEEDS-REVISION → fix chain) + Step 4 rereview + adversarial round 1 x1 + supervisor 分類 x1 + adversarial round 2 x1 + frozen full-range final(Step 6 前);baseline SHA `4614822d4fb29f2870228ec87064738b63f2a086`;來源分佈:既有缺陷 4(ci.yml 三處 if 硬編 develop + docs 三處出廠 [main, develop] drift、A3 Step 5 defer ① 條目登錄時已存在)・漏改 consumer 0(F1 pre-existing docs 一併收)・baseline 後引入 2(subject overclaim + test loader wrong,Step 4 r1 抓、fix chain 收)
> **7 步 checklist**:1 ✅ plan review r1-r4(4 rounds、3 rev、r4 APPROVE)/ 2 ✅ Codex r4 APPROVE + GO Step 3 / 3 ✅ fresh worktree wt-a3-defer-1-ci-if-alignment + npm ci + Phase 1 atomic 2 檔 initial commit(4ca50dd)+ soft-reset squash 修 subject 與 loader(88380cc)+ Step 5 review fix(95b2f8e)+ Step 4 rereview P1 fixes(e921490 + aa0a864)/ 4 ✅ Codex Step 4 initial x3(4ca50dd NEEDS-REVISION → 969441f NEEDS-REVISION(soft-reset 未 re-add、blob stale)→ 88380cc APPROVE(soft-reset + git add + commit 收))+ Step 4 post-adversarial rereview x3(95b2f8e NEEDS-REVISION MIGRATION 步驟 2 → e921490 NEEDS-REVISION comment 三處清單誤 step 名 → aa0a864 APPROVE)/ 4.5 ✅ CSO 標準車道人工 CSO_NOT_REQUIRED / 4.6 ✅ 未觸發(無 UI diff)/ 5 ✅ adversarial round 1(4 INFO)+ supervisor 分類 3 FIX + 1 KEEP + round 2 rereview(0 actionable) / Phase 2 加 ⑤ + archive ④ 至 progress-2026-09 + TODOS ① ✅ + P2#2 defer ⑨「刻意保留」段 A3 defer ① 收後校正 + pull request 引用位待 Step 6 補號 + doc-size D8 4 段 gate + entry-count conservation:base archive 28 + current 1(④)= pre 29;新增 ⑤ 草稿後 archive 28 + current 2(④、⑤)= 30;final archive 29(搬入 ④)+ current 1(⑤)= post 30、每 entry 恰 1 次 / 6-7 待執行(Owner sprint-loop 授權)

> 更早的 entries:2026-09-06 ④ A3 defer ⑬⑭⑮、2026-09-06 ③ D-①、2026-09-06 ② P2#2 defer ⑦、2026-09-06 ① P2#2 defer ⑤、2026-09-05 ⑧ P2#2 defer ⑨、2026-09-05 ⑦ P2#2 defer ③、2026-09-05 ⑥ P3 delivery-refs 移除集合 ①+②、2026-09-05 ⑤ P2#3 defer ⑮、2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
