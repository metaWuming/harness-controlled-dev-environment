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

📅 2026-09-17 ㉗ — **Sprint H:SOP Step 4.5 CSO 降級路徑改指定 Agent(取代 security-review skill 實測 turn 結束問題)**

> **緣起**:Owner 拍板 4 棒 auto sprint 序第 4 棒(原規劃 M5 起手改為此 Sprint H,理由:Owner 觀察到 Team W 下游 fork Sprint E/F 兩次連踩「跑完 security-review skill 就 pause 不繼續」問題、比 M5 起手清楚受益且風險小、M5 前置 CLAUDE.md §4.2 Design System 回填仍需另刀)。母 repo template 修法後,所有 harness adopted repo 下次 upgrade 自動吃到。
> **改動 3 commits, 3 檔 +186/-25**:
>   - **`.claude/sop/plan-mode-checklist.md` Step 4.5**「無 gstack 降級」措辭改:從「Claude Code 內建 security-review skill」→「派 Agent(subagent_type=security-reviewer)」+ 明列紅字警告「不要把 skill 當降級實作」(過往實測 turn 結束、非引擎保證)+ 派 agent 契約(prompt 帶目標 repo、命中域、意圖、對稱姿態;caller 優先提供已解析 base ref)+ outcome 三態(COMPLETE_CLEAN / COMPLETE_WITH_FINDINGS / INCOMPLETE)+ INCOMPLETE 排障流程。
>   - **`.claude/agents/security-reviewer.md` NEW ~220 行**:template agent def,對稱既有 adversarial-reviewer.md 姿態。硬性邊界(唯讀 + 從 diff 出發 + 只報 HIGH/MEDIUM;audit trail 竄改/漏 attribution 屬安全問題必報,非 audit log observability 排除);審什麼(6 軸:Input Validation / Authn/Authz / Crypto/Secrets / Injection/RCE / Data Exposure / **Audit Integrity** / **Deployment/Ops**);分析 3 phases(context / comparative + 反轉回歸驗 / vulnerability assessment);輸出格式含 outcome 三態必填。
>   - **`.claude/memory/LESSONS.md`** 新加 2026-09-17 條目:記錄根因(skill 實測 turn 結束、非引擎保證,由 SOP 規範強制 caller 繼續)+ 規則(SOP 明列指引)+ 類推(Agent vs Skill 差別由 SOP 規範 + agent outcome 契約確立、非工具本身保證)。
> **審查總結**:
>   > **Codex round 1**(gpt-5-codex medium):**3 P1 + 3 P2** findings —— F1 env/CLI 信任性(取決於來源與 trust boundary、命中 sink 要報)、F2 收緊姿態要驗回歸(對稱姿態只作比較基準)、F3 INCOMPLETE outcome 三態(取代「信心 <0.7 不報告」)、F4 加 Audit Integrity + Deployment/Ops 軸、F5 skill/agent 因果不誇大(過往實測 vs 引擎保證)、F6 caller 契約三處互斥修法 —— **全處置(P1 全修 + 散文級照抄 Codex 替換句)**。
>   > **Codex round 2 sanity**:**1 P2 行為級 + 2 散文級** —— F3-cont INCOMPLETE 定義擴充(任何必要 phase 未完成都算)、F4 base 解析契約(caller 優先提供 / fallback CLAUDE.md §4.6 + harness.config.json / 零或多候選 INCOMPLETE 不猜)、F5 三處統一散文(移除殘留「輸出即 turn 結束」「永遠是 pause 陷阱」絕對化)—— **全處置**。
>   > **Codex round 3 sanity**:**no actionable findings, convergent**。**收斂**。
>   > **Step 4.5 CSO gate**:template repo `CSO_REQUIRED` fail-closed(路徑表為空為設計);人工判定 **CSO_NOT_REQUIRED**(純 SOP/agent def/LESSONS 治理文件,無 code exec、無 attack surface、對稱既有 adversarial-reviewer 姿態)。
>   > **Step 4.6 UI**:未觸發(純 docs 治理修法)
>   > **Step 5 sanity skip**:3 rounds Codex 累積 9 findings 全處置(6 R1 + 3 R2)、R3 收斂 + 純治理文件對稱既有姿態 → 教訓 ⑫/⑬ 應用,skip subagent 呼叫。
> **驗證**:typecheck 綠 / lint 綠 / check:doc-size 綠(progress 19.4 KB、LESSONS 26.5 KB)
> **⭐ 教訓**(累積 ⑧):**「因果宣稱誇大化」的散文級陷阱** —— Sprint H R1 我把 skill/agent 差別寫成「天生 pause / 天生繼續」引擎級保證,實際上是 SOP 規範 + agent outcome 契約確立的**規範層**差別、非工具本身保證。Codex R1 F5 + R2 F5 兩輪都抓到「絕對化敘述」需收窄。**規則**:描述工具/機制的行為時,分清「引擎保證」(spec 明文)vs「實測常見」(觀察結果)vs「規範強制」(SOP/契約強制),用詞對應精確。**衍生**:sprint entry 若含機制描述,寫「過往實測」比「天生保證」保守但正確。
> **⏭️ 下一棒候選**(hint 非 truth):
>   - Team W 下游 fork 側追蹤:下次 harness upgrade 觀察 SOP Step 4.5 是否自動吃到 subagent 姿態、CI 是否有意料外差異、Sprint E/F 「security-review skill pause」問題是否根治
>   - 其他 gate(4.6 視覺關 / gstack 家族的 review skills)是否也有同類「skill 輸出即 turn 結束」風險 → 未來獨立 sprint 檢視
>   - **M5 前置**:CLAUDE.md §4.2 Design System 回填(獨立 sprint,M5 起手前必做)
> **check:claims 逐條處置**:未跑 check:claims(3 commits 純 SOP / agent def / LESSONS 治理文件,無 code 動 → 手動核對已完成,無留待處置項)
> 📊 成本:CC ~1.5h(3 commits + 3 rounds Codex + 人工 CSO 判定 + Step 5 sanity skip 判斷)/ 跨模型 review 3 rounds Codex / **3 P1**(全修)/ **6 P2**(4 行為級修 + 2 散文級照抄)/ **Step5 獨立發現 0 個** / **收斂**(R3 no actionable findings) / 3 檔改動(.claude/sop/plan-mode-checklist.md + .claude/agents/security-reviewer.md + .claude/memory/LESSONS.md)+ progress
> 📐 量測:baseline SHA `d1b0b35`(main HEAD);feature branch tip = R2 fix commit `1e11cd2`;來源分佈:R1 = 初始 patch 內既有缺陷 x6(agent def 過度信任 env、姿態豁免 defense-in-depth、outcome 未三態、命中域軸不全、因果宣稱誇大、caller 契約 3 處互斥)、R2 = R1 fix 引入的新面 x1(base 解析契約)+ 散文級 x2;model:Codex gpt-5-codex 3 rounds medium;blast radius:agent def NEW 220 行 + SOP 修 22 行 + LESSONS 新條目 26 行;無 code / 無 test / 無 cross-file breaking

---

<!-- ㉖ port Team W Sprint A 已於 Sprint I(2026-09-18 ㉘)進 archive(依 20 KB 額度慣例) -->

---

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

<!-- ㉒ port SOP-tune v2 已於本 sprint(loadHarnessConfigOrFail wrapper)進 archive(依 20 KB 額度慣例) -->
📅 2026-09-09 ⑳ — **governance sprint:CI-016 SSOT durable evidence boundary(range f3291648..d56cbe4)**

> **改動 d56cbe4**:5 檔 wording 對齊 durable evidence boundary(scripts/control-catalog.json CTRL-CI-016 notes / docs/ADOPTION.md §5.2 / scripts/run-mutation-smoke.ts header / .github/workflows/ci.yml smoke step comment / docs/CONTROL-CATALOG.md rendered)。改法將 remote-state stale assertion 拆為 evidence boundary:遠端 enforcement 需 gh api live probe 現場確認;template config `githubGovernanceRequired:false` 表達 adopter requirement default 語意;schedule A-D audit 以 `BRANCH_PROTECTION_TOKEN` + schedule workflow 成功為前提;per-PR verifier 屬 out-of-scope。
> **Step 4 flow P2 finding**:supervisor 於 detached review clone 發現 check:claims 命中需在 progress.md 留人工處置史;本 entry(⑳-b commit)即該留史。
> **check:claims 逐條處置**(pre-merge、PR body 對齊同兩項 disposition、兩處貼、不轉抄):
> - `scripts/control-catalog.json:997` KEEP — CI-016 notes 內被標示為「不成立」的舊防線措辭之校正引文,非 current enforcement 斷言。
> - `docs/CONTROL-CATALOG.md:52` KEEP — catalog:render 產物、對應 catalog.json 同引文、非新斷言。
> **claims 工具語意**:命中為待人工處置 flow signal、非 product / CI failure(tool 命中時 exit code 非 0 為預期行為);PR body 對照本 entry 貼同兩項 disposition。
> **驗證**:typecheck / lint 綠;catalog:render 34 controls 35414 bytes;check:catalog CATALOG_OK;check:doc-refs 854 refs 0 fail;check:mutation-specs 14 spec 167 probes drift zero-diff;vitest focused 3 files 100 passed 0 skip。


> 更早的 entries 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md)
