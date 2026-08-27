---
title: EFFORT — 思考力道分層策略
type: guide
related: .claude/sop/plan-mode-checklist.md / .claude/settings.json / CLAUDE.md Part 2
---

# Effort 分層策略

> 本檔把「哪一步該用多少思考力道」明文化。
> 對應 Anthropic《Prompting Claude Opus 5》的 Effort 與 Thinking 兩節。

## 為什麼要分層

Opus 5 起，**effort 是成本與延遲的主要控制桿**，不是「品質旋鈕」。官方建議：

- 預設 `high`，然後**依自己的實測**往下調
- `low` / `medium` 要**大方用**——只要品質撐得住就該用
- `xhigh` 留給 demanding coding 與 agentic work
- **從前代模型沿用下來的 effort 預設值，要重跑一次 sweep**

對本 harness 特別重要的一句：**review 的準確度在較低 effort 仍然撐得住**
（原文：accuracy holds at lower effort settings, which supports a fast pass at
review time and a more thorough pass later）。Step 4 / Step 5 迭代到 0 findings
是整條流程最燒 token 的地方，這句話**支持你去嘗試較低 effort 的 fast pass**
——是不是真的省下來，要靠下面那組量測回答，不是直接假定。

⚠️ **但這句話講的是「模型單 pass 的準確度」，不等於「review 輪數由 effort 決定」。**
輪數還混著別的變因，其中一個容易被忽略：**修法本身可能新增待審表面**——
你為了修 round N 的 finding 而新加的東西（含 Step 4.5／4.6 觸發後才加的守衛），
round N+1 就得審它。這在不同專案的權重不一樣，**所以才要量**（見下）。
把「輪數多」直接歸咎於「effort 開太低」，是**還沒被驗證的假說**——別當結論用。

### 要做 sweep，先量對東西

上表說「跑幾個 sprint 後回來重校」——但**要重校就得先有資料**。至少記三項（見 SOP Step 5 寫 progress entry 時填）：

1. **每輪實際的 model ＋ API effort**（session 當下真正生效的值，**不是** `🎚️` 那個提示）
2. **baseline SHA**（送第一輪 review 前固定的那個。工作樹要乾淨、初始 patch 已 commit，
   否則記下的 SHA **根本不含**被審的 diff，那個 baseline 是假的）
3. **finding 來源分佈**，互斥三選一：

   | 分類 | 意思 |
   |---|---|
   | `初始 patch 內既有缺陷` | 缺陷的實作在 baseline 就在裡面 |
   | `初始 patch 漏改的外部 consumer` | baseline 沒碰到、但受這個不變量影響的別處 |
   | `baseline 後新增／修改引入` | 實作是 baseline 之後才長出來的（review fix、**也含 Step 4.5／4.6 新加的東西**） |

   **判準：依 finding 的「成因」分，不是依「你打算怎麼修」分**（依序套用，先中先算）：

   1. 這個 finding **由 baseline 之後的 patch 引入** → `baseline 後新增／修改引入`
   2. 初始 patch **改變了某個不變量，但遺漏既有受影響的 consumer** → `初始 patch 漏改的外部 consumer`
   3. 其餘由初始 patch 造成的缺陷 → `初始 patch 內既有缺陷`

   ⚠️ **不要用「修法會動到哪裡」分類**——同一個 finding 會因為你選不同修法而換類
   （例：漏改 consumer 時，回退 producer 只動原處、更新 consumer 就動到別處），
   那會直接污染 calibration 資料。
   ⚠️ **與本次 patch 無因果關係的純既有問題不列入這份分佈**（它們是另一回事）。
   每條只准歸一類；性質（security／test／docs…）另用 secondary tag。

沒有這三項，你只會得到「又是 N 輪」——那個數字**分不出「review 不夠深」和「diff 一直在長」**，
而這兩者的解法完全相反。

> ⚠️ **這三項目前是人工填、人工讀**：`npm run health:weekly` 的 collector 只解析
> rounds／P1／P2／Step5 獨立發現，**不讀**這三項。刻意不先機器化——依本模板的
> 「教訓升級階梯」，沒有資料就先做趨勢圖，等於生出看起來像量測其實不是的數字。
>
> **把它當成 3–5 個 sprint 的 calibration window**：跑完那幾個 sprint、有真實分佈了，
> 再決定 ⑴ 重校上面那張建議值表 ⑵ 要不要擴充 collector 把它機器化
> ⑶ 或者**看不到足以支持調整建議值的訊號**，就撤掉或重新設計這組量測。
> ⚠️ 幾個 sprint 的資料**既不能證實「輪數與 effort 有關」也不能證實「無關」**——
> 若期間 effort 根本沒變異，或任務規模／風險差太多，這批數字就控制不了那些混雜因素。
> **不要無限期手動標下去**——那是儀式稅。

## 兩條容易搞混的事

**① effort 不控制回覆長度。** effort 控的是「想多少」，不是「說多少」。
想讓回覆短，要在提示詞裡明講（CLAUDE.md Part 2 已有對應守則）。

**② 不要為了省錢關掉 thinking。** 見下方〈Thinking 一律保持開啟〉。

## 每步建議值

| SOP 步驟 | 建議 effort | 理由 |
|---|---|---|
| Step 1 Plan | `high` | 計畫品質決定後面所有步驟；這裡省下的會在 Step 3 加倍付出 |
| Step 2 Confirm | `low` | 只是等批准 / 問取捨，不需要深想 |
| Step 3 Go（實作） | `xhigh` | 官方明列的 demanding coding 場景：多檔案功能、大型重構、端到端實作 |
| Step 4 跨模型 review 迭代 | `medium`（最後一輪 `high`） | 準確度在低 effort 撐得住；前面幾輪快掃，收尾那輪拉高 |
| Step 4.5 安全關 | `xhigh` | 觸發時代表碰到金流 / 個資 / 權限面，這裡不省。高風險車道的 mutation 探針是機械步驟（跑 `mutate.ts`），不吃 effort |
| Step 4.6 視覺關 | `medium` | 視覺比對靠工具（截圖、裁切、逐項對照）而非靠想；官方明講 **tool use 比純思考更划算** |
| Step 5 第二道 review | `medium` | 同 Step 4。高風險車道多加的 worktree 獨立審由 subagent 執行、繼承呼叫方 effort，不必為它調 session 值 |
| Step 6 Push + CI | `low` | 機械步驟 |
| Step 7 Final 收尾 | `low` | 通知 Owner、寫 LESSONS 若有新踩坑（**progress entry 在 Step 5 已寫、TODOS ✅ + PR 號 citation 在 Step 5/6 已寫**，均不在此步重複） |

> ⚠️ **上表是起點不是定論。** 官方要求「依自己的 eval 重跑 sweep」——
> 跑過幾個 sprint 後，若發現某步在較低 effort 就夠用（或反過來品質掉了），
> 就改這張表，並把觀察寫進 `.claude/memory/LESSONS.md`。

## ⚠️ 一個容易誤會的前提：`🎚️` 是提示，不是開關

主 session 同一時間只有一個生效的 effort。SOP 每步標的 `🎚️` 是**建議值／審查深度提示**，
而**本模板沒有把 SOP 步驟包成帶 `effort` frontmatter 的 skill**，所以那些標註**不會自動執行**。
它們的作用是：① 提醒 AI 自己配速 ② 告訴人「哪一步值得調高」。
**別讀成「harness 會自動幫我切」，也別以為改了那行字就改了成本或速度。**

Claude Code 實際可以改 effort 的方式（官方 model-config 文件）：

| 方式 | 作用範圍 |
|---|---|
| `/effort`、`/model` 的 slider、`--effort` 啟動旗標 | 整個 session |
| `effortLevel`（settings 檔） | 專案／使用者預設 |
| `CLAUDE_CODE_EFFORT_LEVEL` 環境變數 | **最高優先——連 skill／subagent frontmatter 都蓋不掉它** |
| **skill frontmatter 的 `effort`** | 該 skill 執行期間覆寫 session 值（**未設上面那個環境變數時**） |
| **subagent frontmatter 的 `effort`** | 該 subagent 執行期間覆寫 session 值（**未設上面那個環境變數時**） |

⚠️ 具體後果：環境變數設 `low`、skill frontmatter 設 `xhigh`，實際跑的是 **`low`**。

> 💡 **所以 per-step effort 是做得到的**——把某個步驟包成一支帶 `effort:` frontmatter 的 skill，
> 或交給帶 `effort:` 的 subagent，那一步就會真的跑在你標的力道上。
> **本模板目前刻意沒做**（會把 7 步流程綁死成 7 支 skill，彈性反而變差）；
> 想要的人可以自己包，這是模板留給你的擴充點，不是平台限制。

### 切換本身有成本（prompt cache）

- **改 effort 會讓 message cache 失效。**
- **換 model 更貴：cache 是按 model 分隔的，換了就沿用不到前一個 model 的 cache prefix。**

程度不同：**改 effort 至少讓 message prefix 失效**（tools／system 那層是否一起失效依模型而異）；
**換 model 則是整段 prefix 都沿用不到**。context 大的 repo（原始碼 ＋ 幾份長期記錄檔）
換一次 model 等於重新付費讀一遍——**在追求「更快」的時候切模型，方向是相反的**。

> **結論：主迴圈維持單一模型。** 某一步真要用別的模型，開 subagent，不要中途切主迴圈。
> 頻繁微調 effort 也一樣——省下的思考成本可能被 cache 重建吃掉。

## 怎麼設

**專案預設**：`.claude/settings.json` 的 `effortLevel`。本模板出貨值是 `high`
（＝ Opus 5 原生預設，等於不改變行為，只是把這個旋鈕**顯式化**讓你知道它存在）。

**單次調整**：session 內臨時升降，不改檔。

**分層建議**：
- 以文件、研究、規劃為主的 repo → 全域 `high` 或 `medium` 就夠
- 以實作為主的 repo（本 harness 的主場）→ 專案層設 `xhigh`，
  review-heavy 的 sprint 再臨時降到 `medium`

## Thinking 一律保持開啟

Opus 5 預設 thinking 開啟，且**只能在 effort `high` 以下才關得掉**。
關掉會出現兩個實際故障（不是理論風險）：

1. **Tool call 變成純文字**——模型把工具呼叫寫進給人看的回覆裡，那個呼叫
   **不會執行**，而且在 agentic loop 裡這段文字會留在對話史，**污染後面每一個 turn**。
   官方特別指出這在**工具密集的流程最常發生**——本 harness 正是這種流程。
2. **內部 XML tag 洩漏進輸出。**

官方對兩者的首選對策是同一句：**保持 thinking 開著，用 effort 控成本**。
原文：對多數任務而言，「thinking 開啟 + `low` effort」比「thinking 關閉」
在相近成本下表現更好。

**本 harness 的守則**：不要關 thinking。要省成本就降 effort。
另外——**不要在 CLAUDE.md 或任何提示詞裡寫「不要思考」「不要推理」之類的規則**，
官方明講那種指令會**增加** tag 洩漏。

## 導入 checklist

- [ ] `.claude/settings.json` 的 `effortLevel` 對齊你的 repo 型態
- [ ] 跑 3-5 個 sprint 後回來重校上面那張表（官方要求的 sweep）
- [ ] 把「哪一步降 effort 後品質掉了」寫進 LESSONS.md——這是 effort 這條旋鈕的專屬教訓區
