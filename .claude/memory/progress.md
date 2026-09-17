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

📅 2026-09-17 ㉖ — **port Team W Sprint A:weekly-health-check step5Independent regex 收窄(避免 Step 5 sanity + N INF 誤配)**

> **緣起**:下游 fork(Team W)Sprint A(2026-09-17)在 `scripts/weekly-health-check.ts` 修的 regex 收窄,port 回上游 harness template 避免相同 bug 在其他 adopted repo 持續影響。
> **改動 3 commits, 2 檔**:
>   - `scripts/weekly-health-check.ts`:collectReviewCost 舊 regex `Step\s*5[^0-9]*(\d+)` 太寬 → 收窄至 `Step\s*5[\s:：（(]*獨立發現[\s:：）)]*(\d+)`;支援半/全形空白、冒號、括號變體,阻擋跨欄位分隔符誤匹配。
>   - `tests/weekly-health-check.test.ts` +5 條 regression:(1) Step 5 sanity + N INF 混寫 → null(2) 「獨立發現」與 sanity 共存只認前者(3) R1 反例跨欄拒配(4) 半形冒號變體(5) 全形括號變體。
> **審查**:Codex R1 2 P2(行為級)全修 —— (a) 舊收窄仍讓 `[^0-9]*` 跨欄位抓 P1 欄名的 1;修法收緊 char class 到空白冒號括號;(b) 原第二條 fixture 把 sanity 描述放 heading 而非 📊 line、collector 不 parse → 舊 regex 對這條回 null,不是註解宣稱的 1;修法把 sanity 詞放進 cost line。R1 P2 也連帶補上 3 條變體 test。Codex R2 sanity 1 P3 散文級(test 註解精準化「P1 欄名的 1 而非計數 2」)照抄 Codex 替換句 → **收斂**。Step 4.5 CSO fail-closed(template repo 路徑表為空為設計)→ 人工判定 CSO_NOT_REQUIRED(純 regex + test、無安全面)。Step 4.6 UI 未觸發(scripts + tests 純後端)。Step 5 sanity skip(教訓 ⑫/⑬:窄 range hygiene + Codex R1/R2 收斂 + 對稱既有姿態 → 無需 subagent)。
> **驗證**:typecheck 綠 / lint 綠 / vitest 38/38 綠(原 33 + 5 regression)。
> **⭐ 教訓**(累積至 7 條;本 sprint 貢獻 ⑦):**「收窄 char class 時要驗跨欄位拒配」** —— port 下游修法時我直接抄了 `[^0-9]*`,認為 `獨立發現` 前綴已足;Codex R1 立刻抓到「Step5 獨立發現 / P1 2 個」跨欄仍會誤配 P1 欄名裡的數字。**規則**:對 regex 修法,除了驗「新變體正確匹配」還要主動驗「跨欄位分隔符不誤匹配」——把常見分隔符(`/`、`|`、換行、其他欄名詞如 P1/P2/rounds)當反例 test。
> **⏭️ 下一棒候選**(hint 非 truth):
>   - 本 sprint 對稱其他 collector helper(可能有類似 char class 太寬情境:`totalP1`/`totalP2`/`totalRounds`)—— 掃 scripts/weekly-health-check.ts 檢查
>   - 其他下游 fork sprint 若有 port 上游 defer 條目,累積後另刀處理
> **check:claims 逐條處置**:未跑 check:claims(3 commits 純 regex + test + 散文級註解、無新宣稱句 → 手動核對已完成,無留待處置項)
> 📊 成本:CC ~40min(3 commits + 2 rounds Codex + Step 5 sanity skip 判斷)/ 跨模型 review 2 rounds Codex / P1 0 / P2 2(1 行為級修 + 1 散文級照抄)/ **Step5 獨立發現 0 個** / 收斂 / 2 檔改動
> 📐 量測:baseline SHA `d1b0b35`(main HEAD)/ feature branch tip `c78439d` / 來源分佈:R1 = 初始 patch 內既有缺陷 x2(port 抄過來的 regex 已有跨欄位問題 + fixture bug);model:Codex gpt-5-codex 2 rounds medium;blast radius:weekly-health-check.ts 1 行 regex change + tests +45 行(5 條新 test);無 cross-file breaking change

---

<!-- ㉕ loadHarnessConfigOrFail wrapper 已於 ㉖ port sprint(2026-09-17)進 archive(依 20 KB 額度慣例) -->

---

📅 2026-09-16 ㉔ — **issue #93:5 條 template 硬寫改 mode-aware(adopted 導入者升級不再重套 patch)**

> **緣起**:Owner 2026-09-16 拍板做完 CLAUDE.md refactor(#97 pending)後動 #93。issue 明列 5 條 harness-owned tests/scripts 硬寫 template 出廠值(TEMPLATE_MODE / template / exit 2 / develop-first base),adopted 導入者(如 Team W)每次升級 harness 都要重套本地 patch。修法對稱 SOP-tune v2 governance-paths pattern:讓兩處 script 共用 mode-aware 邏輯。
> **改動 3 commits + 1 fresh review fix commit = 4 commits, 9 檔 +170/-59**:
>   - **Group A(cafdbba)**:3 條 tests 走 mode-aware
>     - `tests/check-adoption-readiness.e2e.test.ts` E-self case → describe.skipIf 分 template / adopted;template 保留原 T3-T10 exception assert、adopted 分支 assert 首行 ADOPTED_MODE — READY
>     - `tests/harness-config.test.ts` 本 repo mode case → toContain(['template','adopted']) + projectId 依 mode 判定
>     - `tests/invoked-as-main.e2e.test.ts` 兩 consumer spec → CFG_MODE 分支的 expectedMainExit(check-cso-trigger [0,2] / check-adoption-readiness matcher 換 TEMPLATE_MODE↔ADOPTED_MODE)
>   - **Group B(90ceaf9)**:2 條 scripts 讀 deliveryBranches[0]
>     - `scripts/lib/delivery-refs.ts` 新 export `resolveDefaultBase(repoRoot)`:讀 `loadHarnessConfig(repoRoot).deliveryBranches[0]` 為首、對 local + origin/* 都試、都不到 → return deliveryBranches[0] fallback
>     - `scripts/check-cso-trigger.ts` / `scripts/check-claims.ts` 刪 local resolveDefaultBase、import shared helper
>     - `tests/check-claims.test.ts` 兩個「預設 base」e2e 改對新語意 assert、makeRepo 加 optional harnessConfig fixture
>     - `check-cso-trigger.ts:21` + `check-claims.ts:37,231` usage 字串同步
>   - **Group C(3c91141)**:`docs/ADOPTION.md:136` wording「預設 main/develop」→「與 protectedBranches 對齊」
>   - **Fresh review 修(b3a...)**:P1/P2 fix
>     - 兩支 script main() 加 try/catch 包 resolveDefaultBase 呼叫、catch 落 fail-closed exit 2(不讓 loadHarnessConfig throw 冒到 Node 頂層變 exit 1、破契約)
>     - 兩支改用 `git rev-parse --show-toplevel` 拿 repo root(而非 process.cwd() 可能是子目錄)
>     - `scripts/lib/delivery-refs.ts` helper docblock 加 disclaimer 明講「與 resolveDeliveryRefs* 哲學不同、非權威 base」
>     - `tests/delivery-refs.test.ts` 加 5 條 unit tests(happy path / config missing / config 壞 / all unresolvable / fallback)
> **審查**:
> 無 Codex 環境(usage limit 撞頂、下週三恢復)→ 走 SOP 允許的降級 Claude /code-review 路徑。
> Claude /code-review round 1(fresh adversarial-reviewer subagent、Sonnet)抓 2 P1 + 3 P2 + 2 INF → **P1 x2 修**(scripts try/catch fail-closed exit 2、破 exit-code 契約)+ **P2#3 修**(cwd 依賴 → git rev-parse --show-toplevel)+ **P2#4 修**(check-cso-trigger docstring stale)+ **P2#5 修**(helper unit tests 5 條)+ **INF#8 修**(helper disclaimer 語義區隔 vs delivery-refs 既有 API)→ **收斂於 0 P1 剩餘、no actionable findings**。Step 4.5 CSO 對本 sprint 動的檔案未觸敏感面(tests/scripts/docs);本 template repo CSO_REQUIRED 是 template 路徑表為空的既有狀態、非本刀觸發。Step 4.6 UI 未觸發(純後端 diff)。
> **驗證**:typecheck / lint / vitest 37 files 1389 passed / 4 skipped(+5 新)/ check-catalog 35 controls / check-doc-refs 892 refs 0 fail / check-no-source-terms 三段全綠 / check-doc-size progress 14.2 KB / LESSONS 24.2 KB
> **⭐ 教訓**(累積至 6 條;本 sprint 貢獻 ⑥):
>   ⑥ **Port `loadHarnessConfig()` 到 CLI script 要 try/catch fail-closed exit 2** — helper 對 config 錯 / 缺會 throw,若 caller 沒 try/catch → Node 頂層變 exit 1(對 fail-closed=2 契約的 script 是 silent fail-open)、對「有待處置清單=exit 1」的 script 是語意衝撞。判準:任何 CLI script 用 loadHarnessConfig 都要 try/catch + 明確 fail-closed exit 2(對稱本 sprint P1 修法姿態)。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):
>   - `scripts/lib/delivery-refs.ts` 未來若加更多讀 config 的 helper、都要對稱 try/catch 姿態(可考慮抽 `loadHarnessConfigOrFail(root, exitCode)` wrapper)
>   - Team W 側追蹤:merge 後 Team W 升級 harness 時觀察本 sprint 修法是否真解 mode-aware pain(不再重套本地 patch)
> 📊 成本:CC ~1h / 跨模型 review:Codex 撞 usage limit **降級 Claude fresh subagent 1 pass** / P1 2 修 / P2 3 修 + 2 INF(1 修 1 skip)/ 4 commits + 1 progress entry commit

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
