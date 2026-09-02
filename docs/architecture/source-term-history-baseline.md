---
title: 去識別化掃描的 history baseline cutover
type: adr
status: accepted
related: scripts/check-no-source-terms.ts / scripts/source-term-baseline.json / .github/workflows/ci.yml
---

# ADR:去識別化掃描的 history baseline cutover

> 本檔是 `check:no-source-terms` 之 history 掃描範圍的 **canonical 設計正本**。
> CI workflow、baseline config、測試檔內的相關註解一律**指回本檔的穩定標題**,
> 不各自摘要(摘要會漂移)。

## 決策

`scripts/check-no-source-terms.ts`(下稱 checker)的 **history blob 掃描**只掃
`baseline..HEAD`;baseline 及更早的 blob 一律 grandfather。baseline 值放在
machine-readable 的 `scripts/source-term-baseline.json`(`schemaVersion` + SHA)。

**問題**:模板主線的 current tree 與多個歷史 blob 都含來源專案識別詞。
去識別化屬「非秘密」債務,為它重寫已公開的 git 歷史,成本高於風險;但 gate 掃全史,
只改 HEAD 不會轉綠 —— 主線因此**無法通過自己宣稱的 gate**。

**取捨**:用 machine-readable baseline 把「已公開的去識別化債務」明文 grandfather,
換取「不重寫公開歷史」與「新提交不降標準」。三件事**不因 baseline 而放寬**:

1. **current tree 掃描永遠全量嚴格**——但限**文字檔**:`git grep` 走 `-I`,
   含 NUL 的 tracked 檔會被當 binary 跳過(見〈已知限制〉第 8 條)。baseline 影響不到。
2. **commit 訊息 + 作者掃描**照既有政策全史嚴格,與本地 `commit-msg` hook 對齊。
3. `baseline..HEAD` 內**每個 commit 相對 first parent 的 diff 新增行**仍嚴格擋。
   採 per-commit 而非淨 diff,是為了擋洗白:同一批改動先加後刪,淨 diff 乾淨、
   per-commit 仍抓得到加它的那個 commit。

baseline 值本身經三道檢查,任一失敗一律 fail-closed(exit 非 0,不靜默降級):
40 字元 hex、`rev-parse` 解得開、是 `HEAD` 的祖先。

## 政策邊界:source-term 掃描 vs gitleaks 秘密掃描

**兩條獨立政策,只是共用 CI job,不是政策合流。**

| | source-term(去識別化) | gitleaks(秘密) |
|---|---|---|
| 掃描範圍 | current tree 全量;history 為 `baseline..HEAD` | **全史,無 grandfather** |
| 有無 baseline | 有(本 ADR) | **無,且不得套用** |
| 理由 | 識別詞是非秘密債務,可用 cutover 管理 | 密鑰洩露隨時是 blocker |

文件不得把兩者合稱「全史無洩漏」——那會讓讀者以為秘密掃描也有 grandfather。

## 掃描範圍與三種 repo 情境

baseline 值支援兩種語法,對應三種行為:

| 情境 | config 值 | checker 行為 |
|---|---|---|
| 本模板自身 | `template:<40-hex>` 且該 SHA 解得開 | 走 `baseline..HEAD` 嚴格 diff 掃描 |
| 下游 fork(GitHub Template 新歷史,不含該 SHA) | `template:<40-hex>` 但 `rev-parse` 失敗 | 印 warning,**降級為全史掃描**(baseline 視為 null);current tree 與 commit 訊息掃描**照常執行** |
| 下游自訂 / 未設 | 純 40-hex、`null`,或 config 檔不存在 | 純 SHA → `baseline..HEAD`;null 或缺檔 → 全史掃描(向下相容) |

**shallow clone**:若 `template:` 前綴的 SHA 解不開**且**當前是 shallow clone,
checker **拒絕降級、直接 fail-closed**。理由:此時無法區分「下游新歷史真的沒有這個
commit」與「合法 SHA 落在 shallow 邊界之外」;誤降級只掃 shallow suffix,洗白場景會漏抓。
修法是用 `fetch-depth: 0` 拉全史,或改成本 repo 的 initial commit SHA。

## baseline 變更授權

baseline 是**治理決策,不是隨手翻的常數**。

- 修改 `scripts/source-term-baseline.json` 必須走 PR + Owner 拍板。
- **不得**為了讓 CI 轉綠而推進 baseline、刪 denylist 條目、放寬 allowlist 或改 gitleaks。
- **不得**在「修這個 gate 的同一個 PR」裡順手降低它的標準。

⚠️ 目前**沒有機器守門**擋「同一個 PR 內推進 baseline」——見〈已知限制〉。

## 導入步驟(下游採用者)

1. 開箱即用:不建 `scripts/source-term-baseline.json` → checker 走全史掃描(舊行為)。
2. 你的 repo 若有無法清除的歷史債務,把該 debt 之後的 commit SHA(完整 40 字元)
   寫進 config 的 `sourceTermHistoryBaseline`,**去掉 `template:` 前綴**。
3. 明示「就是要全史掃」→ 把值設成 `null`。
4. 用不到去識別化 gate → 連同 `scripts/deny-terms.txt` 與 CI step 一併移除。
5. CI 需要全史:`actions/checkout` 設 `fetch-depth: 0`。

schema / loader / validator 定義在 `scripts/check-no-source-terms.ts`
(`parseBaselineConfig` / `validateBaseline` / `BASELINE_SCHEMA_VERSION`)。

## 效能與 scale 契約

history diff 掃描的成本會隨 `baseline..HEAD` 的 commit 數成長,而 baseline 又不能
為效能推進,所以掃描實作必須守住四條**與實作無關**的不變量:

- **INV-1** 每個 rev 的 patch **全域最多被提取一次**(不分 pathspec view、不分 policy)。
- **INV-2** 每個 rev **恰好被交給 patch producer 一次**(無漏、無重、無額外)。
- **INV-3** 三組 policy(main×non-CA、main×CA、syntax×non-CA)**由同一份 per-rev
  extraction 分桶**,不得為任何一組另產 patch。
- **INV-4** subprocess 不得回退成每 rev 多倍乘法。

patch producer 的 stdout **接檔案 fd、不經有上限的記憶體 buffer**,消費端逐行串流,
記憶體不隨單一 patch 或整批的**位元組總量**成長。這一點是必要的:pathspec 過濾在 JS 端做,
所以串流會包含後來才被排除的路徑(例如 lockfile 的大量 churn);若走有上限的
記憶體 buffer,一個**只動豁免路徑**的大 commit 就會讓 gate 轉紅——政策豁免的改動
被判紅是 false-red。排除路徑的**超長單一邏輯行**另外由增量丟棄擋住。
代價是暫存檔佔用磁碟(而非記憶體),用完即刪。

⚠️ **界線**:記憶體用量不隨 patch 或整批的位元組總量成長,但**仍隨「單一邏輯行」的長度
成長**——屬於任一掃描桶的內容不能丟(丟了就是漏掃),所以被掃路徑的超長單行沒有有界的
串流處理方式。見〈已知限制〉第 7 條。

守門測試在 `tests/check-no-source-terms.test.ts`(PATH shim 觀測實際 subprocess:
呼叫預算、rev multiset 覆蓋、批次互斥、三類斜率、POSIX ERE 未被換掉)。
測試中標為 *implementation test* 的條目綁當前實作,**不是政策**。

## hit framing:未知引用不得被丟掉

CA(context-aware)判定只對「hit 的內容」做 self-PR 放行,所以**內容怎麼從 hit 取出來
是安全相關的**。三種掃描產出的 hit 框架不同:

| 掃描 | 框架 | 取內容的方式 |
|---|---|---|
| working tree / 全史 tree | `git grep -z -n` 的 `path<NUL>行號<NUL>內容`(**兩個 NUL**,實測 git 2.50.1) | 用**第二個 NUL** 切;沒有第二個 NUL 時保守保留整段 |
| `baseline..HEAD` diff | `<rev8> [+diff] <content>` | 只剝掉前綴;content 內的位元組(含 NUL)**全部是資料** |
| commit 訊息 | `<行號>:<內容>` | 整行即內容(strict 模式不解析) |

**不變量**:框架由產生 hit 的那一端宣告,消費端**不得從內容推斷**。

理由是兩條可達的假放行:

1. diff hit 的內容若含 NUL,把它當成 grep 的檔名分隔符會讓 NUL 之前的部分被丟掉。
   一行同時含未知號與合法 self-PR 號時(未知號在前),未知號就消失了、只剩合法號
   送進判定 → 放行 → 「先加後刪」的洗白序列整段變綠。
2. `git grep -z -n` 的內容前面有**兩個** NUL,不是「一個 NUL + 冒號」。用第一個
   冒號切內容,會把內容裡冒號之前的部分整段丟掉;`未知號 ref: 合法號` 這種行
   只剩後半 → 同樣放行。

**取內容的方向一律選「多保留」**:留太多最多造成誤擋(看得到、查得出來);
切太少會讓未知引用消失 → 假放行(看不到、查不出來)。

## 長命 pre-baseline 分支的清理程序

適用:分支從 baseline **之前**分出、在 baseline **之後**才要合併或清理,且它帶著 grandfathered
的識別詞(對 pre-baseline parent 的 diff 會把 grandfathered 內容標成 add,造成**誤紅、非漏抓**)。

1. **先 rebase 到 post-baseline 主線**(`git rebase <delivery-branch>`),讓每個 commit 相對
   first parent 的 diff 只含本分支真正的新增行;rebase 後照常開 PR,gate 依 per-commit 語意判定。
2. rebase 不可行(歷史需保留)時,由 Owner 依〈baseline 變更授權〉推進 baseline —— 那是獨立
   的 baseline PR,受 CTRL-CI-012 機器守門(只准動 config / 本 ADR / bookkeeping、新值須為
   merge-base 祖先且為舊值後裔),**不得**與清理 PR 合併在同一支。
3. 兩條路都走不通 → 在 PR 描述明列誤紅的 hit 與其 grandfathered 來源(rev 前 8 碼),交
   Owner 用 admin override 合併;這是 CTRL-CI-009 的 bypass 路徑之一,必須留紀錄。

本程序**不修改掃描器**;誤紅方向的限制以程序承接,漏抓方向(第 8 條)另案。

## 已知限制

1. **diff hit 缺精確 `file:line` attribution** —— hit 只帶 rev 前 8 碼與內容片段。
   要精確定位需要更完整的 patch 解析。**處置(PR A3):屬診斷精度限制、不影響判定;
   登錄於 control catalog 的 CTRL-CI-009 `notes`,無排程修復**(改顯示格式會動到 hit
   framing 契約與既有探針,為診斷精度承擔那個面不划算)。
2. **同一 PR 內推進 baseline 的治理旁路** —— 上一節的授權規則靠人。**處置(PR A3):
   由 CTRL-CI-012「Baseline Governance Check」機器守門**(`scripts/check-baseline-governance.ts`,
   pull_request only):baseline 值改變時,PR 只准動本 config、本 ADR 與 bookkeeping allowlist,
   且新值必須是 merge-base 的祖先(不得指向本 PR 內任何 commit)並為舊值的真後裔。人工授權段
   (CTRL-GOV-002)不變。
3. **long-lived pre-baseline 分支的 cleanup 誤報** —— 在 first-parent 語意下,
   從 baseline 之前分出、之後才合併的長命分支做清理時可能誤紅。**處置(PR A3):不改掃描器**
   (混合掃描策略是架構級變更);改為明文程序,見下方〈長命 pre-baseline 分支的清理程序〉,
   登錄為 CTRL-GOV-003(manual-mandatory)。
4. **全史掃描路徑(baseline 為 null / 下游降級)的 subprocess 成本未最佳化** ——
   該路徑對每個 rev 跑 2-3 次 `git grep`(non-CA、CA,SYNTAX 例外檔存在時再一次)
   加最多 3 次 `cat-file -e`,成本隨歷史線性成長。
   `baseline..HEAD` 路徑的最佳化**沒有**套用到它。**目前沒有指派給任何後續批次。**
5. **文件引用檢查的覆蓋缺口** —— `scripts/check-doc-refs.ts` 只讀 `.md`,
   所以 CI workflow(`.yml`)、baseline config(`.json`)、測試碼(`.ts`)裡指向本檔的
   引用**不被該 checker 驗證**;改由 `tests/check-doc-refs.test.ts` 的位置 + 數量型
   契約守。章節錨點(`#anchor`)不被任何機器驗證,標題穩定性靠人工紀律。
6. **非 UTF-8 位元組** —— patch 以 UTF-8 讀取(與改動前相同),`--text` 強制輸出的
   非 UTF-8 位元組會變成替換字元。這不影響 ASCII 識別詞的比對。
7. **被掃路徑的單一超長邏輯行仍會整行進記憶體** —— 消費端逐行處理,一行就是記憶體
   上界。屬於任一掃描桶的內容不能丟(丟了就是漏掃),所以只有**排除**路徑的超長行走
   增量丟棄。若某個 post-baseline commit 在被掃路徑新增一條超過 Node
   `MAX_STRING_LENGTH`(v24 = 536870888)的單一邏輯行,history diff scan 會 throw、
   rc=2 → **false-red**(不是漏抓)。
   ⚠️ **這不是效能重構造成的迴歸**:重構前 `scanRevDiff` 用 `git show` 搭
   `maxBuffer: 256 MiB`,同樣情境在**更低**的門檻就會失敗;重構把界線從「整批
   256 MiB」放寬成「單行約 512 MB」。要徹底解除,需要把長行分塊寫進桶檔、
   不在 JS 內實體化整行。**目前沒有指派給任何後續批次。**
8. **tree 掃描跳過含 NUL 的 tracked 檔** —— working tree 與全史 tree 兩條路徑都用
   `git grep -nIiE`,`-I` 讓 git 把含 NUL byte 的檔當 binary 直接跳過。所以
   binary 檔即使含識別詞也掃不到。⚠️ 「baseline 之後新增的檔有 diff scan 的
   `grep -a` 兜底」**只在設了 baseline 的模式成立**;template-fallback 與
   no-baseline 兩種模式**完全不跑 diff scan**(走 `git grep` 的 tree scan),
   而 template-fallback 正是每個下游採用者開箱後的預設模式 —— 在那裡,採用
   之後新增並留在 tree 裡的 binary 檔一樣掃不到。這是**漏掃**方向的
   限制,不是誤擋。要解除就是把 `gitGrep` 改成 `-a`——那會同時動到兩條掃描路徑、
   需要自己的測試與探針,屬獨立一刀。**目前沒有指派給任何後續批次。**
9. **設了 baseline 會同時收窄「時間軸」與「可達性」兩個軸** —— 無 baseline 走
   `rev-list --all`(掃所有 ref);設了 baseline 走 `rev-list baseline..HEAD`。
   所以 baseline 之後、但**不從 HEAD 可達**的 commit(例:PR 關掉但分支還在的
   `origin/some-branch`)在 baseline 模式下掃不到。對「只交付 default branch」的
   模型這是可辯護的設計,此處明列以免讀者以為只 grandfather 了時間軸。

## Provenance

- baseline cutover 由交付 PR(squash subject 以「(井號+40)」結尾)落地。
  ⚠️ 這裡刻意**不寫**裸的「PR 井號+數字」字面:那是 CA(context-aware)pattern,
  而 working tree 掃描**不受 baseline 影響**。下游採用者的新 history 沒有該 squash
  subject、`allowedPrs` 不含此號 → 開箱第一次跑 gate 就會被自己的檔擋紅。
- 首次 baseline SHA:`641065227924184b058b3f64c1c9f9971a3a17b4`(當時的主線 HEAD)。
- 掃描實作的效能重構(〈效能與 scale 契約〉四條不變量)由後續的 A1 residual PR 落地。
  **diff scan 的語意未改變**(仍是 per-commit 相對 first parent 的新增行)。
  判定結果有**兩處刻意改變**,都是修掉〈hit framing〉那一節描述的可達假放行:
  ①含 NUL 的 aggregate diff hit 過去會讓未知 PR 引用被丟掉而放行;
  ②`git grep -z -n` 的真實輸出是 `path<NUL>行號<NUL>內容`(兩個 NUL),
  舊 parser 卻用第一個冒號切內容,於是「未知號 ref: 合法號」這種行只剩後半 →
  未知號消失而放行(工作樹與全史 tree 掃描都中,A1 起就存在)。兩者現在一律擋。
- 本 ADR 是 repo-local 正本;原始規劃文件在版控之外,不作為引用目標。
