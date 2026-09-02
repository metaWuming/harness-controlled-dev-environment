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

📅 2026-09-02 ① — **PR A2:Template／Adopted mode 宣告 + Adoption Readiness Gate(`check:adoption`)**

> **緣起**:優化方案 §6。A1.1 證明 runtime 判別式(`isTemplateRepo()`)判反、是斷路器、fail-open;G2/G4 仍把模板作者簿記套在採用者 `npm test`(TODOS P2#1)。supervisor 拍板:mode 是**單一 config 內的顯式靜態宣告、fail-closed 解析,禁止偵測 / heuristic / env override**。起手 git 核實 frozen base = `0c2e5e9de2a928c6be89f0bfd1e126d32aa1dbc1`,全程在乾淨 worktree `feat/a2-adoption-readiness`,dirty main worktree 未讀未動。plan 走 3 輪 supervisor review(rev 2:adapter 逐條斷言 / Part 4 精確內容 / A5 集合相等 / G2G4 行為級證據;rev 3:字面分支名文法)。
> **改動**:11 檔 / 8 commits。新 `scripts/harness.config.json`(schemaVersion 1、出廠 template)+ `scripts/lib/harness-config.ts`(無 fallback、無正規化;未知欄位 / schema / mode / 空陣列 / 重複含 case-fold / delivery ⊄ protected / 未知 adapter 一律 throw;`literalBranchNameViolation` 拒 glob / ref-prefix / 空白 / 引號 / 管線 / 控制字元)。新 `scripts/check-adoption-readiness.ts`:template T1–T9(逐條印 `template exception`、首行不含 READY)/ adopted A1–A8(projectId、Part 4 四段精確規則交叉比對 package.json 與 tracked 檔、五域 pattern XOR N/A、destructive placeholder、四來源分支集合精確相等且來源 token 也過文法、逐 adapter 斷言、CI 行、CODEOWNERS);exit 0 / 2。`cso-trigger.config.ts` 加 `CSO_NOT_APPLICABLE`;`check-cso-trigger.ts` 不改。新 `scripts/lib/template-governance.ts`:原 G2/G4 搬成純函式、只在 template 由 T9/T8 執行,vitest 刪 G2/G4。`check-cso-trigger.test.ts` 路徑表鎖改 always-on 依宣告 mode 分支。CI 加 `Adoption Readiness Check`。CLAUDE.md Part 4 註解改成可機驗格式說明(仍是骨架);ADOPTION §0 / §2 / §3 / §5 / §6 / §11。**out of scope**:baseline 不併入 config、hooks 行為、`if:` event 過濾、A3 catalog、P2#2 / P2#3 / P3。
> **驗證**:typecheck / lint / 19 檔 **756 passed + 2 skipped = 758**(base 16 檔 / 577;2 skipped = 鎖測試的 adopted 分支,屬設計)/ doc-refs / doc-size / todos / no-source-terms / `check:adoption`(本 repo 自證:TEMPLATE_MODE、3 exception、exit 0)全綠。**mutation 16 條全數被抓**,`npx tsx scripts/mutate.ts --spec scripts/mutations/adoption-readiness.json`(`--cmd` 縮到四支相關測試檔)exit 0,綁 `b52701ac0445c56e66ebff3e2dc5fcae5bc7a24f`。第 1 輪 M10(ADOPTED_CHECKS 拿掉 A7)**存活**——adopted 側沒有任何測試在 ci.yml 缺 check:adoption 行時斷言 A7;補單元 + e2e 負對照後第 2 輪 16/16。
> **安全關**:`check:cso` 表空 fail-closed = 模板例外;人工判定新增守門碼 + 改 CI + 改 CLAUDE.md → **高風險車道**(探針 exit 0 已綁 SHA;Step 5 worktree 審待 Codex commit-only review 之後)。視覺關未觸發。
> **審查**:Step 4 Codex commit-only review 待跑(本 entry 為 pre-review 凍結版;結果由後續 fix commit 與 entry 更新補)。
> **⭐ 教訓**:⓪**寫 entry 時又寫了沒實測的數字**(「821 tests」,實測 758)——在最終 gate 跑完前不要填任何數字。①**探針又一次打臉推論**——我「確定」A7 有測試守,其實只在 template 側(T6)有;M10 存活是唯一的證據來源。②**G2/G4 這類「模板作者簿記」正確歸宿是 checker 的 template 分支,不是 vitest**——搬過去後採用者不再被模板簿記擋,而模板自己每次 CI 照樣跑。③**來源側 token 也要過同一份文法**——rev 2 把 glob 分離成 info 看似無害,`main*` typo 會被當 info 吞掉;白名單 + fail 才是對的。
> **⏭️ 下一棒候選**(hint 非 truth):A. PR A3(Control Catalog,收 ADR 已知限制 1-3 + `if:` event 過濾 conformance + 兩條 A1 defer);B. TODOS P2#2(`DELIVERY_REFS=HEAD`)/ P2#3(mutation spec 漂移 CI 守門);C. P3 三條。
> **check:claims 逐條處置**:命中 14 處(README 1 / ADOPTION 2 / checker 3 / loader 1 / tests 7),**全部留 A**:「唯一允許的 glob」= 白名單恰一項;「唯一機器判準」= 設計上只有 check:adoption 出具;always-on = 測試無條件執行、skip 由宣告值決定;`never` 是 TS 型別;其餘為測試名稱 / fixture 文字 / 既有 README 行。
> 📊 成本:CC ~4h / plan supervisor 3 輪 + mutate 2 輪 / P1 0 個 / P2 0 個(pre-review)/ Step5 獨立發現 —(待)
> 📐 量測:主迴圈 claude-fable-5-1 effort low;baseline SHA `0c2e5e9de2a928c6be89f0bfd1e126d32aa1dbc1`;來源分佈(pre-review)—
> **7 步 checklist**:1 ✅(rev 3)/ 2 ✅ supervisor 核准 / 3 ✅ 8 commits 每 phase 全綠 / 4 ⏳ Codex commit-only / 4.5 ✅ 探針 16/16 綁 `b52701ac…`(worktree 審待 Step 5)/ 4.6 ✅ 未觸發 / 5-7 待執行

📅 2026-08-31 ① — **PR A1.1:A1 review residual 三條(F1 效能重構 / F2 repo-local ADR / F3 docstring)**

> ⚠️ **本 entry 刻意寫成摘要**。每一支 commit 的逐輪細節都在 commit 訊息裡逐字保留;
> progress 的職責是「接手 session 讀完就知道上一棒做了什麼、下一棒是什麼」,不是複製 review log。
> **緣起**:Codex 對 `641065..e1408a3` 獨立 review 留下三條 P2 residual。獨立 PR、不重做 A1。全程在乾淨 worktree `fix/a1-review-residuals`,frozen baseline `e1408a34e0b4fa6df1fac74d7c7e958732110c81`;dirty main worktree 全程未讀未動。
> **F1(行為)**:舊版每 rev 跑 3 次 `git show` + 3 次 `grep`,同一份 patch 被提取兩次,成本隨歷史成長會撞 CI 上限,而 baseline 是治理決策不能為效能推進。改成 rev 分批(50/批)+ 每批一次不帶 pathspec 的 producer(stdout 直寫檔)+ 逐行串流分桶 + 三次 `grep -r`。subprocess `15 + 6N` → `15 + ceil(N/50) + 3`。四條不變量正本在 ADR。**掃描語意與判定結果未變。**
> **F1 的代價**:pathspec 過濾從 git 移到 JS → 要自己解析 patch 檔頭,承接整個解析攻擊面。新增 `parsePatchDstPath` / `decodeGitCQuote` / `splitPatchStream` / `stripExcludeMagic` / `canDropLongPatchLine`,**任一解析不明確一律 scanner error → exit 非 0**。
> **F2**:新增 canonical ADR `docs/architecture/source-term-history-baseline.md`「決策」,記錄決策、政策邊界、三種 repo 情境、baseline 變更授權、導入步驟、效能四不變量、**九條已知限制**、provenance。canonical 引用恰 6 處 / 5 個 tracked 檔,由 G2 鎖位置與數量。**F3**:docstring 與實作對齊。
> **改動**:11 檔 / 36 commits ——`check-no-source-terms.ts`;`check-no-source-terms.test.ts`(+85);`check-doc-refs.test.ts`(+7,G1-G6);新 ADR;`check-doc-refs.ts`(SCAN_DIRS 一行);`mutations/source-term-diff-scan.json` + README(29 條探針);`ci.yml` + `source-term-baseline.json`;bookkeeping 2 檔。**out of scope**:A2/A3/B/C;`--all` tree-scan 效能;三條 A1 deferred 限制只登錄不修。
> **審查(這是本 sprint 最大的成本項)**:plan 走 3 輪 supervisor(R2 **否決我提的 B2 雙串流**——我把 INV-1 從「每 commit 一次」改寫成「每 view 一次」,等於繞過明文要求)。實作後 **Codex 5 輪 + Step 5 對抗性獨立審 3 輪**:

| 輪 | 結果 | 主要 finding |
|---|---|---|
| Codex r1 | 1 P1 + 2 P2 | aggregate diff hit 重用 NUL parser → 洗白假綠;maxBuffer false-red;簿記不符 |
| Codex r2 | 0 P1 + 2 P2 | false-red 只是被位移到消費端(整行累積);散文/簿記自相矛盾七處 |
| Codex r3 | 0 P1 + 1 P2 | 被掃路徑超長單行仍整行累積 → **Owner 拍板只修敘述、行為登錄限制 7** |
| Codex r4 | 0 P1 + 1 P2 | 探針 spec 只在 session scratchpad,repo 內重跑不出來 → 落進 repo |
| Codex r5 | **0** | Step 4 收斂 |
| Step5 r1 | **3 CRITICAL** + 12 I | ADR 裸 PR 引用讓下游開箱即紅;`log.diffMerges` 反轉 merge 格式;tree 掃描 `-I` 跳過 binary(**Owner 拍板選項 A:收斂敘述 + 登錄限制 8**) |
| Step5 r2 | **2 CRITICAL** + 17 I | 顏色打穿 CA 抽號 → 假放行;quoted path 尾端 TAB → 乾淨 repo 假紅 |
| Step5 r3 | **3 CRITICAL** + 12 I | `git log` 無編碼釘法 → commit 訊息掃描歸零;`isTemplateRepo()` 判反且是斷路器 |

> **三輪 Step 5 共 8 條 CRITICAL,Codex 五輪一條都沒抓到 —— cross-model agreement ≈ 0 被徹底驗證。** 反過來 Codex 抓到的 P1 / 簿記問題 Step 5 也沒抓到。兩層都不可省。
> **r3 的 Owner 裁示 = 選項 B(縮小攻擊面,不是繼續加守門)**:C1 是真缺陷(`i18n.logOutputEncoding` 讓 UTF-8 denylist 全部對不上,BIG5/GBK 打穿非 ASCII 條目、UTF-16 連 ASCII 也打穿)→ 三個 `git log` 呼叫點一律釘 `-c i18n.logOutputEncoding=UTF-8`。C2/C3 是**我 r2 自己加的機械**:`isTemplateRepo()` 對它要保護的族群判反(GitHub Template 會原樣複製 baseline config),反過來又是一行就能關掉三條守門的斷路器、關掉時還報 PASS、`catch` 還 fail-open → **整組移除**,G2/G4 回到計畫核准的無條件版本,G6 改成對靜態的模板出貨路徑前綴清單斷言。
> **格式旗標契約**:同一類缺陷(`log.diffMerges` / 顏色 / textconv / 編碼)被獨立抓到四次後,改成 **13 項封閉清單 + argv 斷言(C5p/C5q/C5r)+ 8 條敵意 config e2e + 對應探針**。誠實邊界寫在 docstring:契約只驗旗標存在、不驗有無後續項蓋掉它(那由行為測試守)。
> **驗證**:16 檔 **577 tests** / typecheck / lint / **check:doc-refs 259 引用 0 失效** / doc-size / hooks / todos / bookkeeping / check:no-source-terms 全綠。
> **mutation 探針**:**29 條全數被抓**,`npx tsx scripts/mutate.ts --spec scripts/mutations/source-term-diff-scan.json` exit 0,綁定 `e177118151b866c84cb7e8b164d27d7cd5cfec7e`。四次存活、一次「無法判定」各暴露不同缺口(M7 退化的是診斷不是偵測;M14 連兩輪是測試設計缺陷;M22 是斷言寫太鬆;M23 因插入新旗標導致樣本漂移 → **fail-closed 正確運作,沒有靜默算成已抓到**)。
> **⭐ 教訓**:①**效能重構在守門碼裡會換掉信任邊界**——把過濾從 git 移到 JS 等於承接整個解析攻擊面,三個非顯然形狀都是 probe 撞出來的。②**被否決的方案要接受,不要重新定義不變量**。③**mutation 存活先問「真正退化了什麼」**再補斷言。④**推論會騙人,probe 不會——這條我在同一個 sprint 犯了三次**:M22 存活時推論「不可觀測、該刪探針」,probe 一跑打臉(差異在 peak 不在 dropped);寫下這條教訓的同一份 commit,註解與教訓本身又都寫了沒實測過的數字;r2 宣稱「實測採用者情境從紅轉綠」也是**測錯狀態**(改了 baseline 才測,而採用者預設是原樣複製)。⑤**修一個實例不等於修一類**——`log.diffMerges` 修完沒掃同類,顏色、textconv、編碼三個實例被 reviewer 一條條餵回來。⑥**加守門的速度不能超過驗證它的速度**——Step5 r3 的三條 CRITICAL 沒有一條在原 A1.1 範圍內,全在我 r1/r2 新增的守門機械裡;正確反應是**縮小攻擊面**而不是繼續補。⑦**runtime 判別式當守門開關是反模式**——它同時是誤判來源、斷路器與 fail-open 點;靜態清單三個問題都沒有。⑧**「本 repo 掃得過」不等於「下游掃得過」**,反過來**模板作者的簿記契約也不該套在採用者身上**。
> **⏭️ 下一棒候選**(hint 非 truth):A. PR A2(Template/Adopted mode + Adoption Readiness Gate);B. PR A3(Control Catalog,順帶收 ADR 已知限制 1-3);C. 本輪 defer 的 INFORMATIONAL(G2/G4 對採用者不友善、`DELIVERY_REFS=HEAD` 可還原 round 2 P1-1、`grep.column` 三 NUL、`mutate.ts` 被 SIGTERM 不還原、探針無 CI 守門等)。
> **check:claims 逐條處置**:命中多為 git config 字面值(`always`/`never`)→ 留 A;真的過強者已當場收斂。完整清單於 Step 6 貼進 PR 描述。
> 📊 成本:CC ~18h / plan supervisor 3 輪 + Codex 5 輪 + Step 5 3 輪 / P1 1 個 / P2 9 個 / **Step5 獨立發現 49 個**(8 CRITICAL + 41 INFORMATIONAL;修 26、defer 23)。
> 📐 量測:主迴圈 claude-opus-5 預設 effort;Codex r1-r2 `gpt-5.6-sol` medium、r3-r5 `gpt-5.6-terra`;Step 5 為 Claude 對抗性 subagent、每輪全新拋棄式 clone / baseline SHA `e1408a34e0b4fa6df1fac74d7c7e958732110c81` / 來源分佈:**既有缺陷 6**(grep -z 冒號截斷、`log.diffMerges`、tree `-I`、`split` 切 `-z`、`git grep` 未釘顏色、`git log` 未釘編碼,六條都 A1 起就存在)・**漏改 consumer 0**・**baseline 後引入 ~50**(絕大多數是各輪修法自己帶進來的新面,見教訓 ⑥)。
> **7 步 checklist**:1 ✅ / 2 ✅ / 3 ✅ / **4 ✅ Codex r1-r5 收斂**(supervisor 裁定可離開 Step 4)/ 4.5 ✅(高風險車道:**29 條探針 exit 0**,綁 `e177118151b866c84cb7e8b164d27d7cd5cfec7e`)/ 4.6 ✅ not-applicable / **5 ✅ 三輪後由 Owner 裁示收斂**(3C+12I、2C+17I、3C+12I;8 條 CRITICAL 全修,23 條 INFORMATIONAL defer 進 TODOS)。⚠️ r3 修法讓 HEAD 前進、**未再派第四輪確認** —— 這是 Owner 明示的取捨,不是流程遺漏:r3 的動作以**移除**機械為主(新增面小),而前三輪的 CRITICAL 全部集中在各輪新加的守門機械上 / 6-7 待執行

> 更早的 entries(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
