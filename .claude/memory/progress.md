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
>   - `.claude/sop/codex-review-scope-note-template.md`:建暫存檔前先跑 `check:codex-env`;`codex exec` 帶 `-c model=$GSTACK_CODEX_MODEL`
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

📅 2026-09-18 ㉘ — **Sprint I(port Team W Sprint P.1):pre-push CI mirror 機器化(opt-in)**

> **緣起**:Team W 下游 Sprint P Step 6 push 撞 CI 紅在 `check:progress-codex` marker 格式,等 CI ~15 min 才發現、修完再等一輪 —— 一個 sprint 累積 30-45 min 純浪費。Owner 拍板「請把這件事情機器化」。SOP Step 6 早明講「push 前跑完整本地 gate」但只靠人記,常漏。Team W Sprint P.1(PR #67)在下游先做完;本 sprint port 到母 repo 讓所有 adopter 受益。
> **shipped 設計**(1 commit):
>   - **`scripts/pre-push-ci-mirror.sh`** 新腳本(對齊 CI workflow 11 checkers:typecheck / lint / doc-refs / doc-size / adoption / catalog / mutation-specs / todos-markers / progress-codex / no-source-terms / vitest;遇紅即停 fail-fast)。**Team W 下游有 sprint-hygiene checker**,母 repo 目前無此 script,本 port 拿掉該 checker(下游 fork 若加此 script 可自行 patch 或 upstream 再補)。
>   - **`scripts/git-hooks/pre-push`** 加第 4 段呼叫 pre-push-ci-mirror.sh(對稱 §3 Codex env gate 的 opt-in 姿態)。
>   - **`package.json`** 加 `check:pre-push` npm script(手動呼叫路徑)。
>   - **`tests/pre-push-ci-mirror.test.ts`** 5 條 sanity:script 存在+可執行 / bash syntax / 未 opt-in → 立即 exit 0(承諾邊界) / package.json binding / hook 有呼叫本 script 段。
>   - **PR-time gate skip 邏輯**:progress-codex 若 `base..HEAD` 無 commit skip(對稱 CI `if: pull_request`)。
> **哲學:opt-in(對稱 §3 Codex env gate)**——harness template「外部工具全 optional」承諾(docs/OVERVIEW.md);不用完整 CI mirror 的 adopter(可能只用部分 checkers、或有自己的本機 gate)跑 setup-hooks 後 push 不該被此 gate 擋。想啟用:`~/.zshrc` 加 `export ENABLE_PRE_PUSH_CI_MIRROR=1`。
> **環境變數**:`ENABLE_PRE_PUSH_CI_MIRROR=1`(opt-in 才跑)/ `PRE_PUSH_SKIP_VITEST=1`(opt-in 後急用跳 vitest)/ `PRE_PUSH_BASE_REF=<ref>`(覆蓋 default base)。
> **本 script 不跑**(CI 專有或過慢):secret scan gitleaks(pre-push hook 檔頭已有)/ dependency audit(需網路)/ mutation:smoke(~10 min)/ baseline-governance / protected-branches-drift(PR event only)。
> **審查總結**:
>   > 無 Codex CLI 環境;降級 Claude /code-review 路徑。
>   > **Step 4 Claude /code-review round 1**(補做,原本被跳):4 findings —— F1(progress marker 說「待跑」但 entry 有收斂 marker、可能誤放行 checker;**本輪就是修**)/ F2(BASE_REF fallback origin/main 對 GitFlow adopter 誤選)/ F3(rev-list 靜默 skip PR-time gate)/ F4(script 缺席+opt-in enabled → fail-open)。**F1-F4 全修**:F1 補做 review round;F2 加 harness.config deliveryBranches[0] fallback + 拿不到 fail-closed;F3 加 `git rev-parse --verify` 前置驗、fail-closed 附教修法訊息;F4 opt-in enabled + script 缺席 → warn(不 fail 但明說)。round 2 未跑(4 條全散文級 + fail-closed 加固,SOP 紀律不消耗確認輪)。
>   > **Step 4.5 CSO gate**:上游 template repo 路徑表刻意空(SOP L237-239 明例),以人工自問代替:diff 是 process infrastructure(shell script + hook + 純函式 test + bookkeeping),無 secret handling / auth / 金流 / PII 域。判定 CSO_NOT_REQUIRED,未觸發高風險車道。
>   > **Step 5 sanity**:opt-in 姿態的 unit test 通過(未 opt-in exit 0 + F3 fail-closed base ref 驗證 + F4 script 缺席 warn 三條斷言全綠)。
> **驗證**:typecheck / lint / vitest 7/7 綠(原 5 + F3/F2 修 test 各 1)/ 跨模型 review 1 rounds、收斂 0 P1。
> **⭐ 教訓**(累積 ⑬):**「CI 有的 checker,本機能跑就本機先跑」**——SOP Step 6 明文但只靠人記、下游 Team W Sprint P 就撞 2 次(git add -A 違紀 + progress-codex marker 格式)。修法:機器化本 script,所有 adopter opt-in 就能省 CI 等待時間;不強加(尊重「外部工具全 optional」承諾)。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):Team W 4 棒 auto-continuous(Sprint Q/R/S)推進;母 repo 端無 defer,可等下 sprint Owner 拍板。
> **check:claims**:未跑(本 sprint 無新宣稱句)
> 📊 成本:CC ~20min / 跨模型 review 1 rounds(local Claude /code-review round 1,無 Codex CLI 費用降級路徑)/ 0 P1 / Step5 獨立發現 0
> 📐 量測(供 EFFORT.md sweep):
>   ① 每輪 model+API effort:Claude /code-review high(claude-opus-4-7 default)
>   ② baseline SHA:`4edfec2`(母 repo main tip = Sprint H merge commit)
>   ③ finding 來源分佈:0(port 過來的 script 下游 Sprint P.1 已 dogfood 過)

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
