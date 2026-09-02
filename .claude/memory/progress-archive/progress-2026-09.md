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

---

> 2026-09-02(git-add-guard sprint 收尾)歸檔 PR A2 entry(主檔 20.8 KB 超標)。

📅 2026-09-02 ① — **PR A2:Template／Adopted mode 宣告 + Adoption Readiness Gate(`check:adoption`)**

> **緣起**:優化方案 §6。A1.1 證明 runtime 判別式(`isTemplateRepo()`)判反、是斷路器、fail-open;G2/G4 仍把模板作者簿記套在採用者 `npm test`(TODOS P2#1)。supervisor 拍板:mode 是**單一 config 內的顯式靜態宣告、fail-closed 解析,禁止偵測 / heuristic / env override**。起手 git 核實 frozen base = `0c2e5e9de2a928c6be89f0bfd1e126d32aa1dbc1`,全程在乾淨 worktree `feat/a2-adoption-readiness`,dirty main worktree 未讀未動。plan 走 3 輪 supervisor review(rev 2:adapter 逐條斷言 / Part 4 精確內容 / A5 集合相等 / G2G4 行為級證據;rev 3:字面分支名文法)。
> **改動**:**20 檔、9 個非 bookkeeping commits**(`git diff --name-only base..9658af7 | wc -l` = 20;`git rev-list --count base..9658af7` = 11,其中 `9f79894`、`be7e30e` 經 `check-bookkeeping-commit` 判為 bookkeeping,11 − 2 = 9)。新 `scripts/harness.config.json`(schemaVersion 1、出廠 template)+ `scripts/lib/harness-config.ts`(無 fallback、無正規化;未知欄位 / schema / mode / 空陣列 / 重複含 case-fold / delivery ⊄ protected / 未知 adapter 一律 throw;`literalBranchNameViolation` 拒 glob / ref-prefix / 空白 / 引號 / 管線 / 控制字元)。新 `scripts/check-adoption-readiness.ts`:template T1–T9(逐條印 `template exception`、首行不含 READY)/ adopted A1–A8(projectId、Part 4 四段精確規則交叉比對 package.json 與 tracked 檔、五域 pattern XOR N/A、destructive placeholder、四來源分支集合精確相等且來源 token 也過文法、逐 adapter 斷言、CI 行、CODEOWNERS);exit 0 / 2。`cso-trigger.config.ts` 加 `CSO_NOT_APPLICABLE`;`check-cso-trigger.ts` 不改。新 `scripts/lib/template-governance.ts`:原 G2/G4 搬成純函式、只在 template 由 T9/T8 執行,vitest 刪 G2/G4。`check-cso-trigger.test.ts` 路徑表鎖改 always-on 依宣告 mode 分支。CI 加 `Adoption Readiness Check`。CLAUDE.md Part 4 註解改成可機驗格式說明(仍是骨架);ADOPTION §0 / §2 / §3 / §5 / §6 / §11。**out of scope**:baseline 不併入 config、hooks 行為、`if:` event 過濾、A3 catalog、P2#2 / P2#3 / P3。
> **驗證**:typecheck / lint / 19 檔 **756 passed + 2 skipped = 758**(base 16 檔 / 577;2 skipped = 鎖測試的 adopted 分支,屬設計)/ doc-refs / doc-size / todos / no-source-terms / `check:adoption`(本 repo 自證:TEMPLATE_MODE、3 exception、exit 0)全綠。**mutation 16 條全數被抓**,`npx tsx scripts/mutate.ts --spec scripts/mutations/adoption-readiness.json`(`--cmd` 縮到四支相關測試檔)exit 0,綁 `b52701ac0445c56e66ebff3e2dc5fcae5bc7a24f`。第 1 輪 M10(ADOPTED_CHECKS 拿掉 A7)**存活**——adopted 側沒有任何測試在 ci.yml 缺 check:adoption 行時斷言 A7;補單元 + e2e 負對照後第 2 輪 16/16。
> **安全關**:`check:cso` 表空 fail-closed = 模板例外;人工判定新增守門碼 + 改 CI + 改 CLAUDE.md → **高風險車道**(探針 exit 0 已綁 SHA;Step 5 worktree 審待 Codex commit-only review 之後)。視覺關未觸發。
> **審查**:**Codex commit-only 2 輪**:r1 0 P1 + 1 P2(entry 檔數「11」是推論值,實測 18)→ 修 → r2 0/0 收斂(Codex 另獨立重跑 full suite 與 16 條探針)。**Step 5 worktree 獨立審 3 輪**(每輪全新拋棄式 clone、review-tip 40 字元核對、reviewer 皆實跑 fixture / 變異):r1 tip `be7e30e…` **0 C + 13 I**(修 I1 檔頭舊說法 / I2 A6.claude.link 可被 HTML 註解糊弄 / I4 `Firebase` 命中 `rebase`;10 條 defer)→ r2 tip `aeb65e5…` **0 C + 5 I**(F1:r1 加的 `\b` 讓 `squashed` / `merge commits` 假紅——**修法自己長出的面**;修 F1 / F2 ff 寫法 / F4 措辭 / F5 OVERVIEW 舊說法;F3 defer)→ r3 tip `9658af7…` **0 C + 6 I**(全 conf ≤6:4.6 關鍵字檢查對否定句 / URL / 時態變體的邊角)→ **停:4.6 是關鍵字存在檢查、不是語意解析,再修只會換一組邊角;6 條 defer**。cross-model agreement:Codex 抓簿記數字、Step 5 抓守門邊角,零重疊。
> **⭐ 教訓**:⓪**寫 entry 時三次寫了沒實測的數字**(「821 tests」實測 758;「11 檔」實測 18;「10 commits」是加 commit 前量的,Codex 兩輪各抓一次)——每個數字要在**最後一支 commit 之後**重量、把指令與輸出值一起寫進 entry。①**探針又一次打臉推論**——我「確定」A7 有測試守,其實只在 template 側(T6)有;M10 存活是唯一的證據來源。②**G2/G4 這類「模板作者簿記」正確歸宿是 checker 的 template 分支,不是 vitest**——搬過去後採用者不再被模板簿記擋,而模板自己每次 CI 照樣跑。③**來源側 token 也要過同一份文法**——rev 2 把 glob 分離成 info 看似無害,`main*` typo 會被當 info 吞掉;白名單 + fail 才是對的。
> **defer 清單**:Step 5 三輪共 17 條 INFORMATIONAL(conf ≤6)登 TODOS P3「A2 Step 5 defer 集合」。
> **⏭️ 下一棒候選**(hint 非 truth):A. PR A3(Control Catalog,收 ADR 已知限制 1-3 + `if:` event 過濾 conformance + 兩條 A1 defer);B. TODOS P2#2(`DELIVERY_REFS=HEAD`)/ P2#3(mutation spec 漂移 CI 守門);C. P3 三條。
> **check:claims 逐條處置**:命中 14 處(README 1 / ADOPTION 2 / checker 3 / loader 1 / tests 7),**全部留 A**:「唯一允許的 glob」= 白名單恰一項;「唯一機器判準」= 設計上只有 check:adoption 出具;always-on = 測試無條件執行、skip 由宣告值決定;`never` 是 TS 型別;其餘為測試名稱 / fixture 文字 / 既有 README 行。
> 📊 成本:CC ~6h / plan supervisor 3 輪 + Codex 2 輪 + Step 5 3 輪 + mutate 4 輪 / P1 0 個 / P2 1 個 / Step5 獨立發現 24 個(0 CRITICAL、修 7、defer 17)
> 📐 量測:主迴圈 claude-fable-5-1 effort low;Codex gpt-5.6-terra medium;Step 5 為 Claude 對抗性 subagent;baseline SHA `0c2e5e9de2a928c6be89f0bfd1e126d32aa1dbc1`;來源分佈:既有缺陷 0・漏改 consumer 3(cso 檔頭、OVERVIEW、TODOS 正文)・baseline 後引入 22(其中 r2 F1 是 r1 修法引入)
> **7 步 checklist**:1 ✅(rev 3)/ 2 ✅ supervisor 核准 / 3 ✅ 8 commits 每 phase 全綠 / 4 ✅ Codex r1-r2 收斂 / 4.5 ✅ 探針 16/16 每輪重跑、最終綁 `9658af70f4f6f6687846d1ed0325b6685179c5b8` / 4.6 ✅ 未觸發 / 5 ✅ 三輪收斂(review-tip 最終 `9658af7…`)/ 6-7 待執行

---

> 2026-09-03 PR P2#2 bookkeeping 歸檔(主檔 20.8 KB / 20 KB 上限):PR A3 entry 搬入,含 0 處 ADR 引用,`EXPECTED_ADR_REFS` 不變。

📅 2026-09-03 ① — **PR A3:Control Catalog + 文件一致性治理 + Milestone A 收尾(0.2.0)**

> **緣起**:優化方案 §7 + 不變量 I3 / I4 / I6;A2 交付後 Milestone A 最後一項。frozen base `5832d9ed7b57c471dcb1a298ddf9245100529bb4`,乾淨 worktree `feat/a3-control-catalog`;dirty main worktree 未讀未動(rev 2 provenance 原則:兩條 A1 defer 由已 commit 證據重建)。plan 走 supervisor 4 輪(trigger 陣列、CI-011/012 與 step 同 commit、不讀 dirty main、baseline gate 檔案集合與單一 `--base`、review 節奏改全範圍;rev 3 路徑精確化與 30 條計數;rev 4 `ciSetupSteps` root schema)。
> **改動**:**33 檔 / 22 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count base..HEAD`,含本 entry 前全部非 bookkeeping)。P0 歸檔 A1.1 entry 到 `progress-archive/progress-2026-09.md` + `EXPECTED_ADR_REFS` 同 commit(現 10 處);P1 `scripts/control-catalog.json` 正本(fail-closed loader,root 只准三鍵、`ciSetupSteps` 為權威豁免清單)→ 渲染 `docs/CONTROL-CATALOG.md` → `check:catalog`(路徑 tracked、ci.yml 雙向鎖、渲染逐位元組一致)+ CI step;P2 OVERVIEW 16 處行號與兩處「8 個 step」改指 catalog;P3 `check:baseline-governance` + CI step(pull_request only、`--base=origin/$BASE_REF`、同 repo 傳 `--head`、promotion 豁免讀 merge-base 那側 config)+ ADR 限制 1-3 處置 + 長命分支清理程序 + CTRL-GOV-003;P4 A5.ci.if;P5 `harness.config` schemaVersion 2 + `mergeStrategy`,4.6 改宣告式、刪關鍵字 regex;P6 0.2.0 + CHANGELOG + MIGRATION(回滾只留整段 revert)。**out of scope**:掃描器語意、B/C 系列、A2 defer ①–⑩、worktree 清理。
> **驗證(最終 tip 實測)**:typecheck / lint / **23 檔 851 passed + 2 skipped**(`npx vitest run`;2 skipped = 鎖測試 adopted 分支)/ doc-refs / doc-size(progress 11473 bytes)/ todos / no-source-terms / adoption(TEMPLATE_MODE、3 exception)/ **catalog(CATALOG_OK — 30 controls、16 steps、setup 4)**/ hooks 全綠;`check:baseline-governance --base=<frozen base>` UNCHANGED。**mutation**:control-catalog **14/14**、baseline-governance **11/11**、adoption-readiness **20/20** 綁 `7ec6b9ef528a609b1611f9aef73b31ed7ea8fbbc`;source-term **29/29** 綁 `563a2ae`(其後未動該掃描器)。探針五次「存活 / 無法判定」全是探針或測試自身缺口(M10 A7、BG-M5 env、BG-M6 樣本漂移、BG-M10 等價突變、BG-M11 測試分支名),各補後全抓。
> **審查**:Codex commit-only 3 輪(r1 P2:MIGRATION 回滾不可執行;rereview P2:路徑 B 引用 0.1 不存在的檔 → 只留整段 revert;r2 PASS)。**Step 5 worktree 審 5 輪**(每輪新 clone、40 字元 review-tip):r1 **4 C + 11 I**(下游 template 舊值假紅、E-self 硬編 SHA、GitFlow base 錯、無名 step 偷渡)→ r2 **2 C + 10 I**(兩條都在 r1 修法內:巢狀 `name:` 遮蔽、`--head` 文法假紅)→ r3 **1 C + 8 I**(豁免政策從 PR tree 讀 → 改讀 merge-base)→ r4 **0 C + 8 I**(文件漂移為主)→ r5 **0 C + 4 I,收斂**(Owner 裁示:無 CRITICAL 即停)。共 **7 CRITICAL 全修**、41 INFORMATIONAL 修 20、defer 21。cross-model agreement ≈ 0 再次驗證。
> **⭐ 教訓**:①**每一輪 CRITICAL 都出在前一輪的修法裡**(r2 兩條、r3 一條)——教訓⑥「修法自己長面」是本 sprint 主旋律;r3 那條(豁免名單從被守的 tree 讀)是「守門與被守物同源」的形狀,值得寫成 SOP 自檢句:「這個 gate 的政策來源,PR 改得到嗎?」②**gate 要在 `git add` 之後跑**:P6 的 T9 綠是因為 CHANGELOG 還沒 tracked;未 tracked 檔不在位置＋數量鎖內。③**探針 spec 是原始碼逐字樣本**,改碼後 mutate fail-closed 抓到三次漂移——正確運作,但要把「改碼 → 對 spec」放進 phase checklist。④**等價突變要辨識**(BG-M10 前一行已回 error,改壞無效);「存活」先問是不是等價,再補測試。
> **defer 清單**:TODOS P3「A3 Step 5 defer 集合」21 條(含 I3 模板自身 if 行、F-1 protectedBranches 擴大無警示、r5 #2–#4 訊息與測試覆蓋)。
> **⏭️ 下一棒候選**(hint 非 truth):A. Milestone B — B1 agent-neutral policy 與薄 adapter;B. TODOS P2#2 `DELIVERY_REFS=HEAD` / P2#3 mutation spec 漂移 CI 守門(本 sprint 三次踩到,實證有需求);C. A2 defer ①–⑩ + A3 defer 集合;D. Owner 打 `v0.2.0` annotated tag(merge 後)。
> **check:claims 逐條處置**:命中 29 處(CONTROL-CATALOG 6 / renderer 5 / loader 4 / json 3 / tests 4 / 其餘),**全部留 A**(「唯一正本」= I4 設計、「ID 唯一」= loader 驗、「沒有任何硬編 step 名」= grep 可證、「唯一輸入 --base」= argv 白名單、`never` 為 TS 型別、其餘為測試名 / 歸檔原文)。
> 📊 成本:CC ~14h / plan supervisor 4 輪 + Codex 3 輪 + Step 5 5 輪 + mutate 12 輪 / P1 0 / P2 2 / **Step5 獨立發現 48 個**(7 CRITICAL、41 INFORMATIONAL;修 27、defer 21)
> 📐 量測:主迴圈 claude-fable-5-1 effort low;Codex gpt-5.6-terra medium;baseline SHA `5832d9ed7b57c471dcb1a298ddf9245100529bb4`;來源分佈:既有缺陷 0・漏改 consumer 4(OVERVIEW 第二處 step 表、mutations README、CHANGELOG 數字、TODOS 正文)・baseline 後引入 44(其中 3 條 CRITICAL 由前一輪修法引入)
> **7 步 checklist**:1 ✅(rev 4)/ 2 ✅ supervisor 核准 / 3 ✅ P0–P6 每 phase 全綠 / 4 ✅ Codex r1–r2 收斂 / 4.5 ✅ 高風險車道,探針每輪重跑、最終綁 `7ec6b9e…` / 4.6 ✅ 未觸發 / 5 ✅ 五輪、r5 收斂(Owner 裁示)/ 6-7 待執行

---

> 以下三 entries 於 2026-09-03 P2#3 defer ①② sprint Step 7 歸檔(主檔 26.0 KB / 20 KB 上限,doc-size CI gate 已觸發)。歸檔前主檔含 2026-09-02 ② 與 ③ 兩 sprint entry 加 hi5 交棒紀錄;歸檔後主檔保留最近 3 條(2026-09-03 ①②③)。三 entries 依主檔原本序追加(hi5 → 2026-09-02 ③ → 2026-09-02 ②)。

## 🤝 hi5 交棒紀錄 — 2026-09-02 20:14
- 交棒時 commit:`2ed1be1cf4bca2da3ac0c260cd25928122f0149e`(main;PR #46 squash;工作樹乾淨、無 WIP)
- 交接檔:`_handoffs/HANDOFF.md`(本機檔,`.gitignore` 忽略)
- 暫停點:Milestone A 全部收尾(v0.2.0 + #45 + #46),無在途工作;下一棒由 Codex supervisor(Herdr w2:p8)拍板選 B1 / TODOS P2 / defer 集合

📅 2026-09-03 ② — **移除 `DELIVERY_REFS` env 通道(刻意的行為 / API 移除;交付證據唯一來源 = 受驗 origin/HEAD)**

> **緣起**:(#48) 落地祖先契約後,Step 5 r2 指出 env 通道是空操作(任一合法候選 X:anc(X) ⊆ anc(base),`git log base X` 集合不變);supervisor 拍板方向為移除、另 scope、附證明與回滾。plan 2 rev(rev 1 P2:lib「不讀 env」測試改 save/set/restore 單參數入口)。frozen base `ff4db7d`,worktree `feat/delivery-refs-removal`。
> **改動**:**15 檔 / 10 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count`)。lib 刪 env 解析、`SAFE_REF_RE`、`ref.*` 六個原因碼、祖先檢查;`resolveDeliveryRefs(git, declared)` / `resolveDeliveryRefsFromRepo(root)`,`process.env` 0 讀取;兩 consumer 對齊簽章(nst 掃描語意 0 diff,2 個註解 hunk);ci.yml 刪 workflow-level env 與 develop fetch 行;測試:lib 加「不讀 env」等價測試,兩 consumer 加逐位元「env 被忽略」e2e(含垃圾值),刪 env 相關 case;探針刪 DR-M1、加 DR-M9(偷讀 env 當 base);MIGRATION Unreleased breaking 段、CHANGELOG Removed、OVERVIEW、catalog locator、README、TODOS。
> **驗證(`ce3c44a` 實測)**:typecheck / lint;**25 檔 898 passed + 2 skipped**;check:mutation-specs OK(8 檔 96 條);catalog / doc-refs / doc-size / no-source-terms / adoption / hooks 綠;check:todos 以 MARKER_SELF_PR 綠。**mutation `delivery-refs.json` 8/8** 綁 `bea3b21`(Step 5 r1 在 `1e563eb` 獨立重跑亦 8/8);**`source-term-diff-scan.json` 29/29** 綁 `bea3b21`(其後 4 支 commit 只動測試註解 / 測試名 / 文件)。
> **審查**:Codex 全範圍 r1 P2(nst fixture 說明仍寫四條 fallback)→ rereview #2 P2(節標題 / A-e4 / makeRepo 註解同類殘留)→ rereview #3 P2(todos 反例註解、測試名「env 空」)→ **rereview #4 PASS**。Step 5 worktree 審 2 輪:r1 **0 C + 7 I**(順手修 5 條文件矛盾:CHANGELOG Changed、ci.yml 兩處、OVERVIEW 標題、MIGRATION、TODOS ④)→ r2 **0 C + 6 I**(又順手修 3 條 MIGRATION 句)→ r3 **2 C + 4 I**(兩條 CRITICAL 都在 r2 新寫的 MIGRATION 句)→ r4 **1 C + 5 I**(仍在 MIGRATION 新句)→ Owner 裁示停止遞迴:**刪掉整段換線 / GitFlow 指引、只留事實**,不再開輪。defer 2 條進 TODOS P3。
> **⭐ 教訓**:①**移除一個通道時,「說它存在」的每一句話都是 diff 的一部分**——Codex 三輪、Step 5 r1 抓的都是同類殘留(fixture docstring、節標題、反例註解、測試名、CHANGELOG 相鄰條目);移除類 PR 的 P0 要先 `grep -rn <名稱>` 逐處分類「刪 / 改現行 / 標歷史」列進 plan。②**INFORMATIONAL 不修就是不修,文件類尤其不能「順手」**:r1、r2 都是 0 CRITICAL,我順手修文件句,新句子每輪長出新 finding,r3 / r4 的 3 條 CRITICAL 全在我自己新寫的 MIGRATION 指引裡——Owner 已拍板的「無 CRITICAL 即停」我沒守,多燒 3 輪。修法是**刪掉指引**而不是再寫一版。
> **check:claims 逐條處置**:17 處命中全留 A(「唯一來源」= 契約字面 ×13;「沒有任何救援通道」= ci.yml 事實;「絕不」為既有測試名 / label)。
> 📊 成本:CC ~4.5h / plan 2 rev / Codex 4 輪 / Step 5 **4 輪**(後 2 輪是自找的)/ mutate 2 輪 / P1 0 / P2 3(全為文件契約漂移)/ Step5 獨立發現 25(3 CRITICAL 全在自己新寫的文件句、修 13、刪段解決 7、defer 2、既登錄 3)
> 📐 量測:claude-fable-5-1 effort low;Codex gpt-5.6-terra medium(w2:p8);來源分佈:既有缺陷 0・漏改 consumer 8(全為註解 / 文件)・baseline 後引入 17(其中 3 CRITICAL 由 r1 / r2 修法引入)
> **7 步 checklist**:1 ✅ rev 2 / 2 ✅ supervisor APPROVE / 3 ✅ P1–P4 / 4 ✅ Codex 4 輪 PASS / 4.5 ✅ 人工視同高風險(cso 路徑表空),探針 8/8 + 29/29 / 4.6 ✅ 未觸發 / 5 ✅ r4 後 Owner 裁示收乾 / 6-7 待執行

📅 2026-09-03 ① — **P2#2:`DELIVERY_REFS` 共用政策契約(`lib/delivery-refs.ts`,fail-closed、無 fallback)**

> **緣起**:TODOS P2#2(`DELIVERY_REFS=HEAD` / 本地 feature / 未合併 `origin/feature/x` 都能把未合併 `(#N)` 塞進 allowedPrs)。supervisor 拍板:只准 origin 正規 remote-tracking 交付 ref + 必須是權威 base 祖先 + 綁靜態 `deliveryBranches`(Q1)+ 移除 `origin/develop` / 本地 main fallback(Q2);plan 走 4 rev(rev 2 P1:origin/HEAD 權威 base 本身也受驗;rev 3 P2:`ref.undeclared` 專屬探針;rev 4:`base.unresolvable` 單測)。frozen base `2019f48`,worktree `feat/delivery-refs-remote-only`。
> **改動**:**13 檔 / 5 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count`)。`scripts/lib/delivery-refs.ts`:base 與 env 候選走同一支 `validateRef`(形狀 → 存在 → 正規 → 祖先 → 宣告),拒絕收集原因碼、refs 全空;兩 consumer 只接線,遇 `!ok` 印 stderr 後 exit 2;`check-no-source-terms.ts` 只動 allowedPrs 來源段(`git diff -U0` 5 個 hunk,掃描函式 0 diff)。fixture:兩 makeRepo 預設寫 config + bare origin + set-head main,`noOrigin` 給負對照;A-e1/e2/e3 改寫。catalog CI-008 / CI-009 登錄 lib 與 spec;ci.yml 註解、README、CHANGELOG [Unreleased] Changed、TODOS。
> **驗證(`b4069e2` 實測)**:typecheck / lint;三個相關測試檔 **240 passed**;**25 檔 910 passed + 2 skipped**(bookkeeping 前重跑);check:mutation-specs OK(96 條樣本無漂移);catalog / doc-refs / doc-size / no-source-terms / adoption / hooks 綠;check:todos 以 MARKER_SELF_PR 綠。**mutation `delivery-refs.json` 8/8** 綁 `b4069e28c6ed8d33a791ce7fb3b78095f7a77156`;**`source-term-diff-scan.json` 29/29** 綁 `52dbc7b`(其後該檔只刪一行孤立 docstring)。
> **審查**:Codex 全範圍 PASS(獨立 clone,lib 19/19、todos 45/45、nst 全綠)。Step 5 worktree 審 2 輪:r1 **0 C + 11 I**(順手修 4 條過時註解 + 1 條空字串診斷)→ r2 **0 C + 3 I 收斂**。defer 9 條進 TODOS P3。
> **⭐ 教訓 / 已知限制**:①**祖先契約下 env 通道是空操作**——通過驗證的候選必是 base 祖先,`git log` 集合 ⊆ base 的,永遠加不進新 PR 號;env 現在只剩「驗證會不會拒絕」的意義(r2 conf 9,登錄待 supervisor 決定是否整個移除)。②新 `process.exit(2)` 插在 `main()` 的 mkdtemp 之後,`finally` 清理不會跑(r2;登錄)。③修註解要修整段:r1 修了同一 step 兩行,上方矛盾的兩行留著被 r2 抓。
> **check:claims 逐條處置**:2 處命中留 A(lib 檔頭「沒有任何 ref」= 契約字面;測試註解「只有 main」= fixture 字面)。
> 📊 成本:CC ~4h / plan 4 rev / Codex 1 輪 / Step 5 2 輪 / mutate 3 輪 / P1 0 / P2 0 / Step5 獨立發現 14(0 CRITICAL、修 5、defer 9)
> 📐 量測:claude-fable-5-1 effort low;Codex gpt-5.6-terra medium(w2:p8);來源分佈:既有缺陷 0・漏改 consumer 5(ci.yml 註解 ×3、todos 檔頭、nst docstring)・baseline 後引入 9
> **7 步 checklist**:1 ✅ rev 4 / 2 ✅ supervisor APPROVE / 3 ✅ P1–P5 / 4 ✅ Codex PASS / 4.5 ✅ 人工視同高風險(cso 路徑表空),探針 8/8 + 29/29 / 4.6 ✅ 未觸發 / 5 ✅ r2 收斂 / 6-7 待執行

📅 2026-09-02 ③ — **P2#3:mutation spec 樣本漂移 CI 守門(`check:mutation-specs` + CTRL-CI-013)**

> **緣起**:TODOS P2#3(前兩 sprint 內 spec 漂移被 mutate fail-closed 抓 4 次、都在收尾才發現)。supervisor 拍板只做 P2#3、單獨一支 PR;frozen base `7c4f0a35872de42a103d7ca5d9ed14aec53ae7b7`,worktree `feat/mutation-spec-drift-gate`。plan rev 2 通過(rev 1 P1:spec 檔本身要先過 `checkTarget` 再讀 bytes)。
> **改動**:**10 檔 / 4 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count`)。`scripts/check-mutation-specs.ts` 只複用 `mutate.ts` 的 `checkTarget` / `parseSpecs` / `applyMutation`:spec 目錄 lstat 非 symlink 且 realpath 等於正規路徑;spec 檔與探針目標都用 checkTarget 回的 bytes 解析;exit 0 全對 / 1 DRIFT / 2 無法判定(untrusted 優先)。CI step「Mutation Spec Drift Check」+ catalog CTRL-CI-013 同 commit(現 31 controls / 17 steps);mutations/README、CHANGELOG [Unreleased]、TODOS P2#3 ✅。
> **驗證(`f32e512` 實測)**:typecheck / lint / **24 檔 880 passed + 2 skipped**;check:mutation-specs 對本 repo exit 0(7 spec 檔 88 條);catalog / doc-refs / doc-size / todos / no-source-terms / adoption / hooks 全綠;**mutation `mutation-spec-drift.json` 6/6** 綁 `f32e51237e83291fbd2285fdb895e4bfeba72beb`。
> **審查**:Codex 全範圍 r1 PASS(0 P1/P2,獨立 clone 重跑全部驗證)。Step 5 worktree 審 2 輪:r1 **1 C + 9 I**(C1:`isMain` 未 realpath,經 symlink 目錄呼叫時靜默 exit 0 = 守門自己 fail-open;修成兩邊 realpath + e2e ⑩;順手修 catalog degradation、TODOS 數字、temp dir 洩漏)→ r2 **0 C + 9 I 收斂**(Owner 裁示無 CRITICAL 即停)。defer 合計 15 條進 TODOS P3。
> **⭐ 教訓**:「fail-closed 守門」自己的入口(`isMain`)沿用 repo 慣例就繼承了 fail-open 形狀——`mutate.ts` / `check-control-catalog.ts` 同款,已登錄不在本 PR 動。新 checker 的第一條探針應該是「腳本根本沒跑」。
> **check:claims 逐條處置**:9 處命中全留 A(「只有人工重跑」為 TODOS 原文引述;「沒有任何 spec 檔」= length===0 字面;「每一條問題」= 陣列全部;其餘為測試名 / spec label)。
> 📊 成本:CC ~2.5h / plan 2 rev / Codex 1 輪 / Step 5 2 輪 / mutate 2 輪 / P1 0 / P2 0 / Step5 獨立發現 19(1 CRITICAL、修 4、defer 15)
> 📐 量測:claude-fable-5-1 effort low;Codex gpt-5.6-terra medium(w2:p8);來源分佈:既有缺陷 1(isMain 慣例)・漏改 consumer 0・baseline 後引入 18
> **7 步 checklist**:1 ✅ rev 2 / 2 ✅ supervisor APPROVE / 3 ✅ P1–P4 / 4 ✅ Codex PASS / 4.5 ✅ 人工視同高風險(cso 路徑表空),探針 6/6 / 4.6 ✅ 未觸發 / 5 ✅ r2 收斂 / 6-7 待執行

📅 2026-09-02 ② — **git-add-guard:`git add -A` 誤加工具產物的機器化守門(LESSONS ⚠️ 第 ≥4 次 → 升級階梯)**

> **緣起**:Owner 拍板(PR #45 merge 後):把 LESSONS ⚠️ [2026-08-29] 的規則寫進本 repo 並機器化。frozen base `80f76b8`(main = v0.2.0 + #45),直接在主 worktree 開 `feat/git-add-guard`(當時已無其他 worktree、工作樹乾淨)。
> **改動**:**13 檔 / 5 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count`)。三層:①`.gitignore` 列 `.codegraph` / `.gbrain-source` / `_handoffs`(**不加尾斜線**,symlink 才會被 ignore);②`code-pattern.sh` 第三個 SSOT `TOOL_ARTIFACT_PATTERN='(^|/)\.codegraph(/|$)|…'`,pre-commit 在**任何分支**、任意深度、檔 / 目錄 / symlink 皆擋,刪除放行以便清理;工具產物段用 `git diff --cached --name-only -z --diff-filter=d` 寫暫存檔(失敗即 exit 1)後 `read -d ''` 逐筆原始位元組比對;③`CLAUDE.md` §4.6 成文規則。`check-hooks.sh` 載入 + 冒煙第三個 SSOT;ADOPTION §4 / OVERVIEW / LESSONS / catalog CTRL-HOOK-001 同步。
> **驗證**:typecheck / lint / **23 檔 856 passed + 2 skipped**;`check:hooks`(三個 pattern)/ catalog / doc-refs / doc-size / no-source-terms / adoption / todos 全綠;`tests/check-hooks.test.ts` 18 條(含真 `git commit` 行為級:非 ASCII、TAB、symlink、巢狀、`rm --cached` 清理放行、`.gitignore` 第一道 `add -A` 正對照)。**mutation `git-add-guard.json` 7/7** 綁 `875b015e089c04b8ea9066c287ac33d606698e4a`。
> **審查**:Codex commit-only 4 輪(r1 P2 檔頭「兩個 pattern」;r2 **P1:`core.quotePath=false` 只解高位元、TAB / LF 仍 C-quote → 繞過**;r3 / r4 PASS)。Step 5 worktree 審 3 輪:r1 **2 C + 8 I**(C1 quotePath 非 ASCII 繞過、C2 刪除也被擋封死清理路徑)→ r2 **1 C + 5 I**(C1 修一半,`"` / `\` / TAB 仍繞過 = Codex P1 同形狀)→ r3 **0 C + 7 I 收斂**(順手修 F2 fail-open、F3 測試斷言、F7 用語)。共 3 CRITICAL + 1 P1 全修;登錄 F1 LF 路徑誤擋(安全方向)、F4 BSD grep locale、F5 測試 gitc 未切 global config、F6 訊息拆行、F6(r2)巢狀冒煙為刻意升級訊號。
> **⭐ 教訓**:①**「修一半」比不修更危險**——r1 用 `quotePath=false` 修 C1,只覆蓋了 fixture 用的中文檔名;Codex 與 Step 5 r2 各自獨立用 TAB / `"` 打穿。修 encoding 類問題要拿**規格**(git 文件:引號 / 反斜線 / 控制字元不論設定一律跳脫)驗,不能拿一個樣本驗。②**目錄假設會在 symlink 上同時打穿兩道**(`.gitignore` 尾斜線 + pattern 尾 `/`);兩道防線用同一個假設就不是縱深。③process substitution 在 `set -e` 下是 fail-open 形狀——gate 讀外部指令輸出要落地並檢查 exit code。
> **⏭️ 下一棒候選**(hint 非 truth):A. Milestone B1;B. TODOS P2#2 / P2#3;C. A2 / A3 defer 集合(含 protectedBranches 擴大警示)。
> **check:claims 逐條處置**:命中以 pre-commit / code-pattern.sh 註解與測試名為主,留 A(「任何分支」「一律」是 hook 實際行為;「唯一」為 SSOT 設計)。
> 📊 成本:CC ~3h / Codex 4 輪 + Step 5 3 輪 + mutate 5 輪 / P1 1 個 / P2 1 個 / Step5 獨立發現 20 個(3 CRITICAL、修 10、defer 7)
> 📐 量測:claude-fable-5-1 effort low;Codex gpt-5.6-terra medium(新 pane w2:p8);baseline `80f76b858d1ffdfa902387dd62c6321575009c44`;來源分佈:既有缺陷 0・漏改 consumer 3(check-hooks 檔頭、ADOPTION §4、OVERVIEW)・baseline 後引入 17(其中 2 CRITICAL + 1 P1 由 r1 修法引入)
> **7 步 checklist**:1 ✅(Owner 口頭 scope,無 plan file——小型 governance PR)/ 2 ✅ / 3 ✅ / 4 ✅ Codex r1–r4 / 4.5 ✅ 高風險車道(hooks),探針 7/7 / 4.6 ✅ 未觸發 / 5 ✅ r3 收斂 / 6-7 待執行

