---
title: Progress Archive — 2026-09(2026-08-31 ①)
type: archive
---

# Progress Archive 2026-09

> 從 `.claude/memory/progress.md` 於 2026-09-02 PR A3 Phase 0 歸檔(主檔 19.8 KB / 20 KB
> 上限,doc-size CI gate 即將觸發)。本檔為唯讀歷史 snapshot,不回頭編輯。
> ⚠️ 本檔含 1 處 canonical ADR 引用,`scripts/lib/template-governance.ts` 的
> `EXPECTED_ADR_REFS` 與本次歸檔同 commit 更新(位置＋數量鎖)。

---

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
