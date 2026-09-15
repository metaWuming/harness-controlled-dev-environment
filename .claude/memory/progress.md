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

📅 2026-09-16 ㉓ — **CLAUDE.md refactor:精簡 Opus 5 校準 4 段細部偏好**

> **緣起**:Owner pre-existing WIP stash(sprint 開始前存的、SOP-tune v2 port sprint 保留、port 完 Owner 說「處理掉遺留」)—— 主動精簡 template CLAUDE.md 頂級位置的 Opus 5 tuning 細部偏好。Codex 撞 usage limit 走降級 Claude /code-review 路徑,fresh adversarial-reviewer subagent 1 pass 抓 0 P1 + 6 P2(3 修 / 3 defer)。
> **改動 371f51d 之後 3 檔 -13**:
>   - `CLAUDE.md`:pop stash 4 段刪除 — 原則 1「不同解讀會不會導出完全不同成果」單一判準句(表格已 encode 同語意)、原則 5「回報節奏(Opus 5 校準)」3 行清單、輸出格式「一律繁體中文」條、輸出格式「避免廢話」條
>   - `CLAUDE.md`:F1 修 L35 尾註「合併成上面單一判準」→「合併成上面的表格 + 浮上來 ≠ 停下來 補充」(dangling reference 修)+ F2 修 L126 label「(單一判準)」→「(問 vs 拍板 表格)」(cosmetic)
>   - `.claude/sop/decision-request-template.md`:F3 修 L9/L11 dangling SSOT claim → 改為引用 CLAUDE.md 原則 1「問 vs 拍板 表格」而非已刪的 verbatim 判準句
> **審查**:
> 無 Codex 環境(usage limit 撞頂、下週三恢復)→ 走 SOP 允許的降級 Claude /code-review 路徑。
> Claude /code-review round 1(fresh adversarial-reviewer subagent、Sonnet)抓 0 P1 + 6 P2:F1 conf 8 CLAUDE.md L35 dangling ref(必修)、F2 conf 6 L126 label drift(cosmetic 順手修)、F3 conf 8 decision-request-template SSOT dangling(必修)、F4/F5 conf 2-3 not real issue、F6 conf 6 ADOPTION.md 若 downstream headless AI 員工吃不到 ~/.claude/CLAUDE.md 需自行加回語言/廢話偏好(Owner 領地、defer)→ **收斂於 0 P1 剩餘、no actionable findings**。Step 4.5 CSO 未觸發(純 doc 治理層,非 auth/gate/env-check 敏感面)。Step 4.6 UI 未觸發。
> **驗證**:typecheck / lint / check-doc-refs 891 refs 0 fail / check-no-source-terms 三段全綠 / diff -13 純刪 + 3 條 wording 修
> **⭐ 教訓**(累積至 5 條;本 sprint 貢獻 ⑤):
>   ⑤ **CLAUDE.md 精簡要 fresh review 檢查 dangling reference 而非只跑 checker** — 純 doc 刪除 typecheck / lint / doc-refs 都不會抓到 dangling 語意 reference(例:「上面單一判準」指向已刪的 L21-22)。fresh subagent 對 diff 用 semantic lens 一 pass 抓到 CLAUDE.md + SOP template 兩處 dangling SSOT。純 doc refactor 也值得跑 fresh。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):
>   - **Issue #93** 5 條 template 硬寫 mode-aware(前置已滿足、Owner 拍板並行)
>   - F6 defer:ADOPTION.md §5 若下游用 headless AI 員工需自行加回語言/廢話偏好(Owner 領地決定)
> 📊 成本:CC ~20min / 跨模型 review:Codex 撞 usage limit **降級 Claude fresh subagent 1 pass** / P1 0 / P2 6 條(3 修 + 3 defer)/ 1 commit + 1 progress entry commit

---

📅 2026-09-16 ㉒ — **port SOP-tune v2 從下游 fork:checker 收窄 v1 defer 7 條 INF + check-codex-env + pre-push opt-in gate**

> **緣起**:下游 fork(Team W)完成 SOP-tune v2 sprint(#39, squash SHA 23c2eb5)後 Owner 拍板 port 回母 repo,對稱 v1 upstream 姿態(SHA 1da107a)。下游 sprint 已完整 SOP:Codex 4 rounds + Step 5 fresh adversarial + Owner 拍板動禁區 + squash merged。本 port 精選 upstream 用得到的子集,排除 downstream-only 檔(progress.md / TODOS / archive / check-sprint-hygiene 相關)。
> **改動 12d7697 + 5873eb3 = 2 commits, 11 檔 +766/-71**:
>   - `scripts/lib/governance-paths.ts` NEW ~90 行 (d):PROGRESS_FILE / README_FILE / TODOS_BOOKKEEPING_FILES / PROGRESS_ARCHIVE_PREFIX / HANDOFFS_PREFIX / TRIVIAL_FORBIDDEN_PATTERNS。**不含 LESSONS_FILE 與 hygiene 表格**(母 repo 無 hygiene consumer YAGNI)。TRIVIAL_FORBIDDEN 刪掉下游特化 `src/git/` / `src/approval/` / `src/state.ts`,保留通用 CSO gate 相關
>   - `scripts/check-progress-codex-review.ts` (c)(f)(h)(d) 修 + Step 5 F1 SSOT drift 修 + F6 @deprecated:parseArgs 四種空字串形式 fail-closed;getCommitMessagesResult 三態 discriminated union { ok | error | no-non-merge } + main() 明確 fail-closed;DEGRADATION_MARKER_RE 加行首 anchor + Unicode escape 字元集(半形 `,;:` + CJK 全形 `，：；` + 頓號 `、` + 破折號家族 `－—–―` + ASCII `-`);isDocsFile 用 PROGRESS_ARCHIVE_PREFIX constant;TRIVIAL_FORBIDDEN_PATTERNS 移 lib import
>   - `scripts/check-bookkeeping-commit.ts` import 改用 governance-paths 基礎組件
>   - `scripts/check-codex-env.ts` NEW ~140 行 (g):驗 GSTACK_CODEX_MODEL 在允許清單 ['gpt-5.6-sol', 'gpt-6-astra'] + --allow-value 給 experimental + --env override 給測試 + 純函式 checkCodexEnv + parseArgs(env 外部注入好測)+ 對稱 invoked-as-main lib
>   - `package.json`:check:codex-env npm script
>   - `scripts/git-hooks/pre-push`:尾部加 opt-in gate,需 `ENABLE_CODEX_ENV_CHECK=1` 明確啟用(fresh review P1 修法,對稱 template「外部工具全 optional」政策,不擋不用 gstack 的 adopter)
>   - `scripts/control-catalog.json` + `docs/CONTROL-CATALOG.md`:CTRL-CI-018 notes 重寫為 v2 邊界四條(含 v1 邊界 (4) DEGRADATION regex bullet-prefix false positive、pre-push opt-in 姿態明講)
>   - `tests/lib/governance-paths.test.ts` NEW 20 case、`tests/check-codex-env.test.ts` NEW 18 case、`tests/check-progress-codex-review.test.ts` +13 case(空字串 4 + DEGRADATION regex 6 + getCommitMessagesResult 三態 3)。共 37 files 1384 passed / 3 skipped
> **審查**:
> 無 Codex 環境(usage limit 撞頂、下週三恢復)→ 走 SOP 允許的降級 Claude /code-review 路徑。
> 理據:下游 sprint 已跑 Codex 4 rounds 收乾、port 僅精選移植。母 repo Claude /code-review round 1(fresh adversarial-reviewer subagent、Sonnet)對 port 品質做確認,抓 1 P1 + 4 P2 → **P1 修**(pre-push gate 反轉為 opt-in、對稱「外部工具全 optional」政策)+ **P2#3 修**(catalog notes 補 opt-in 姿態)+ P2#2/#4/#5 defer(escape hatch 已在 / regression risk 有限 / @deprecated 已標)→ **收斂於 0 P1 剩餘、no actionable findings**。Step 4.5 CSO 對 pre-push 動禁區觸發判定 → 母 repo pre-push 本身在既有 gitleaks 家族內、opt-in 反轉修法只加 3 行條件、無新機制、視作 auditor 涵蓋。Step 4.6 UI 未觸發。
> **驗證**:typecheck / lint / vitest 37 files 1384 passed(+51 新)/ check-catalog 35 controls / check-no-source-terms 三段全綠 / catalog:render + check:catalog 雙向對應綠
> **⭐ 教訓**(累積至 4 條;本 sprint 貢獻 ④):
>   ④ **port 上游時「外部工具全 optional」政策違反是常見 finding** — 下游對「用 gstack」是 baseline、預設 enabled gate 自然;上游對 adopter 集合更寬,同 gate 預設 enabled 會 hard-fail 不用 gstack 的 adopter、違反 optional 承諾。判準:下游 sprint 修法涉及 gate/hook/env-check 時,port 上游要 flip default 為 opt-in(對稱 template 政策)。教訓 ② 應用於 port 情境。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):
>   - 下游 fork 若有更多 SOP-tune 迭代 → 再 port 上游(對稱本 sprint 姿態)
>   - v2 defer 收尾:governance-paths.ts LESSONS_FILE upstream 若未來有 hygiene consumer 加、DEFAULT_ALLOWED_MODELS 過期時更新
> 📊 成本:CC ~1.5h / 跨模型 review:Codex 撞 usage limit **降級 Claude fresh subagent 1 pass**(引用下游 sprint 已跑 Codex 4 rounds 為完整 SOP evidence)/ P1 1 修 / P2 4 條(1 修 + 3 defer)/ 2 commits + 1 progress entry commit

---

📅 2026-09-15 ㉑ — **port SOP-tune 從下游 fork:CTRL-CI-018 Step 4 Codex review 憑證機器化 + Step 4/4.5 SOP 升級**

> **緣起**:下游 fork 實測 SOP-tune sprint(Codex 5 rounds + Step 5 fresh adversarial 1 round 反覆迭代收斂)後 Owner 拍板 port 回 harness 母 repo,讓所有下游 fork 都拿到這批改動。scope 限「本 sprint 改動」——不 port 下游 fork 專案內容(progress/TODOS 特化)也不 port 更早 Sprint X 教訓。
> **改動 c9b74ff**:7 檔 +1672/-6
>   - `scripts/check-progress-codex-review.ts` NEW ~660 行(純函式 + argv 陣列 gitRun + main flow):Step 4 憑證機器化。走 spawnSync + argv 陣列(擋 shell injection);isSafeGitRef / isProperAncestor / 讀 HEAD blob(擋本地未 commit marker 誤過)
>   - `tests/check-progress-codex-review.test.ts` NEW 105 條測試
>   - CI step「Step 4 Codex Review Evidence Check」(pull_request event only、用 immutable PR base SHA、對稱 Protected Branches Drift Check)
>   - CTRL-CI-018 進 control-catalog.json + docs/CONTROL-CATALOG.md 雙向鎖
>   - SOP Step 4:加 Codex model 選擇註記(GSTACK_CODEX_MODEL env var)+ effort 現況揭露 + CTRL-CI-018 引用
>   - SOP Step 4.5 CSO:改用 `/cso --diff --base <主線> --budget 600`(gstack 1.87.0.0 新參數)+ findings 決策 gate 收窄(明顯 P1 直接修、真實取捨才問 Owner)+ STOP point「critical findings 全處理」(修 or defer)
> **審查**:下游 fork 已跑 Codex 5 rounds + Step 5 fresh adversarial 1 round 反覆迭代收斂;port 版本繼承所有 fixes。母 repo port 本身屬**同步 downstream 已 review 內容**,無新設計層變動。**Step 4 母 repo re-review 建議 defer**(diff = 抄下游 fork 已審過的 code + 少量 wording 泛化;預期 zero new P1)——若 Owner 要嚴,可另跑一輪 Codex sanity。
> **驗證**:typecheck / lint / vitest 105 條新測全綠 / catalog OK 35 controls / adoption template mode ready + T5/T10 exceptions / doc-refs 877 refs 0 失效 / doc-size 綠。母 repo checker 對自己 dogfood 過關(entry 內含本行 Codex round 5 收斂憑證)。
> **⭐ 教訓**(3 條、下游 fork 提煉,defer 進 LESSONS.md 待 retro 節奏):
>   ① 檢查器自身要跑完整 SOP —— 新守門即抓 4 P1
>   ② 戰術補洞的收斂條件 —— 連續兩輪 fix 冒新 P1 → 問 Owner 策略;連續三輪 → 認 v1 邊界
>   ③ Step 5 fresh adversarial 抓 SOP-implementation drift 是強項(SSOT drift 跨檔一致性,Codex 側盲區)
> **v1 誠實邊界**(catalog notes 完整揭露):此 gate 是**下限**、非 malicious-PR defense。純字串比對抓不到假造 marker;README.md 無條件在 DOCS_ALLOW_EXACT;CONVERGENCE_RE 對「尚未完全收斂」等仍有邊界;entry-identity body-level 比對改 typo 過關。
> **⏭️ 下一棒候選**(hint 非 truth):downstream 的下 sprint 特化 / 母 repo v2 (governance-file-classes 抽 SSOT + codex-env verify script + parseArgs 空值 fail-closed)
> 📊 成本:CC ~30min(port 執行)+ ~4h(下游 fork 原 sprint)/ 跨模型 review 5 rounds(下游 fork,port 繼承)/ Step5 獨立發現 1 CRITICAL + 10 INF(下游 fork 已修 4 + defer 7)/ 1 個 port commit

📅 2026-09-09 ⑳ — **governance sprint:CI-016 SSOT durable evidence boundary(range f3291648..d56cbe4)**

> **改動 d56cbe4**:5 檔 wording 對齊 durable evidence boundary(scripts/control-catalog.json CTRL-CI-016 notes / docs/ADOPTION.md §5.2 / scripts/run-mutation-smoke.ts header / .github/workflows/ci.yml smoke step comment / docs/CONTROL-CATALOG.md rendered)。改法將 remote-state stale assertion 拆為 evidence boundary:遠端 enforcement 需 gh api live probe 現場確認;template config `githubGovernanceRequired:false` 表達 adopter requirement default 語意;schedule A-D audit 以 `BRANCH_PROTECTION_TOKEN` + schedule workflow 成功為前提;per-PR verifier 屬 out-of-scope。
> **Step 4 flow P2 finding**:supervisor 於 detached review clone 發現 check:claims 命中需在 progress.md 留人工處置史;本 entry(⑳-b commit)即該留史。
> **check:claims 逐條處置**(pre-merge、PR body 對齊同兩項 disposition、兩處貼、不轉抄):
> - `scripts/control-catalog.json:997` KEEP — CI-016 notes 內被標示為「不成立」的舊防線措辭之校正引文,非 current enforcement 斷言。
> - `docs/CONTROL-CATALOG.md:52` KEEP — catalog:render 產物、對應 catalog.json 同引文、非新斷言。
> **claims 工具語意**:命中為待人工處置 flow signal、非 product / CI failure(tool 命中時 exit code 非 0 為預期行為);PR body 對照本 entry 貼同兩項 disposition。
> **驗證**:typecheck / lint 綠;catalog:render 34 controls 35414 bytes;check:catalog CATALOG_OK;check:doc-refs 854 refs 0 fail;check:mutation-specs 14 spec 167 probes drift zero-diff;vitest focused 3 files 100 passed 0 skip。


> 更早的 entries 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md)
