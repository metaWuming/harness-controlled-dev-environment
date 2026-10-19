---
title: Progress Archive — 2026-10
type: archive
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
