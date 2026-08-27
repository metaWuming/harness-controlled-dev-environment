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
