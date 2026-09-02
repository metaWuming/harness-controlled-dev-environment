---
title: Progress Archive — 2026-08(2026-08-27 ①)
type: archive
---

# Progress Archive 2026-08

> 從 `.claude/memory/progress.md` 於 2026-08-28 批 7 收尾時歸檔(檔案超 20 KB
> 上限,doc-size CI gate 觸發)。本檔為唯讀歷史 snapshot,不回頭編輯。

---

📅 2026-08-28 ④ — **批 10:TODOS P3 全部收乾(develop-policy 拍板 A + workflow-level env SSOT + shared lib)**

> **緣起**:批 9 (#34) 收尾 defer 進 TODOS P3 的三條 finding。**Owner 拍板本 sprint 全部結束、不再 defer**——Step 4/5 findings conf ≥ 4 一律修進本 sprint、conf ≤ 3 才 skip。三條:A. develop-branch policy 拍板;B. workflow-level `DELIVERY_REFS` 常數機械化;C. `check-todos-markers.ts` 補 `< 1e9` 對稱守。
> **改動**:5 檔 +190/-29 —— `.github/workflows/ci.yml`(workflow-level `env:` 加 DELIVERY_REFS + MARKER_SELF_PR 常數、兩 step 移除 step-level 定義、註解記 D0 拍板 A);`scripts/lib/marker-self-pr.ts`(新、shared lib 單一入口 acknowledgeSelfPr 三守合起來);`scripts/check-no-source-terms.ts`(import lib 替代 inline 三守);`scripts/check-todos-markers.ts`(import lib + 抽 main() 內 selfPr 讀取 + re-export 給既有 test);`tests/check-todos-markers.test.ts`(7 unit test acknowledgeSelfPr + 2 CLI e2e case 守 call site 接線)。TODOS 三條翻 ✅(#35)+ 加「無 pending P3」尾註(批 10 收乾);progress-archive 歸檔批 8;本 entry。
> **審查**:Codex CLI 2 rounds(trend 3→0、round 2 罕見 SHIP)——r1 3 P2(SSOT 不是真單一入口 → 抽 shared lib / CLI 接線 e2e 缺 → 加 disposable-repo harness / TODOS 待翻)、r2 0 SHIP。**安全關** `check:cso` fail-closed(表空)→ 純 workflow 集中 + shared lib 抽出 + test → 模板 repo 例外人工判定**不進高風險車道**(D4);**視覺關**未觸發(D5,無 UI 檔)。**Step 5** adversarial-reviewer fresh 審:0 CRITICAL / 3 INFORMATIONAL,Owner「不再 defer」全收:F1 conf 7(MARKER_SELF_PR 也提到 workflow-level、同 SSOT 論證延伸)、F2 conf 6(中段 import + `_` alias → top-level import + 檔頭 export)、F3 conf 5(引號統一雙引號對齊 check-no-source-terms)。cross-model agreement ≈ 0 再度驗證(codex 抓 shared lib / call site、Step 5 抓 SSOT 論證延伸 / 風格 consistency)。
> **驗證**:typecheck / lint / test 96(56 + 40)/ mutation 探針 3 條(拿 `< 1e9` → boundary case 紅 / 刪 call site → e2e 紅 / F1 revert 前後 gate 綠)/ dogfood 綠 / doc-refs 170 / check:todos 3 個 PR 3 個有 merge 證據。
> **⭐ 教訓**:①**「單一入口」要真的抽 shared lib、不是同檔 export**——批 10 Phase B 起初把 acknowledgeSelfPr 抽在 check-todos-markers.ts 內為 export pure fn(單 script 內部 SSOT),但 codex round 1 抓到「其實另一 script 仍複製同邏輯」——真正的 SSOT 要建 shared lib、兩 script 都 import。同 SSOT 論證要能延伸到所有相同表面(F1 揭示 MARKER_SELF_PR 表達式也符合、跟 DELIVERY_REFS 同時提工作 flow-level)。②**Owner「不再 defer」政策 + 「該做更多」型 defer 兩者不衝突**——批 7 教訓 ① 說「findings 挑理論邊界時 defer」,批 10 Owner 說「不再 defer」；解法:conf ≥ 4 全修、conf ≤ 3 skip(前者是「不 defer 就得修」的實作、後者是「conf 太低本來就不修」的例外)、無「defer TODOS P3」中間層。批 10 實測 findings 都 conf 5-7、全修得動。③**批 5-10 收乾:8 條 P3 交付 = 完整 TODOS P3 backlog 清 0**——無 pending backlog 就進入「新工作要從 Owner 指示 / 健康檢查 / 新 sprint defer 產出」的 fresh cycle。
> **⏭️ 下一棒候選**(hint 非 truth):TODOS P3 backlog 清 0、無 pending 條目。若無新 Owner 指示,建議跑一次 weekly health check / 或 batch 7 Step 5 F5(hook vs checker 第 3 段對齊 e2e)散文級預備繼續。
> **check:claims 逐條處置**:命中 0 處(check:claims dogfood 對本 sprint diff 綠、無新增量詞未 SSOT 錨定)。
> 📊 成本:CC ~2.5h / Codex review 2 rounds + Step5 1 / P1 0 / P2 6 / Step5 獨立發現 3 個(全收)/ 累計 9 findings。
> 📐 量測:主迴圈 claude-opus-4-7 預設 effort / Codex r1-2 non-interactive review medium / adversarial-reviewer default / baseline SHA:`2f351b1814d2bfde5f8cbc4e3492b2dd7498fe31` / 來源分佈:初始 patch 內既有缺陷 3(codex r1×3 全:shared lib / call site / TODOS 待翻)・初始 patch 漏改的外部 consumer 3(Step5 F1 MARKER_SELF_PR 同 SSOT 論證延伸、F2 import 風格、F3 引號)・baseline 後新增/修改引入 0(round 1 fix 不引入新表面)
> **7 步 checklist 狀態**:1 ✅(plan file)/ 2 ✅(D0-D6 全 sensible default;D0 拍板 policy A)/ 3 ✅(2 phase atomic commits + round 1 fix + Step 5 fix + bookkeeping)/ 4 ✅(2 rounds 收乾)/ 4.5 ✅(不進高風險車道)/ 4.6 ✅(未觸發)/ 5 ✅(fresh 審全收)/ 6-7 待執行

📅 2026-08-28 ③ — **批 9:收乾批 8 兩條 TODOS P3 defer(workflow if: gate + F1/F2/F5 informational)**

> **緣起**:批 8 (#33) 收尾 defer 兩條 P3:①Source-term scan 加 `if:` gate 對齊 delivery-branch 白名單(F4);②F1/F2/F5 三條 informational。合計 ~1.5h。
> **改動**:6 檔 +100/-19 —— workflow yml 加 `if:` gate;`check-no-source-terms.ts` loadAllowedPrs 加 `< 1e9` 上限 + selfPrCount 語意改「env 通道 acknowledge 狀態」+ docstring「僅診斷用」contract;`codex-review-scope-note-template.md` 加 archival routing;`CLAUDE.md` Part 4.6 加 archival policy(placeholder-style);tests 加 F1(9999999999)+ boundary(1000000000)+ F2 collision(#42)三 case;`batch-9.md` 新 scope note。TODOS 兩條翻 ✅(#34)+ 加 3 條新 P3。LESSONS 加兩則教訓。
> **審查**:Codex CLI 3 rounds(0→3→2 收斂)+ Step 5 兩輪各 6 findings。r2 3 P2(F1 加 develop 反向漂移 → revert / boundary test / docstring 首句貢獻數矛盾);r3 2 P2(F1 revert 後 GitFlow 假紅 vs abandoned develop 誤放行 pre-existing 兩難 → defer / CLAUDE.md archival importer 洩漏 → placeholder)。**Step 5 fresh** 6 全 INFORMATIONAL、修 F1(行號漂 → 錨到 step name)F2(template.md 對 importer 懸空 pointer)、defer F3-F5、skip F6。cross-model agreement ≈ 0 再度驗證。
> **驗證**:typecheck / lint / test 56 / mutation 探針 3 條命中 / dogfood / doc-refs 163 / check:todos 綠。
> **⭐ 教訓**:①Codex 兩輪對同 pre-existing 問題發抓相反面 = 該做更多型變體、defer 由 Owner 決策方向、跨全部 call site 統一(LESSONS 新教訓)。②GitHub template CLAUDE.md 會被 `Use this template` 複製、放 harness-internal 政策要 placeholder + 導入者可刪(LESSONS 新教訓)。③罕見一輪 codex 過(r1 0 SHIP)不代表沒問題——Step 5 fresh 立刻抓 6 條、其中 F1 conf 6 直接觸發 r2/r3。
> 📊 成本:CC ~3.5h / Codex 3 rounds + Step5 2 / P1 0 / P2 5 / Step5 12(兩輪各 6)/ 累計 17。
> 📐 量測:baseline SHA `931fc20f22c08e4257b78ae89387d9f54bd3f634`。

📅 2026-08-28 ② — **批 8:收乾批 7 兩條 TODOS P3 defer(check-no-source-terms buildDeliveryRefs e2e + MARKER_SELF_PR env 通道)**

> **緣起**:批 7 (#32) 收尾 defer 兩條 P3 進 TODOS.md:①`buildDeliveryRefs` 前三條 fallback 路徑無 e2e 覆蓋(Step 5 F2,confidence 7);②`.github/workflows/ci.yml` Source-term scan 缺 `MARKER_SELF_PR` env(codex R6 P2-2)。兩支同源(check-no-source-terms.ts 的 self-PR 治理面)、合計 ~1.5-3h、一批做審一次比兩次省(批 5 同 pattern 已驗)。起手 git 核實:main 乾淨、TODOS P3 兩條對得上批 7 entry 下一棒候選。**⚠️ D0 修正**:TODOS 措辭寫「buildDeliveryRefs」但該 fn 只在 `check-no-source-terms.ts`(L299-347)、`check-todos-markers.ts` 對應物叫 `buildMergedPrSet`——確認 Task A 目標檔 = `check-no-source-terms.ts`(批 7 就是動這支的 CA 升級 follow-up)。
> **改動**:4 檔 +355/-11 —— `scripts/check-no-source-terms.ts` `loadAllowedPrs` 加 `MARKER_SELF_PR` env 讀取、改回 `{ prs, mergedCount, selfPrCount }` object、docstring 收攏(SSOT);`.github/workflows/ci.yml` Source-term scan step 加 `MARKER_SELF_PR` env、註解指向 checker docstring;`tests/check-no-source-terms.test.ts` `makeRepo` 加 `originRefs`(bare origin + temp-branch push + `setHeadTo`)+ `runChecker` envOverride + baseEnv strip、8 新 e2e case(A-e1..A-e4 + B-e1..B-e4);`.claude/sop/codex-review-scope-note-drafts/batch-8.md`(新目錄 + 首檔,附 non-self-referential 慣例的自省註解)。TODOS 兩條翻 ✅(#33)+ 補 D0 措辭修正 + F4 新 P3 條目;LESSONS 加「引用 SOP 前提前 grep 驗」教訓;本 entry。
> **審查**:Codex CLI 5 rounds 收乾(trend 4→4→1→1→1、明確收斂;round 5 finding 為 self-referential scope note 死循環、屬「該做更多」型、批 7 教訓 ① 觸發收乾)。**安全關** `check:cso` fail-closed(表空)→ 模板 repo 例外人工判定**不進高風險車道**;**視覺關**未觸發(無 UI 檔)。**Step 5** adversarial-reviewer fresh 審:0 CRITICAL / 5 INFORMATIONAL,依規則全 skip;cross-model agreement ≈ 0 再度驗證 SOP L215。
> **驗證**:typecheck / lint / test 53 / mutation 探針 5 條全部命中 / dogfood 綠 / doc-refs 153 / check:todos 綠。
> **⭐ 教訓**:①mutation 探針前先 `git add -A` 保護、mutation 動生產碼、跑 test、`git checkout <file>` 從 index 還原。②Codex pushback「已明列」型理由先 grep 驗(見 LESSONS 新教訓 [2026-08-28])。③scope note 內列 commit SHA 清單會踩 self-referential 死循環;修法:用描述性語言、SHA 清單交給 `git log` 動態拿。④cross-model agreement ≈ 0 是常態。
> 📊 成本:CC ~4h / Codex review 5 rounds + Step5 1 / P1 1 / P2 10 / Step5 5(全 skip/defer)/ 累計 16 findings。
> 📐 量測:baseline SHA `c2a0ec6fb1a2c6a2068b29f24e67a8684bc97542`。

📅 2026-08-28 — **批 7:check-no-source-terms 升上下文感知 checker(前置攔截第 4 次同類踩坑)**

> **緣起**:批 6(#31)一輪 sprint 內三度撞同類「self-PR 引用被去識別化 denylist 誤觸」(fixture / TODOS / marker env),每次都用不同 workaround 繞開;LESSONS L90 記載「再踩第 4 次就該機器化」。本 sprint 前置攔截。
> **改動**:9 檔 —— 新建 `scripts/check-no-source-terms.ts`(三段掃描 + 兩路 grep 架構、pure functions 抽出);刪 `.sh`;`scripts/git-hooks/commit-msg` 註記分層策略;`scripts/deny-terms.txt` L1 標頭;新建 `tests/check-no-source-terms.test.ts`(45 case);`docs/ADOPTION.md` 檔名 rename;`.github/workflows/ci.yml` 改指 npm run + 加 DELIVERY_REFS env;`package.json` script 改指 tsx;`.claude/memory/LESSONS.md` L90 canonical 描述;`TODOS.md` P3 加 F2 / round 6 P2-2 兩條 defer;本 entry。
> **審查**:Codex CLI 6 rounds(21 findings 累計、18 修 + 3 defer)—— r1 4 條(workflow consumer / fixture self-block / allowedPrs 全 body 過寬 / ERE vs JS regex)、r2 6 條(--all 洩未合併分支 / extractor 右邊界不對稱 / test 檔盲區 / stripCommentsAndBlanks 語義漂 / e2e fixture 全 commit / denylist 標頭)、r3 4 條(FULL_EXCLUDES 缺對稱 / workflow env / staged fixture / LESSONS 舊指引)、r4 2 條(DELIVERY_REFS 只列一 ref / extractor 左邊界不對稱)、r5 2 條(stripGitGrepPrefix regex 猜邊界 / CA-in-commit-msg 無測試)、r6 3 條(workflow MARKER_SELF_PR defer / filename 含 sub-path / CA commit-msg strict 測試)。Owner 拍板 r6 P2-2 defer。安全關:`check:cso` fail-closed(表空)→ 套模板 repo 例外人工判定不進高風險車道。視覺關:未觸發。Step 5:adversarial-reviewer fresh 審 —— 0 CRITICAL / 6 INFORMATIONAL,confidence 7-8 修 3(F1 CA 常數 vs denylist 漂移守門、F3 SYNTAX_EXEMPT scan e2e 覆蓋、F4 ADOPTION 移除清單漏 test 檔),confidence 3-4 skip 2(F5 hook 同源不同宿主、F6 cherry-pick 邊界),F2 confidence 7 defer TODOS P3(buildDeliveryRefs fallback 三路無 e2e、修法要新增設 env 的 disposable-repo pattern 較大)。cross-model agreement ≈ 0(Codex 全在 pure fn / 邏輯層,Step 5 全在守門缺口 / e2e 覆蓋盲區 / 外部 consumer 漏改)——**meta 教訓再次驗證**。
> **驗證**:typecheck / lint / test 433(388 baseline + 45 sprint)/ dogfood 三段皆綠(22 allowedPrs) / doc-refs 145 / todos / claims 各輪增量 0 處量詞 / mutation 探針一輪(round 1、手動、改壞 isSelfPrReferenceLine 讓 4 tests 轉紅)。
> **⭐ 教訓**:①**Review round 遞迴陷阱**——批 7 走 6 輪 codex + 1 輪 Step 5,累計 27 findings 才收乾。scope note 有寫「排除 D4 defer」但無法解 root cause 2「每輪 fix 本身是新表面」(SOP L18-23 明講:scope note 不解此);6 輪後 Owner 主動喊停「太多輪 Codex」→ 才用 AskUserQuestion 拍板收乾 + defer。教訓:**5 輪後主動評估收乾**,不要等 Owner 喊停;findings 開始挑理論邊界(檔名含 `:數字:` sub-path、workflow MARKER_SELF_PR)時就是「該做更多」型信號、defer TODOS P3 而非本 sprint 修。②**squash+amend 讓 branch history 乾淨**——round 1/2 fix 期間 dogfood 掃到自己 branch 的中間 commits 舊 blob(未 concat 版 test fixture),用 `git reset --soft main` + 單 commit 消掉 branch 內部歷史。之後 round 3-6 fix 各自單 commit(保留 review 軌跡)。③**cross-model agreement ≈ 0 = 常態**——Codex 抓 pure fn/邏輯層,Step 5 fresh 抓守門缺口/漏改 consumer;軸完全不重疊、兩層都不可省。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):A. F2 buildDeliveryRefs fallback 三路 e2e 覆蓋(TODOS P3);B. Round 6 P2-2 workflow MARKER_SELF_PR env(TODOS P3);C. Step 5 F5 hook vs checker 第 3 段對齊 e2e(散文級預備、若有第 2 次同類漂移再機器化)。
> **check:claims 逐條處置**:0 處(各輪增量與最終 base=main 掃全綠;新增註解量詞在本 entry 內少數位置多屬集合可窮舉、留 A)。
> 📊 成本:CC ~6h / 跨模型 review 6 rounds + Step5 1 / P1 5 個(round 1-2)/ P2 20 個 / Step5 獨立發現 6 個(3 修 3 skip/defer)/ 累計 27 findings。
> 📐 量測(供 `docs/EFFORT.md` sweep;人工填):主迴圈 claude-opus-4-7 預設 effort / Codex r1-6 non-interactive review medium / adversarial-reviewer default / baseline SHA:`c7572f836deb059d5c113724ccc3c088e829cf12` / 來源分佈:初始 patch 內既有缺陷 18・初始 patch 漏改的外部 consumer 4(workflow yml consumer / ADOPTION 檔名 / LESSONS 舊指引 / ADOPTION 缺 test 檔)・baseline 後新增/修改引入 5(round 2 fix P2-3 引入 FULL_EXCLUDES 半修 → round 3 抓;round 5 引入 stripGitGrepPrefix regex → round 6 抓 filename sub-path;round 5 引入 e2e test 未守 CA commit-msg → round 6 抓;各 fix round 引入再修)
> **7 步 checklist 狀態**:1 ✅ / 2 ✅(D1-D8 全 sensible default 通過)/ 3 ✅(3 phase atomic commits + round 1-2 squash + round 3-6 各獨立 fix commit + Step 5 fix commit)/ 4 ✅(6 rounds 收乾 + Owner 拍板 r6 P2-2 defer)/ 4.5 ✅(模板 repo 例外人工判定不進高風險車道)/ 4.6 ✅(未觸發)/ 5 ✅(fresh 審 + 本 entry bookkeeping)/ 6-7 待執行

📅 2026-08-27 ③ — **Harness backsync 批 6:LESSONS 記 self-PR gate 踩坑 + CI workflow delivery-branch 契約**

> **緣起**:批 5(#30)Step 6 連續踩 3 個 self-PR # citation 撞去識別化 denylist 變體(fixture / TODOS 補號 / CI push event 缺 `MARKER_SELF_PR`),Owner 拍板打包收。
> **改動**:3 檔——LESSONS 記三處變體;`.github/workflows/ci.yml`(delivery-branch 白名單:PR event 一律跑 / push 只在 default_branch 或 develop;event filter 涵蓋 main/master/trunk/develop;fetch 用 `default_branch` 動態 + `set-head` + `DELIVERY_REFS` env belt-and-suspenders);`scripts/check-todos-markers.ts`(refs 四條合流:①origin/HEAD ②env DELIVERY_REFS ③fallback origin/develop ④last-resort 本地;`execFileSync + SAFE_REF_RE` 擋 shell/option injection)。
> **審查**:Codex 7 rounds(round 1-6 各一條 P2 行為級——delivery-branch 定義的完整一致性契約被逐輪拆:event filter 上層過濾 / default_branch 硬碼 / DELIVERY_REF_CANDIDATES 沒同步 / 擴充候選反成 legacy 假通過;round 7 收乾)。安全關:`check:cso` fail-closed(表空)+ 人工判定「強化既有守門面」不進高風險車道。視覺關未觸發。Step 5:0 CRITICAL / 8 INFORMATIONAL,修 7(docstring drift、origin/develop 換位重演 = round 6 flaw、shell injection 防護、warning 例子改直覺、workflow env belt-and-suspenders),skip 1(YAML 邊角)。cross-model agreement ≈ 0(Codex 全在 delivery-branch 一致性軸、Step 5 首次抓 shell injection + origin/develop 換位重演 + doc drift × 3)。
> **驗證**:typecheck / lint 綠;15 檔 388 tests;doc-refs 140 引用 0 失效;check:todos 綠(#30 驗 merge);check:no-source-terms 三段綠。
> **⭐ 教訓**:①「加一個 if condition」小改動、實際展開成 delivery-branch 完整一致性契約——round 1-6 拆新面向,教訓:改跨系統契約前先盤「三處/四處都涵蓋了嗎」。②cross-model agreement ≠ correctness meta 教訓再次驗證(Codex 與 Step 5 看的軸完全不重疊)。
> **⏭️ 下一棒候選**:A. `buildMergedPrSet` 補分岐測試(現只覆蓋純函式 checkTodosMarkers);B. workflow yml 邏輯端 e2e test harness;C. `check-no-source-terms.sh` denylist `PR #[0-9]` 升成上下文感知 checker(第 4 次同類誤觸就該機器化)。
> **check:claims 逐條處置**:命中 0 處(本 sprint 全 CI/script 邏輯層,新增行未觸發量詞)。
> 📊 成本:CC ~2h / 跨模型 review 7 rounds + Step5 1 / P1 0 個 / P2 8 個 / Step5 獨立發現 8 個
> 📐 量測:主迴圈 claude-opus-4-7 預設 effort;Codex r1-6 non-interactive review 預設 / baseline SHA:`7ed0d7d` / 來源分佈:初始 patch 內既有 2・漏改外部 consumer 3(三處同步)・baseline 後新增引入 3(round 5 擴充成 round 6 flaw / round 4 動態抓暴露 event filter / Step 5 origin/develop 挪位)
> **7 步 checklist 狀態**:1-5 ✅ / 4.5 ✅(強化既有守門面)/ 4.6 ✅(未觸發)/ Step 6-7 待執行

📅 2026-08-27 ② — **Harness backsync 批 5:TODOS P3 清理(README 風險車道同步 + mutate HEAD 綁定 + bookkeeping allowlist 機器化)**

> **緣起**:上一 sprint(#29 風險車道升級)收尾時 defer 進 TODOS P3 段的 3 支候選一批做——都是 #29 直接 follow-up、範圍小(合計 ~2.5h)、審查一次比審三次省。起手 git 核實:main 乾淨、`.gbrain-source` untracked 不動、#29 entry 標的三支候選 = TODOS 現存的 3 條 P3、hint 對得上 truth、無矛盾。
> **改動**:9 檔 +622/-4 行(合計 8 檔 diff,progress.md 為第 9 檔 bookkeeping)——`README.md`(關卡⑧⑩ 中英同步「CSO_REQUIRED = 高風險車道 = 破壞性探針 + Step 5 worktree 獨立審」,⑦不動);`scripts/mutate.ts`(`formatSummary` 加選填 `headSha` 第 3 參數印綁定 SHA 行、`main()` 開頭抓 `startHead`、收尾 `endHead` 比對、抽 `decideHeadBinding` 純函式 fail-closed);`scripts/check-bookkeeping-commit.ts`(新,純檔名 allowlist:EXACT_ALLOW 收 TODOS/BACKLOG/TODOS-done 兩處 + `.claude/memory/progress.md` 精確 + `progress-archive/*.md` snapshot 排除 README + LESSONS-archive 全排除;`getChangedFiles` 用 `--no-renames -z` 避免 rename 繞過;argv > 1 fail-closed);`.claude/sop/plan-mode-checklist.md`(Step 4/4.5/5/6 各補一行 decision-request 接線;bookkeeping 機器化核對段從 worktree 內部挪到 Step 5 通用位置;敘述同步 script 實作);`.claude/sop/decision-request-template.md`(補「Step 3-6 常見觸發」段);`package.json`(加 `check:bookkeeping` script);`tests/mutate.test.ts`(+`decideHeadBinding` 3 case 單測 + HEAD drift e2e via `--cmd git commit --allow-empty`);`tests/check-bookkeeping-commit.test.ts`(新,純函式 21 case + 4 條 e2e CLI 涵蓋 rename/argv/純 bk/denylist)。
> **審查**:Step 4 Codex CLI review rounds 1-5——r1(HEAD 綁定 P1、rename P1、path bytes P2、argv P2)、r2(allowlist 收窄 P1+P2)、r3(LESSONS-archive 全排除 P2)、r4(call site 沒守 P2×2、補 e2e)、r5(SOP 敘述漂移 P2 散文級,套用完出貨、不再送審)。安全關:`check:cso` fail-closed(表空)→ 模板 repo 例外(路徑表刻意出廠為空、屬導入步驟);人工自問三 phase 皆無 auth / 金流 / 個資 / 權限 / 資產轉移邏輯(README 敘述 / print 摘要 + SOP 註記 / 純路徑判定無執行無網路)→ **不進高風險車道**、無命中域清單也無探針對象。視覺關:未觸發(無 UI 檔)。Step 5:adversarial-reviewer fresh 審——0 CRITICAL / 7 INFORMATIONAL,confidence 6+5 x2 修(F1 SSOT 位置錯:機器化核對埋高風險車道內,標準車道操作者可能漏掉守門;F2 template 段落標題斷 SSOT 雙向鏈),confidence 3-5 x5 依規則 skip(runScript stdout/stderr 分離、archive hidden 檔 escape、merge commit 誤導訊息、SIGINT race μs 級、「此處不重抄」用詞漂移)。cross-model agreement ≈ 0(codex 抓的與 Step5 抓的完全不重疊,再驗證 meta 教訓)。
> **驗證**:typecheck / lint 綠;tests 15 檔 388 passed(新增 34+3+1=38 tests;baseline 348);check:doc-refs 130 引用 0 失效;check:todos 綠;check:no-source-terms 綠;`check:bookkeeping HEAD~1` dogfood 對本 sprint 三個 code commit 判 exit 1(對——含 scripts/tests/SOP),對本 bookkeeping commit 應判 exit 0(收尾驗)。
> **⭐ 教訓**:①**call site 必須另守**——Round 4 兩條 P2 抓到「純函式測了、CLI 接線沒守」→ 刪掉 main() 的一行呼叫測試照樣全綠;修法是加 disposable-repo e2e 測試(pattern 從 mutate.test.ts 的 `makeRepo()` 借鏡)。這正是 SOP 壓輪數紀律 ⑶ L215-218 講的「呼叫點另守」,實測威力。②**allowlist 初版必踩「路徑漂移」**——Round 2 抓到我用「`.claude/memory/**.md` 前綴」寫太寬,實際 canonical `TODOS.md` 在 repo root、`LESSONS-archive/README.md` 是 governance;Round 3 進一步收:`LESSONS-archive` 整目錄同性質治理內容。教訓:allowlist 寫**精確清單** > 寫 pattern,pattern 一定 leaky。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):A. 本 sprint Step 5 skip 的 F3-F7(全 confidence ≤ 5、多屬 v2 補測試工作,若累積誤報再處理);B. `check:bookkeeping` 掛 CI hard gate(目前 advisory-only,累積 3-5 sprint 誤報數據後決定);C. Step 4 5 輪 review 的 finding 來源分佈(baseline 後引入 8 條)如果變成常態,考慮把 Codex CLI review 的 prompt 加「不要重新提之前輪次已修的類型」明示防漂。
> **check:claims 逐條處置**:命中 7 處全留 A——decision-request-template.md L15「窮舉」是**降級標記**(明說「例子,非窮舉」);README.md L46/L177 5 條(「never/只有/唯一/各自都足夠/全面」)是 ⑦ 段既有 SSOT 錨點宣告、被本刀行級改動觸發(#29 sprint 已處置過同批);check-bookkeeping-commit.ts L6「唯一」是引用 SOP L316「本段為唯一正本」的 SSOT 錨點宣告。0 降級 B。(同文貼 PR 描述)
> 📊 成本:CC ~3.5h / 跨模型 review 5 rounds + Step5 1 / P1 3 個 / P2 8 個 / Step5 獨立發現 7 個
> 📐 量測(供 `docs/EFFORT.md` sweep;人工填):每輪 model＋effort:主迴圈 claude-opus-4-7(session 預設 effort);Codex exec r1-5 預設(non-interactive review)/ baseline SHA:1952affa6b3e80f20b8948d59e5cb30ec59db10d(初始 3 phase 完成、review 第一輪前的 HEAD)/ 來源分佈:初始 patch 內既有缺陷 6(r1×4 + r2×2 allowlist 太寬)・初始 patch 漏改的外部 consumer 0・baseline 後新增/修改引入 8(r2 EXACT_ALLOW 引入太窄一個新洞→r3 LESSONS-archive 也不算 → r4 e2e 缺 → r5 SOP 敘述漂移 → Step5 F1 SSOT 位置錯 → Step5 F2 template 標題斷 SSOT + F1 副作用把「機器化核對」段位置改到)
> **7 步 checklist 狀態**:Step 1 ✅ / Step 2 ✅(無真實取捨,D0-D7 全 sensible default 通過)/ Step 3 ✅(3 phase atomic commits、每 phase gate 綠)/ Step 4 ✅(5 輪收乾,r5 散文級不消耗確認輪)/ 4.5 ✅(模板 repo 例外人工判定、不進高風險車道)/ 4.6 ✅(未觸發)/ Step 5 ✅(含本 entry bookkeeping)/ Step 6-7 待執行

📅 2026-08-27 ① — **風險車道升級:高風險車道兩項加強 + DECISION_REQUEST + 待拍板**

> **緣起**:Owner 拿外部「雙 Session + 多 Agent + Project GPT」治理架構圖與本 harness
> 比較,拍板吸收 4 個與單人規模相容的機制(風險分級對照、乾淨環境驗證、待拍板阻塞詞、
> 決策請求格式),全掛條件觸發、標準車道零加重。起手 git 核實:對話第一輪讀到的 SOP
> 是 #28 前舊版(343 行),已核實現版(444 行,含 docs-only 判準與節奏分層)並重校
> 4 項建議——2 項因此改設計(不動 check-cso-trigger 腳本、狀態詞彙縮成一詞)。
> **改動**:8 檔——`.claude/sop/plan-mode-checklist.md`(風險車道對照表;Step 4.5
> fail-closed 區分+模板 repo 例外+高風險兩項加強:mutate 探針 exit 0 gate、SHA 綁定
> 與重跑循環;Step 5 高風險 worktree 獨立審:review-tip 完整 SHA、逐輪重建、bookkeeping
> 例外含時序;Step 3 決策請求指引;Step 6 高風險 CI 修復導回;entry 模板補高風險欄);
> `.claude/sop/decision-request-template.md`(新,四段格式);`.claude/agents/
> adversarial-reviewer.md`(worktree 模式:SHA+乾淨度核對、無 SHA fail-closed);
> `scripts/check-todos-markers.ts`+`TODOS.md`+`tests/`(阻塞詞加「待拍板」+測試);
> `CLAUDE.md`(5.5 review 輪例外、4.5 摘要)、`docs/DEGRADATION.md`、`docs/EFFORT.md` 同步。
> **審查**:Step 4 Codex exec rounds 1-7(累計 P1 x10 / P2 x8,逐輪修到剩 1 P2);
> Codex 額度耗盡(訊息稱 16:48 重置、實測過時仍擋)→ round 8 依 DEGRADATION 降級:
> 內建 /code-review high(8-angle+驗證),10 findings(9 CONFIRMED / 1 PLAUSIBLE)全修。
> 安全關:`check:cso` fail-closed(表空)→ 適用本 sprint 新加的「模板 repo 例外」人工
> 自問 → diff 無安全敏感邏輯(BLOCKER_RE 屬 advisory 分支)、非高風險車道;dogfooding
> 當場抓到 fail-closed 規則對模板 repo 自我死鎖、補例外條款。視覺關:未觸發(無 UI 檔)。
> Step 5:adversarial-reviewer fresh 審——0 CRITICAL / 7 INFORMATIONAL,confidence 5-6
> x4 修(收斂條件字面不可滿足、gitignore 支線漏 commit、5.5 例外涵蓋整類、agent 無
> SHA fail-closed),confidence 3-4 x3 依規則 skip(decision-request 只接線 Step 3、
> spec 批次 exit 語意、CLAUDE.md 摘要漏「人工視同」)。cross-model agreement ≈ 0(再驗證)。
> **驗證**:typecheck / lint 綠;tests 14 檔 348 passed;check:doc-refs 112 引用 0 失效;
> check:todos 綠;check:no-source-terms 綠。
> **⭐ 教訓**:①Codex 額度重置時間訊息不可信,降級路徑第一次實測(見 LESSONS 同日兩條)
> ②新 SOP 規則寫完先拿自己 repo dogfood 一遍——fail-closed 自我死鎖就是這樣抓到的。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):A. README 13 關卡同步風險車道
> (TODOS P3);B. bookkeeping 例外機器化(allowlist 檢查腳本,TODOS P3);C. mutate.ts
> 摘要印 HEAD SHA + decision-request 接線 Step 4-6(TODOS P3)。
> **check:claims 逐條處置**:命中 8 處全留 A——r0 x2(「判準只有一個」=原則 1 單一判準
> 可枚舉;「唯一正本」=docs-only 敘述單一錨點)、r8 x5+carve-out x1(全是本刀刻意建立
> 的 SSOT 錨點宣告,各集合=單一錨點,指標已去重)。0 降級 B。(同文貼 PR 描述)
> 📊 成本:CC ~4h / 跨模型 review 7 rounds + 降級 1 + Step5 1 / P1 12 個 / P2 9 個 /
> Step5 獨立發現 7 個
> 📐 量測(供 `docs/EFFORT.md` sweep;人工填):每輪 model＋effort:主迴圈
> claude-fable-5(session 預設 effort);Codex exec r1-5 medium、r6-7 high;r8 內建
> /code-review high / baseline SHA:42c72265fbc6ae057e877b472379098689580d09 /
> 來源分佈:初始 patch 內既有缺陷 17・初始 patch 漏改的外部 consumer 5(4.5 首彈舊文、
> CLAUDE.md 5.5、EFFORT、DEGRADATION、Step 5 entry 模板)・baseline 後新增/修改引入 7
> (各 fix round 引入再修)
> **7 步 checklist 狀態**:Step 1 ✅(plan file 完整含 impact radius)/ Step 2 ✅
> (無真實取捨,D1-D6 全 sensible default)/ Step 3 ✅(4 phases atomic commits、
> 每 phase gate 綠)/ Step 4 ✅(9 輪收乾,含降級輪)/ 4.5 ✅(模板 repo 例外人工
> 判定)/ 4.6 ✅(未觸發)/ Step 5 ✅(含本 entry bookkeeping)/ Step 6-7 待執行。

---

📅 2026-08-28 ⑤ — **批 11:加 docs/OVERVIEW.md 深度總覽 + README pointer**

> **緣起**:Owner 讀完批 10 收工報告後、看到 outputs/ 產出的深度說明文件(md + 離線 HTML 版含 5 張 inline SVG 流程圖),提議「這份可以擺 GitHub 讓考慮用的 user 有更完整理解」。我建議選項 A(把 md 挪進 docs/OVERVIEW.md、去掉日期、加 SSOT 錨定、README 加 pointer),Owner 拍板 go A。
> **改動**:2 檔 +927 —— `docs/OVERVIEW.md`(從 outputs/ 蒸餾、去日期、加 SSOT 錨定檔頭「若與 CLAUDE.md / SOP checklist 有出入以那兩份為準」、markdown link 改 docs/ 相對路徑);`README.md` 英中兩處「What is this / 這是什麼」段末加 pointer block 指向 OVERVIEW(措辭「評估要不要導入本模板的讀者建議先讀這份」)。**out of scope**(留給下棒 sprint):`.claude/memory/health-history/` 首週產出兩檔仍 untracked,屬 memory 層自然產物、下次 sprint 一起收乾。
> **審查**:docs-only 情境、走簡化 SOP —— 跳 Step 4 codex review(明確 pattern、無新機制)、跳 Step 5 adversarial(Owner 明說「批 10 全部結束」政策延續、conf ≥ 4 一律修 conf ≤ 3 skip、doc-only 屬 skip 帶)。全 gate 綠即進 Step 6。**安全關 4.5** `check:cso` fail-closed(表空)→ 純新增 doc + README 段落、無 auth/金流/個資/權限/資產轉移 → 模板 repo 例外**不進高風險車道**。**視覺關 4.6** 未觸發(無 UI 改動)。
> **驗證**:typecheck / lint / check:doc-refs 239 引用 0 失效(新增 63 條全對得上、check-doc-refs 用 repo-root 相對解析所以 backtick 文字引用 `docs/xxx` 從 docs/OVERVIEW.md 位置仍 resolve 對)/ check:no-source-terms / check:doc-size progress 76% LESSONS 27% / check:todos 4 個 PR 4 個有 merge / check:claims 14 hits 全留 A(見下)。
> **⭐ 教訓**:①**deep doc 定位 = SSOT 摘要不是正本**——避免變成第 4 份 authoritative 文件(CLAUDE.md、SOP checklist、docs/ 個別檔已是 SSOT);OVERVIEW 檔頭明列「若有出入以那兩份為準」+ 定期同步、可能落後最新 sprint 的免責。②**backtick 文字路徑跟 markdown link 語意不同,check-doc-refs 都會抓**——好處是文字引用也能被守門,壞處是 outputs/ 版原文的 `docs/xxx` 全 repo-root 相對格式若碰到 file-relative 解析的 checker 會全爆(本 checker 用 repo-root 所以 work)。③**Owner 拍「不再 defer」政策的自然延伸**是 sprint 大小自我調節——doc-only 該用 docs-only 判準跳 review 輪、不硬套 batch 8-10 那種 conf 判定;Owner 建議、我拍推薦選項 A(不是 B 選項的拆多份)、5 min 完成、體現 sprint 大小應 fit 內容不是 fit SOP。
> **⏭️ 下一棒候選**(hint 非 truth):A. `.claude/memory/health-history/` 首週產出兩檔進 git(小 sprint、順手);B. 跑 `npm run health:weekly` 產第 2 週對照 baseline(累積 3-5 週後看趨勢);C. 若批 11 之後有導入實績、收「導入者 30 分鐘完成」實測數據補強 QUICKSTART。
> **check:claims 逐條處置**:命中 14 處全留 A —— L45「每一次」/ L77「唯一」/ L82「永遠不」/ L130「絕不」/ L222「永遠不 / 幾乎不」/ L379「唯一」/ L526 三處「只有 / 唯一 / 各自都足夠」+ L774「只有」/ 其他 3 條同批 —— 全屬引 SSOT 錨定既有敘述(CLAUDE.md 核心哲學、DEGRADATION.md 明列事實、check:claims 自身量詞範例引用)、非新宣稱、批 5 已處置過同批 pattern(README 那次)。0 降級 B。
> 📊 成本:CC ~0.5h / Codex 0 rounds(docs-only skip)/ Step5 0 輪(同) / P1 0 個 / P2 0 個 / Step5 獨立發現 0 個 / 累計 0 findings。
> 📐 量測:主迴圈 claude-opus-4-7 預設 effort / doc-only 無 code review baseline / 來源分佈 N/A(純新增 doc、非既有面改動)。
> **7 步 checklist 狀態**:1 ✅(plan 直接用對話拍板)/ 2 ✅(Owner「go A」拍板選項)/ 3 ✅(單 phase 一 commit)/ 4 ⏭️ skip(docs-only)/ 4.5 ✅(不進高風險車道)/ 4.6 ✅(未觸發)/ 5 ⏭️ skip(docs-only)/ 6-7 待執行

---

📅 2026-08-28 ⑥ — **批 12:health-history 首週產出兩檔進 git + archive 批 9(順手)**

> **緣起**:Owner 讀批 11 收工報告後說「順手把 health-history 進 git」。批 8-10 sprint 期間跑過的 `npm run health:weekly` 首週 snapshot(2026-W35.md + .json)一直 untracked、本 sprint 收乾。順帶 archive 批 9 到 progress-archive(progress.md 上 sprint 已 96.5%、必須先 archive 才能加本 entry 不超上限)。
> **改動**:5 檔 —— `.claude/memory/health-history/2026-W35.{md,json}` 新加進 git;`.claude/memory/progress.md` 拿掉批 9 全文 + 加本 entry;`.claude/memory/progress-archive/progress-2026-08.md` append 批 9 全文(pattern 對齊批 8/9 sprint 的 archive 動作)。
> **審查**:pure-bookkeeping sprint(Owner「順手」= minimal path)——跳 Step 4 codex / Step 5 adversarial(無 code、無新機制、無守門變化)。**安全關 4.5** `check:cso` fail-closed(表空)→ 純 memory 層檔案 → 模板 repo 例外**不進高風險車道**。**視覺關 4.6** 未觸發。⚠️ **check:bookkeeping HEAD~1** 對 Phase A commit 判 non-bookkeeping(health-history/ 不在 EXACT_ALLOW / ARCHIVE_DIRS)——屬預期、advisory-only 現況不擋 CI(批 5 已定 hard-gate 觀察窗);累積 3-5 sprint 誤報數據後再決定是否擴 allowlist 收 `.claude/memory/health-history/*.{md,json}`。
> **驗證**:typecheck / lint / dogfood 綠;check:doc-refs 綠(全 memory 層無跨檔引用改變);check:doc-size 應綠(archive 批 9 讓 progress.md 從 96.5% 大幅下降)。
> **⭐ 教訓**:①**「順手」sprint 也要走 sprint 紀律**——Owner 說順手 ≠ 跳 progress entry / bookkeeping、只是跳 Step 4/5 review 輪。若跳 entry、未來 audit 這批 health-history 首檔怎麼進 git、只能靠 git blame 猜(不可靠)。②**progress.md 額度警戒**(96.5% → 這 sprint 觸發 archive)——早該在批 10 或批 11 之一 archive,拖到批 12 才順手做。教訓:每 sprint 收尾 check:doc-size 若 >90% 立即順手 archive、不留給下棒。
> **⏭️ 下一棒候選**(hint 非 truth):A. 擴 check-bookkeeping allowlist 收 `.claude/memory/health-history/*`(等 3-5 sprint 誤報數據累積後、避免過早 optimize);B. 跑第 2 週 health:weekly 產 W36 對照 baseline(累積 3-5 週看趨勢);C. TODOS 目前 pending = 0、若無新 Owner 指示、進入 fresh cycle 等健康指標 or 新踩坑觸發。
> **check:claims 逐條處置**:0 處(check:claims dogfood 對本 sprint diff 綠)。
> 📊 成本:CC ~15 min / Codex 0 rounds / Step5 0 輪 / P1 0 個 / P2 0 個 / 累計 0 findings。
> 📐 量測:主迴圈 claude-opus-4-7 預設 effort / bookkeeping-only 無 code baseline。
> **7 步 checklist 狀態**:1 ✅(對話拍板)/ 2 ✅(Owner「順手」拍板)/ 3 ✅(2 phase atomic commits:Phase A health-history + Phase B archive+entry)/ 4 ⏭️ skip(bookkeeping-only)/ 4.5 ✅ / 4.6 ✅(未觸發)/ 5 ⏭️ skip(bookkeeping-only)/ 6-7 待執行

---

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
