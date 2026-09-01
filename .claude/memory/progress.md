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

📅 2026-08-31 ① — **PR A1.1:A1 review residual 三條(F1 效能重構 / F2 repo-local ADR / F3 docstring)**

> **緣起**:Codex 對 `641065..e1408a3` 做獨立 review,留下三條 P2 residual。獨立 PR、不重做 A1。隔離:全程在乾淨 worktree `fix/a1-review-residuals`,frozen baseline `e1408a34e0b4fa6df1fac74d7c7e958732110c81`(= HEAD = origin/main,range 起手為空)。dirty main worktree 全程未讀、未動。
> **F1(行為)**:舊版對 `baseline..HEAD` 每個 rev 各跑 3 次 `git show` + 3 次 `grep`,其中 main pathspec 產出兩份相同 patch → **同一份 patch 被提取兩次**;成本隨歷史單調成長、會撞 CI 十分鐘上限,而 baseline 是治理決策不能為效能推進。改成:rev 分批(50/批)、每批**一次**不帶 pathspec 的 patch producer(stdout 直接寫檔、不經有上限的記憶體 buffer)、消費端**逐行串流**把新增行即時路由進「每 rev 每桶」的暫存檔、三次 `grep -r` 批掃目錄。subprocess `15 + 6N` → `15 + ceil(N/50) + 3`。不變量:每個 rev 的 patch **全域只提取一次**、三組 policy 共用同一份 extraction 分桶、記憶體不隨 patch 或 batch 的**位元組總量**成長(上界是**單一邏輯行**;R2 讓排除路徑的超長行有界,被掃路徑見 ADR〈已知限制〉第 7 條)。掃描語意與判定結果**未變**。⚠️ 純函式 `extractAddedLinesByPath` / `bucketAddedLines`(`Map<path, 新增行>` 版)只留作單元測試與差分對照,**production 走串流路徑、不建 Map**。
> **F1 新增攻擊面與防線**:pathspec 過濾從 git 移到 JS → 必須自己解析 patch 檔頭路徑。probe 實測到三個非顯然形狀(檔名含空白後多一個 TAB、`core.quotePath=false` 不解 tab / newline 的 C-quote、`diff.noprefix=true` 讓 header **沒有 `b/`**。修法:`--src-prefix` / `--dst-prefix` / `-c core.quotePath=false` 釘死(實測壓得過 repo config),加 `decodeGitCQuote` + `parsePatchDstPath` + `splitPatchStream` + `stripExcludeMagic`,**任一解析不明確一律 scanner error → exit 非 0**,不得把 section 當空。
> **F2(文件治理)**:committed 引用指向版控外的私人規劃文件、progress 還指個人絕對路徑。新增 canonical ADR `docs/architecture/source-term-history-baseline.md`「決策」,記錄決策、source-term 與秘密掃描的政策邊界、template / 下游新歷史 / shallow clone 三情境、baseline 變更授權、導入步驟、效能四條不變量、已知限制、provenance(交付 PR 號 + 首次 baseline SHA)。canonical path 引用**恰 6 處、分佈在 5 個 tracked 檔**(`ci.yml` 2 處,`source-term-baseline.json` / `check-no-source-terms.test.ts` / `progress.md` / `progress-archive/progress-2026-08.md` 各 1 處),每處指到穩定 H2 標題;位置與數量由 `tests/check-doc-refs.test.ts` 的 G2 表鎖住。`check-doc-refs` SCAN_DIRS 加一個目錄。**未複製**外部規劃文件內容。
> **F3(散文)**:`validateBaseline` docstring 的分派表寫「跳過 history scan」,與實作及測試相反(round 2 P1a 已改成降級全史掃)。只改文字。
> **改動**:11 檔(含 bookkeeping 2 檔)—— `scripts/check-no-source-terms.ts`(F1 實作 + F3 + R1 修法 + 新純函式:framing / 串流 / SSOT 狀態機);`tests/check-no-source-terms.test.ts`(+75 條:shim T1-T3 / scale C1-C7 / e2e E1-E7b / 注入式 E5・N2・N8a-d / 純函式 U1-U12 / R1 回歸 R1P1-a-f・R1P2-a-c / R2 回歸 R2P2-a-b・U13 判定矩陣);`tests/check-doc-refs.test.ts`(+6 條 G1-G5 doc governance);`docs/architecture/`(新 ADR);`scripts/check-doc-refs.ts`(SCAN_DIRS 一行);`.github/workflows/ci.yml` + `scripts/source-term-baseline.json` + `.claude/memory/progress.md`(引用改寫);bookkeeping 2 檔(`progress.md` 本 entry + `progress-archive/progress-2026-08.md` 收批 11、批 12);`scripts/mutations/source-term-diff-scan.json` + 該目錄 README 指標(R4:把 20 條探針落進 repo,讓高風險車道證據可稽核)。**out of scope**:A2/A3/B/C 全部;`--all` 全史 tree-scan 路徑的效能(supervisor 裁示 OUT);三條 A1 deferred 限制不修、只在 ADR 登錄。
> **審查**:plan 走 **3 輪 supervisor review 才批准**。R1 要求 scale contract implementation-neutral、delimiter deterministic fail-closed、parser 邊界契約、doc test 放對位置、shim 透明性、dirty-main 紀律。R2 **否決我提的 B2 雙串流方案**——我把 INV-1 改寫成「每個 pathspec view 一次」等於繞過「每個 commit patch 只提取一次」,理由成立,回到單一 extraction 並補齊全套 parser 契約。**安全關 4.5** `check:cso` fail-closed(表空)→ 模板 repo 例外,**人工視同 CSO_REQUIRED、進高風險車道**(本刀重寫守門的偵測路徑,bug = false green)。**視覺關 4.6** not-applicable(無 UI 檔)。**Step 4 跨模型 review 由 Codex supervisor 執行,我不自證**。
> **Codex round 1(對 `e1408a3..05b582c`)= 1 P1 + 2 P2,全部已修,無 defer**:
>   **P1 aggregate diff hit 重用 NUL 框架 parser → 洗白假綠**。`processScan` 在 self-pr 模式無條件呼叫 `parseGrepZLine`,該 parser 假設第一個 NUL 是 grep -Z 檔名分隔符;aggregate diff hit 的 NUL 是**資料**。一行「未知號 + NUL + 冒號 + 合法號」會讓未知號被當檔名丟掉 → 放行 → A 加 B 刪的洗白整段變綠。修法前已實測復現。修法:`HitFraming` 由產生端宣告、列為 `Scan` 必填欄位,`hitContent()` 依 framing 選 parser。
>   **P2 來源端豁免消失後,256 MiB buffer 變成新的 false-red**。只動 `package-lock.json`(豁免路徑)且 patch 超上限的 commit,A1.1 之前由 git pathspec 在來源端擋掉、判乾淨;改動後 producer 無 pathspec、用 maxBuffer 收全部位元組 → 政策豁免的改動讓 gate 轉紅。修法:producer stdout 接檔案 fd、消費端逐行串流,不經有上限的記憶體 buffer;順帶把三處狀態機收成 SSOT。
>   **P2 progress bookkeeping 與實際證據不符**。commit 數、doc-size 百分比、mutation 綁定敘述、Step 4/5 狀態都寫錯或過度宣稱。本 entry 即更正版。
> **修 P1 時自查再抓到第四條(同缺陷類、A1 起就存在)**:實跑 gate 發現 working-tree 掃描竟然放行含未知號的行。`git grep -z -n` 的真實輸出是 `path<NUL>行號<NUL>內容`(**兩個 NUL**,git 2.50.1 實測),但 `parseGrepZLine` 的註解與實作都假設 `path<NUL>行號:內容`、用**第一個冒號**切。真實輸出下會把「內容裡冒號之前的部分」整段丟掉 →「未知號 ref: 合法號」只剩後半 → 假放行,工作樹與全史 tree 掃描都中。既有測試用手寫 fixture 編碼了同一個錯誤假設,所以一直是綠的。修法:改用第二個 NUL 切,沒有第二個 NUL 時保守保留整段;fixture 一併更正。
> **第四條的範圍歸屬(Codex R2 裁示)**:**留在 A1.1**。它與 R1 P1 屬同一類 framing / parser 缺陷,而且是可達的假放行;拆出去等於明知有洞仍出貨。無 Owner-only 政策取捨殘留。
> **Codex round 2(對 `e1408a3..e0a2269` 全範圍、commit-only)= 0 P1 + 2 P2,全部已修**:
>   **P2-R2-1 排除路徑的 false-red 只是被位移、沒有消失**。R1 把 producer 的 256 MiB maxBuffer 換成檔案 fd,但消費端 `consumeProducerFile` 仍把**整個邏輯行**累積進 `pendingText` 才交給狀態機。可達序列:post-baseline commit **只動** `package-lock.json`(FULL_EXCLUDES 路徑)、且該檔被編碼成**單一超長行**時,`pendingText` 會超過 Node 的 MAX_STRING_LENGTH(v24 = 536870888)而 throw → rc=2 → **政策明文豁免的改動被判紅**。既有三條都證不到這件事:R1P2-a 只跑 3 MiB、R1P2-b 只驗 fd 型別、R1P2-c 驗的是**被掃**內容跨 chunk。修法:新增純函式 `canDropLongPatchLine`,對「一定不產生桶內容、也一定不改狀態機狀態」的長行,讀到門檻(production 1 MiB)就丟棄其餘位元組;判定只看**前綴**,與整行判定等價。separator 與門檻的關係、注入超長 marker 的 fail-closed 邊界寫在該函式 docstring。**不提高上限、不用文件說明繞過。**
> **自審(送 R3 複審前)**:對**本輪新增行**跑 `check:claims`(base = 上一輪送審的 HEAD `e0a2269`)抓到 4 處絕對化措辭。查證後確認「門檻保證被丟的行不可能是 separator」是過強宣稱——`marker` 是可注入參數,注入接近門檻長度的值時 separator 真的會落入丟棄分支(後果是 fail-closed 轉紅、非假放行)。已收斂為有界敘述並明寫該邊界;重跑 0 命中。
> **Codex round 3(`e1408a3..b096e4a` 全範圍、commit-only)= 0 P1 + 1 P2**。P2:被掃路徑(main / syntax 桶)的超長單行仍整行累積 → 可達 false-red。拆兩件處置——**敘述過強是本刀引入、必修**:ADR 與兩處 docstring 的「記憶體不隨單一 patch 成長」改為「上界是單一邏輯行」;**行為非本刀迴歸、不修**:改動前 `scanRevDiff` 的 `git show` 用 `maxBuffer: 256 MiB`、門檻更低,重構把界線從整批 256 MiB 放寬成單行約 512 MB 是改善。Owner 拍板只修敘述,行為登錄 ADR〈已知限制〉第 7 條、不指派。
>   **P2-R2-2 散文與簿記自相矛盾,原 R1 那條等於沒收乾**。七處一起改:`HitFraming` 註解仍寫單 NUL + 冒號;F1 敘述停在已被取代的 `Map` 版;ADR 引用數、`check:doc-refs`、新增測試數、探針數全部與證據不符;「Step5 獨立發現 4 個」與「Step 5 = Codex commit-only review」兩句都錯——transcript 稽核證實 **Step 5 從未執行**(本 sprint 的 session 一次 subagent 都沒派過),而 Codex 屬 **Step 4**。依 R2 第 7 點全項重掃,**自查再抓到兩處同類**:R1 回歸範圍實際到 `R1P1-f`(原寫 `a-d`)、來源分佈原記 2 條實為 11 條。
> **驗證**:先寫契約、對**舊實作**跑一次記錄基線 —— 8 條 scale 契約紅(C1/C2a/C2b/C2d/C3/C4/C5p/C6)、15 條行為契約綠;實作後全部轉綠。最終(綁 R2 修法後的 tip):16 檔 **565 tests** / typecheck / lint / check:doc-refs **265** 引用 0 失效 / **check:doc-size progress 通過**(本 entry 收尾又 archive 了 PR A1 一條) / check:hooks / check:todos / check:bookkeeping / check:no-source-terms 主線綠。
> **mutation 探針**:**20 條 mutations 全數被抓**(13 條 A1.1 原有 + R1 輪 M12-M15 + R2 輪 M16-M18),spec 已落進 repo、可重跑:`npx tsx scripts/mutate.ts --spec scripts/mutations/source-term-diff-scan.json` exit 0,綁定 SHA `ba6a5eb4c23f467ebece9df585b58b5942966ab8`(= 最後一個非 bookkeeping commit)。⚠️ M14 的 find 字串隨 R2 的串流改寫失效,已同步更新為新結構下的「只讀第一塊」。三次存活各自暴露不同的覆蓋缺口:
>   **M7 存活(第一輪)**:拿掉 `grep -a` 之後仍會回報命中(印「Binary file … matches」、exit 0),只斷言 exit code 的測試抓不到 —— 真正退化的是**診斷能力**。補 E7b 斷言輸出含命中內容本身。
>   **M14 存活(連兩輪)**:是**測試設計缺陷**不是等價變異。① 含 forbidden 的檔留在工作樹 → working-tree 掃描先 exit 1,測試對 diff scan 讀不讀完串流不敏感 → 改「加了再刪」。② 斷言字串是 main() 那句「…或掃描錯誤」的子字串,scanner error 也會命中 → 改斷言實際命中內容 + 不得含「掃描器錯誤」。
> **⭐ 教訓**:⓪**「測試轉紅」與「測試因為對的理由轉紅」是兩件事**——M14 那兩個遮蔽疊在一起(見上),測試看起來有效但什麼都沒守。**mutation 存活是唯一讓這件事浮出來的訊號**。①**「效能重構」在守門碼裡會換掉信任邊界,不只是換快**——把 pathspec 過濾從 git 移到 JS,等於承接整個 patch 檔頭解析的攻擊面(trailing TAB / C-quote / noprefix 三個形狀都不是讀碼想得到的,是 probe 撞出來的)。動守門碼前先跑唯讀 probe 拿真實輸出,比推論可靠。②**被否決的方案要接受,不要重新定義不變量**——R2 抓到我把「每個 commit 一次」改寫成「每個 view 一次」。改寫定義來讓自己的方案成立,是最難自己發現的一種繞過。③**mutation 存活不一定是「補一條斷言」就好,要先問「這條 mutation 真正退化了什麼」**——M7 退化的不是偵測而是診斷,所以補的斷言是輸出內容而非 exit code。照舊直覺加測試會加錯地方。④**commit-msg hook 再次擋下裸 PR 井號引用**(訊息要用 squash 格式)——這是模板 hook 的 dogfood,第二次生效。⑤**per-commit 掃描讓「先加後刪」救不了自己**——docstring 原樣寫未知 PR 號當例子被 gate 擋下;per-commit 語意下刪除不會轉綠(那正是 anti-laundering),只能用 feature branch 內部 reset --soft 重建該 commit。例子改用既有「井號」寫法。**未改寫任何公開歷史。**
> **⏭️ 下一棒候選**(hint 非 truth):A. PR A2(Template/Adopted mode + Adoption Readiness Gate);B. PR A3(Control Catalog,順帶收 ADR 已知限制 1-3);C. `--all` 全史 tree-scan 路徑的 subprocess 成本(ADR 已知限制第 4 條,目前無指派)。
> **check:claims 逐條處置**:見 PR 描述(pre-merge 於 Step 6 貼)。
> 📊 成本:CC ~8h / 跨模型 review:plan supervisor 3 輪 + Codex round 1-4 / P1 1 個(R1,已修)/ P2 9 個(F1・F2・F3 + R1 兩條 + R2 兩條 + R3 一條 + R4 一條,全處置)/ **Step5 獨立發現 0 個 —— Step 5 尚未執行**。⚠️ 以下 5 條是 **Claude 自審與 mutation 探針**的產出,**不是** Step 5 的:自審抓到的批次體積退化、M7 與 M14 兩次 mutation 存活暴露的覆蓋缺口、修 R1 P1 時自查抓到的 grep -z 冒號截斷假放行、送 R3 前 `check:claims` 抓到的過強宣稱。
> 📐 量測:主迴圈 claude-opus-5 預設 effort / baseline SHA `e1408a34e0b4fa6df1fac74d7c7e958732110c81` / 來源分佈:初始 patch 內既有缺陷 1(grep -z 冒號截斷,A1 起就存在)・初始 patch 漏改的外部 consumer 0・baseline 後新增/修改引入 11(R1 三條 + R2 兩條 + R3 的敘述過強 + R4 的探針證據不可重跑 + M7 與 M14 兩個覆蓋缺口 + 自審的批次體積退化 + 送 R3 前自審的過強宣稱;全部是本刀新實作、或本刀新寫的敘述帶進來的面)。
> **7 步 checklist 狀態**:1 ✅ / 2 ✅(supervisor R1-R2 修訂後 R3 批准;Owner-only decision = none)/ 3 ✅(tests-first → 實作 → 文件 → 自審 → bookkeeping;gate 全綠)/ **4 ⏳ 跨模型 review = Codex**:r1 = 1 P1 + 2 P2、r2 = 0 P1 + 2 P2、r3 = 0 P1 + 1 P2、r4 = 0 P1 + 1 P2(探針證據不可重跑),全部已處置,等最後一輪收斂確認/ 4.5 ✅(高風險車道:**20 條探針 exit 0**,綁 `ba6a5eb4c23f467ebece9df585b58b5942966ab8` = 最後一個非 bookkeeping commit)/ 4.6 ✅(not-applicable)/ **5 ⏳ 尚未開始**——Step 5 是 worktree 隔離的 `adversarial-reviewer`、**由 Claude 派工**;Codex 屬 Step 4,兩者不可互相取代(transcript 稽核證實本 sprint 未派過 subagent)/ 6-7 待執行

> 更早的 entries(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
