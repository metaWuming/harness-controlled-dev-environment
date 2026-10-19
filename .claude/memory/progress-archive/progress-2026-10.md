---
title: Progress Archive — 2026-10
type: archive
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
