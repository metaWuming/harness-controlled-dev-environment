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

> 規則正本在 `.claude/sop/plan-mode-checklist.md`「Progress entry」段。entry 進 feature branch 最後一個
> commit,跟 code 同一個 PR。只寫合併前就知道的事(不寫 PR 號、squash SHA、CI 結果)。
> 驗證某 sprint 是否已進主線:`git fetch origin` 後
> `git log -S '<完整 entry heading>' origin/<delivery-branch> -- .claude/memory/progress.md`。
>
> 標準 / 高風險車道沒有 Codex、改用 Claude 審查時,審查行之前另起一行,行首寫
> `> 降級 Claude:<原因>`(規則見 SOP 同段)。
>
> ⚠️ **未完成 sprint**(暫停、卡外部、交棒)寫 partial entry 並標「⚠️ partial / paused」,
> 流程見 `.claude/sop/context-management.md`。sprint 恢復後在同 branch 收尾時,**就地改寫**那條
> partial entry,不另加一條。

```markdown
📅 YYYY-MM-DD ⓝ — **一句話標題**

> **車道**:<快速|標準|高風險>(判定理由一句)
> **做了什麼**:N 檔,一句話
> **審查**:Codex round N(或 Claude code-review round N),0 P1;殘留問題:無 / ①… ②…
> 📊 成本:review N rounds / P1 X 個 / P2 X 個
> **下一步**(hint 非 truth):…
```

---

<!-- entry 從這裡開始,新的在最上面 -->

📅 2026-10-18 ㉞ — **SOP 精簡成三車道,並試點 mattpocock skills(grill-with-docs / to-tickets)**

> **車道**:高風險(CI gate 放寬屬守門腳本放寬;模板 repo 路徑表刻意為空,以自問判定)
> **做了什麼**:約 40 檔。SOP 606→185 行、CLAUDE.md 276→99 行;CI gate 接受快速車道;OVERVIEW / EFFORT / scope note 封存到 docs/archive/;TODOS 已結案條目搬到 TODOS-done.md;新增 GLOSSARY.md 與 ADR 0001
> **審查**:Codex round 2,0 P1(R1 的 2 P1 + 2 P2 已修);第 2 道 adversarial-reviewer 3 輪(CRITICAL 0 / 1 / 1,都已修);最後全範圍 Codex 0 P1;安全審 1 MEDIUM 已修。殘留問題:① gate 失敗訊息「單行修」與 SOP「單行 rename」用詞不一 ② CTRL-SOP-005 與 DEGRADATION 的 /review 降級寫法不同 ③ decision-request-template 殘留 Step 1-2 / 3-6 舊編號 ④ 自訂禁區沒同步 TRIVIAL_FORBIDDEN_PATTERNS 時 [trivial] 可過 ⑤ 自然寫法「0 CRITICAL」會被 gate 擋(照範本可過)⑥ 歷史檔引用漂移 ⑦ weekly-health docstring 舊格式 ⑧ ADOPTION「167 probes」舊敘述 ⑨ README「cross-model」措辭
> **高風險**:命中域 = 誰能通過 CI 關卡;mutation 探針 6 條全 exit 0(綁 6acfb70);security-reviewer COMPLETE_WITH_FINDINGS(1 MEDIUM 已修)
> **CI 修正**:Dependency audit 因新公布的 source-map-js 漏洞(GHSA-68fv-2mgg-jv7q high,vitest→vite→postcss 傳遞依賴)轉紅 → `npm audit fix` 升 1.2.1 → 1.2.2,只動 lockfile;全套 vitest 綠、探針在新 HEAD 重跑
> 📊 成本:review 7 rounds / P1 4 個 / P2 3 個
> **下一步**(hint 非 truth):本次踩到的 4 個工具坑另開快速車道 PR 寫進 LESSONS;下游專案同步另開任務

---

📅 2026-09-30 ㉝ — **port Team W Sprint CM2:Codex review model 預設改 gpt-6.1-sol、effort 一律 high(需 Codex CLI ≥ 0.159.1)**

> **緣起**:Owner 2026-09-30 指示 Step 4 Codex review 全域改新一代 gpt-6.1-sol、effort high,並確認 Team W 引擎與本母 repo 一致。實測 Codex CLI 0.158.0 以 ChatGPT 帳號登入時新 model 回「not supported」,升級 0.159.2 後正常(官方 changelog 記載 0.159.1 起支援)。
> **改動**(4 檔 + 本 entry):`scripts/check-codex-env.ts` 預設清單只放行 gpt-6.1-sol(說明與錯誤訊息同步);`tests/check-codex-env.test.ts` 改新 model,前一代改列不放行;
> SOP Step 4「Codex model 選擇」段補 effort high 與 CLI 版本、各呼叫路徑帶 `model_reasoning_effort="high"`;scope note 範本 effort medium → high。
> **審查**:**Codex round 1**(gpt-6.1-sol／high,`codex review --base origin/main -c model -c review_model -c model_reasoning_effort`):no actionable findings,收斂。Step 4.5:只動檢查清單與文件,人工判定 CSO_NOT_REQUIRED。Step 5 sanity skip:清單換值 + 對應測試、Codex 已收斂。
> **CI 修正**:Dependency audit 因新公布的 brace-expansion 漏洞(GHSA-q2hr-2g5m-vwhr 等 high,eslint 傳遞依賴)轉紅 → `npm audit fix` 升 5.0.9 → 5.0.12,只動 lockfile;Codex round 1 審的是修正前的 diff,lockfile 未另送審。
> **驗證**:check-codex-env 測試 21 passed;typecheck / lint 綠;npm audit 0 vulnerabilities。
> **⏭️ 下一棒候選**(hint 非 truth):無。
> 📊 成本:CC ~20min / 跨模型 review 1 round / 0 P1 / 0 P2

---

📅 2026-09-25 ㉜ — **pre-push：EXIT trap 不再把成功的 push 改成失敗（下游專案回饋）**

> **緣起**:下游專案在同步本模板時踩到:`set -e` 下 `cleanup_trusted_config` 的 `&&` 串在沒建立 trusted_config 時回 1,EXIT trap 把 `exit 0` 改成 1——沒裝 gitleaks＋`SKIP_GITLEAKS_CHECK=1`、或只刪除 ref 的 push 一律靜默失敗。本機重現 exit=1。
> **改動**(5 檔 + 本 entry):`scripts/git-hooks/pre-push` 函式結尾 `return 0`、`rm` 失敗留警告;新 `tests/pre-push-exit-trap.test.ts`(刪除一般分支 → 0;對照:刪除 main → 1,防有人改成 `exit 0` 變放行);目錄 CTRL-HOOK-003 測試欄與 SKIP 敘述更正;QUICKSTART 未裝 gitleaks 那列更正。
> **審查**:**Codex round 4**(gpt-6-sol／high):R1 2P2(測試依賴 gitleaks 位置、註解漏 `set -e`)→ R2 1P2(測試繼承 mirror 開關)→ R3 0 → Fresh 後 R4 1P2 散文(QUICKSTART),收斂。Fresh 1 輪 1 CRITICAL(缺本 entry)＋7 INFO(對照測試、rm 警告、目錄已修;pre-commit 同形、BASH_ENV、CHANGELOG 接受)。
> **驗證**:新測試修前紅、修後綠;check:catalog 綠。
> 📊 成本:CC ~1h / Codex 4 rounds（2P2 → 1P2 → 0 → 1P2 散文，收斂） / 0 P1 / 4 P2

---

📅 2026-09-23 ㉛ — **LESSONS:新增 CI gate 要先確認 bot 開的 PR 過得了**

> **緣起**:㉚(#106)教訓 ⑮ 只寫在 progress entry,Owner 指示補進 LESSONS.md。
> **改動**(1 檔 + 本 entry):`.claude/memory/LESSONS.md` 新增 2026-09-23 條目——情境(#95 gate 擋 #103 #104)、根因(只列人/AI 繞過路徑,沒列會開 PR 的 bot)、可操作避免法(列 actor 清單、bot 豁免用認證身分 + 檔案範圍、補跑被跳過的測試)。
> **審查**:LESSONS 的 SOP / 守門規則段屬治理文件,依 SOP 不走 docs-only 車道。**Codex round 1**(gpt-6-sol):no actionable findings,收斂。Step 4.5:無程式 / 設定改動,人工判定 CSO_NOT_REQUIRED。Step 5 sanity skip:單檔散文、無 code 消費、Codex 已收斂。
> **驗證**:check:doc-size / check:doc-refs / check:progress-codex 綠。
> **⭐ 發現**:`LESSONS.md` 不在 check-progress-codex-review 的 DOCS 白名單,所以只改 LESSONS 的 PR 也必須附 entry。和 SOP「LESSONS 規則段屬治理」一致,本次不改。
> **⏭️ 下一棒候選**(hint 非 truth):#103 #104 已留言 `@dependabot rebase`,等 CI 綠後由 Owner 合併。
> 📊 成本:CC ~15min / 跨模型 review 1 round / 0 P1 / 0 P2

---

📅 2026-09-23 ㉚ — **CTRL-CI-018 加 dependabot npm 依賴更新 PR 豁免**

> **緣起**:Owner 問 #103(eslint / @types/node)、#104(vitest 4→5)兩個 dependabot PR 要不要處理。核實:兩者 CI 都只卡在 Step 4 Codex Review Evidence Check(step 19,「動了非 docs 檔但沒動 progress.md」),step 20-21(source-term scan、vitest)被跳過。根因是 #95(2026-09-15)導入本 gate 後 dependabot PR 寫不出 progress entry,之後每週都會擋(#94 是 gate 前合的)。本機補跑兩 PR 的 vitest 皆 1407 passed。Owner 選「CI 對 dependabot 豁免」。
> **改動**(5 檔):
>   - `scripts/check-progress-codex-review.ts`:新增 `isDependabotManifestOnlyPr`——env `PR_AUTHOR_LOGIN` = `dependabot[bot]` 且 diff 非空、只動根目錄 `package.json` / `package-lock.json` → exit 0;放在 `!hasProgress` 分支、docs-only 之後、trivial 之前;檔頭補兩個非 docs 例外通道
>   - `.github/workflows/ci.yml`:該 step 以 env 傳 `github.event.pull_request.user.login`(不內插進 run)
>   - `tests/check-progress-codex-review.test.ts`:unit 4 + e2e 5(正例、非 dependabot 作者、未傳 env、多動 src 檔、ci.yml env wiring 內容斷言);`runCli` 預設清掉外部 `PR_AUTHOR_LOGIN`
>   - `scripts/control-catalog.json` + render `docs/CONTROL-CATALOG.md`:bypass 補豁免條件;notes 補誠實邊界 (5)(6)(7)
> **審查**:
>   > **Codex round 1**(gpt-6-sol,`codex review --base origin/main -c model -c review_model`):no actionable findings
>   > **Step 4.5**:模板 repo、表空為設計;人工判定——改動決定「誰可跳過 CI 關卡」屬權限面,判不準從嚴 → 人工視同 CSO_REQUIRED、走高風險車道。security-reviewer:COMPLETE_CLEAN(新例外比既有 [trivial] 通道更窄,無新增過關能力)。mutation 探針 5/5 抓到(`scripts/mutate.ts`,綁 SHA `b387df7`):作者檢查、檔案範圍、空 diff、main 讀 env、ci.yml env key
>   > **Step 5 worktree 獨立審**(adversarial-reviewer,detached worktree @ `3d69d8e`):0 CRITICAL / 11 INFO。實測 #103 #104 真實 head 合進本分支後:dependabot 作者 exit 0、其他作者 exit 2;兩者全套 vitest 與 check:no-source-terms 綠。修 5 條(ci.yml wiring 測試、反例補 stderr 斷言、邊界 (5)(6)(7) 揭露補正、檔頭);不修:temp dir 未清 / fixture 非 merge ref(沿用既有 e2e 慣例)、「diff 非空」在 main 中被 docs-only 分支先吃掉(unit 層防禦、無害)、SOP checklist 未提本通道(catalog 為正本)
>   > **Codex round 2**(gpt-6-sol,含 Step 5 修正):no actionable findings,收斂
> **驗證**:tsc / eslint 綠;check:catalog / check:doc-size / check:doc-refs / check:adoption / check:mutation-specs 綠;本檔 128 passed;全套 vitest 1 次跑出 1 條 `check-doc-refs` G5 逾時(38s > 30s,負載下),單獨重跑 25/25 綠,與本改動無關
> **⭐ 教訓**(累積 ⑮):**「新增 CI gate 時要先問:bot 開的 PR 過得了嗎?」**——#95 導入 progress entry gate 時沒考慮 dependabot,結果之後每個依賴更新 PR 都被擋,而且擋在 vitest 之前,連測試結果都看不到
> **⏭️ 下一棒候選**(hint 非 truth):① 合併後 #103 #104 需 `@dependabot rebase`(re-run 會沿用舊 merge ref 仍紅),兩者都動 lockfile、後合的會再 rebase 一次;② github-actions ecosystem 的 dependabot PR 仍會被擋(動 workflow 屬 super-sensitive),下次出現時再決定處理方式
> **check:claims**:`--base=origin/main` 0 處需處置
> 📊 成本:CC ~1.5h / 跨模型 review 2 rounds / 0 P1 / 0 P2 / Step5 獨立發現 11 INFO(修 5)
> 📐 量測:Codex round 1..2 gpt-6-sol;baseline `b44f655`(main tip);來源分佈 baseline 後引入 5(皆 INFO 揭露 / 測試缺口)

---

📅 2026-09-23 ㉙ — **port Team W Sprint CM:Codex review model 預設改 gpt-6-sol + 各呼叫路徑顯式指定**

> **緣起**:Owner 在 Team W 拍板 Step 4 Codex review 不論走 gstack / `codex review` / `codex exec` 都顯式指定 `gpt-6-sol`,並指示 upstream 到母 repo。
> **shipped**(2 commits):
>   - `scripts/check-codex-env.ts`:預設清單只放行 `gpt-6-sol`(取代 `gpt-5.6-sol` / `gpt-6-astra`);檔頭說明導入者改清單的方法
>   - `tests/check-codex-env.test.ts`:對齊新清單 + 精確斷言 `DEFAULT_ALLOWED_MODELS`
>   - `.claude/sop/plan-mode-checklist.md` Step 4:每條路徑的顯式指定寫法(model 以 `<model>` 泛化,不寫死)+ 守門範圍說明(pre-push opt-in、只驗 env)
>   - `docs/archive/codex-review-scope-note-template.md`:建暫存檔前先跑 `check:codex-env`;`codex exec` 帶 `-c model=$GSTACK_CODEX_MODEL`
> **與 Team W 版差異**:母 repo 無 `reviewer-a.md`(引擎專屬);pre-push 母 repo 版註解本來就不提 model、不動;checklist 保留模板「導入者自選 model」語氣,不寫「一律」
> **審查總結**:
>   > **Codex round 1**(gpt-6-sol,`codex review --base origin/main -c model -c review_model`):1 P2 修(說明寫可加 `--allow-value`,但 pre-push / 範本呼叫都不帶 → 改為「改清單」)
>   > **Codex round 2**(gpt-6-sol):**0 findings,收斂**
>   > **Step 4.5 CSO gate**:模板 repo 路徑表刻意空(fail-closed REQUIRED 為設計),以人工自問代替:diff 是守門清單收窄 + SOP 文件,無 secret / auth / 金流 / PII 域。同一改動在 Team W 已過 `security-review` 0 findings、mutate exit 0。判定 CSO_NOT_REQUIRED
>   > **Step 5 sanity**:同內容在 Team W 已跑 worktree 獨立審(0 CRITICAL / 6 INFO,相關修正已一併 port);母 repo 側 check-codex-env 20/20 綠
> **驗證**:typecheck / lint 綠;check-codex-env 20/20
> **⭐ 教訓**(累積 ⑭):**「port 到模板時,說明要對齊模板的實際呼叫方式」**——Team W 版可寫死 model,模板版改成泛化;順手寫的 `--allow-value` 替代方案在 pre-push / 範本兩個呼叫點都用不到,Codex round 1 抓到
> **⏭️ 下一棒候選**(hint 非 truth):無母 repo 側 defer;Team W 側 F3(CI 不驗 progress 寫的 model)若日後做,可再 upstream
> **check:claims**:命中既有檔 2 處(`tests/pre-push-ci-mirror.test.ts:46`,非本 sprint 改動),本 sprint 新增唯一性斷言有精確測試,保留
> 📊 成本:CC ~20min / 跨模型 review 2 rounds / 0 P1 / 1 P2 / Step5 沿用下游
> 📐 量測:Codex round 1..2 gpt-6-sol;baseline `87146e4`(母 repo main tip);來源分佈 baseline 後引入 1(round 1 P2)

---

<!-- ㉘ Sprint I 已於 port Team W Sprint CM2(2026-09-30 ㉝)進 archive(依 20 KB 額度慣例) -->

---

<!-- ㉗ Sprint H 已於 CTRL-CI-018 dependabot 豁免(2026-09-23 ㉚)進 archive(依 20 KB 額度慣例) -->
---

<!-- ㉖ port Team W Sprint A 已於 Sprint I(2026-09-18 ㉘)進 archive(依 20 KB 額度慣例) -->

---

<!-- ㉓ CLAUDE.md refactor 已於 port Team W Sprint CM(2026-09-23 ㉙)進 archive(依 20 KB 額度慣例) -->
---

<!-- ㉒ port SOP-tune v2 已於本 sprint(loadHarnessConfigOrFail wrapper)進 archive(依 20 KB 額度慣例) -->
<!-- ⑳ governance sprint CI-016 已於 port Team W Sprint CM(2026-09-23 ㉙)進 archive(依 20 KB 額度慣例) -->

> 更早的 entries 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md)
