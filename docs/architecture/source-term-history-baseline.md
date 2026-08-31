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

1. **current tree 掃描永遠全量嚴格**,baseline 影響不到。
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

守門測試在 `tests/check-no-source-terms.test.ts`(PATH shim 觀測實際 subprocess:
呼叫預算、rev multiset 覆蓋、批次互斥、三類斜率、POSIX ERE 未被換掉)。
測試中標為 *implementation test* 的條目綁當前實作,**不是政策**。

## 已知限制

1. **diff hit 缺精確 `file:line` attribution** —— hit 只帶 rev 前 8 碼與內容片段。
   要精確定位需要更完整的 patch 解析。**已指派後續 control catalog 批次處理。**
2. **同一 PR 內推進 baseline 的治理旁路** —— 上一節的授權規則目前靠人,沒有機器守門。
   **已指派後續 control catalog 批次處理。**
3. **long-lived pre-baseline 分支的 cleanup 誤報** —— 在 first-parent 語意下,
   從 baseline 之前分出、之後才合併的長命分支做清理時可能誤紅。
   **已指派後續 control catalog 批次處理。**
4. **全史掃描路徑(baseline 為 null / 下游降級)的 subprocess 成本未最佳化** ——
   該路徑對每個 rev 各跑 2 次 `git grep` 加最多 3 次 `cat-file -e`,成本隨歷史線性成長。
   `baseline..HEAD` 路徑的最佳化**沒有**套用到它。**目前沒有指派給任何後續批次。**
5. **文件引用檢查的覆蓋缺口** —— `scripts/check-doc-refs.ts` 只讀 `.md`,
   所以 CI workflow(`.yml`)、baseline config(`.json`)、測試碼(`.ts`)裡指向本檔的
   引用**不被該 checker 驗證**;改由 `tests/check-doc-refs.test.ts` 的位置 + 數量型
   契約守。章節錨點(`#anchor`)不被任何機器驗證,標題穩定性靠人工紀律。
6. **非 UTF-8 位元組** —— patch 以 UTF-8 讀取(與改動前相同),`--text` 強制輸出的
   非 UTF-8 位元組會變成替換字元。這不影響 ASCII 識別詞的比對。

## Provenance

- baseline cutover 由 PR #40 落地(squash merge 進主線)。
- 首次 baseline SHA:`641065227924184b058b3f64c1c9f9971a3a17b4`(當時的主線 HEAD)。
- 掃描實作的效能重構(〈效能與 scale 契約〉四條不變量)由後續的 A1 residual PR 落地,
  掃描語意與判定結果未改變。
- 本 ADR 是 repo-local 正本;原始規劃文件在版控之外,不作為引用目標。
