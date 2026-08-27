---
title: Plan Mode 7 步流程 Checklist
type: sop
related: CLAUDE.md Part 2「Plan Mode 流程規則」 / docs/DEGRADATION.md / docs/EFFORT.md
---

# Plan Mode 7 步流程 Checklist

> CLAUDE.md Part 2 用敘述體寫了 7 步流程,本檔把它 codify 成 markdown checkbox,
> 每個 phase 完成時 AI 在 progress.md 對應 entry 內勾起來,讓流程顯式可追。
>
> **使用方式**:
> 1. Plan mode 啟動時,在 plan file 內貼一份這個 checklist
> 2. Phase 進到下一步時勾上一步的 ✅
> 3. progress entry 寫入時,在 cost field 下方貼最終 checklist 狀態,作為「flow followed」證據
>
> **外部工具降級**:本流程引用的外部工具(Codex CLI、gstack skills、gbrain)都是
> **optional 依賴**——沒有時照各步驟的〔降級〕註記執行,流程骨架不變。
> 完整降級對照表見 `docs/DEGRADATION.md`。
>
> **思考力道(effort)**:每步標了建議值(`🎚️` 記號)。完整理由與調整方式見
> `docs/EFFORT.md`。三個要點:①effort 是**成本桿**不是品質旋鈕 ②review 的準確度
> 在較低 effort 仍撐得住,所以 Step 4/5 的迭代不必全程開滿(⚠️ 那句講的是**模型單 pass
> 的準確度**,**不等於**「輪數由 effort 決定」——見 `docs/EFFORT.md`) ③**不要關 thinking**,
> 要省成本就降 effort(關掉會讓 tool call 洩漏成純文字並污染後續 turn)。
>
> 🔴 **`🎚️` 是提示不是開關**——本模板沒有把步驟包成帶 `effort` frontmatter 的 skill,
> 所以它不會自動執行(Claude Code 本身支援 skill／subagent frontmatter 覆寫 effort,
> 是模板沒用、不是做不到)。另外換 model 有 prompt cache 成本。細節見 `docs/EFFORT.md`。
>
> **委派上限**:本流程只有 Step 1 與 Step 5 會用到 subagent,兩步都標了上限。
> 委派規則本身見 CLAUDE.md 原則 5.5,這裡不重複。定義好的 agent 在 `.claude/agents/`。

## 適用範圍 — 完整 SOP vs docs-only

**預設:一律跑完整流程**(含 Step 4 跨模型 review + Step 5 fresh review),**不跳**。
docs-only 是**唯一、且窄**的例外;**判不準 = 當非文件、跑完整 SOP**。

**判定靠「意圖／內容」不靠路徑 glob**(glob 永遠補不完,改名／新路徑就漏)。

✅ **算 docs-only(可只跑 Step 5 fresh review、略過 Step 4 跨模型)** — 需**同時**滿足三條:
1. 本次 PR 的**每一個檔**都是「純給人讀的說明文字」,**且沒有任何 code / 設定 / SQL /
   腳本 / build 會去消費它**(典型:`.claude/memory/**` 的純散文 checkpoint、純散文
   交接檔、不被 app build 的純說明 markdown)。
2. **不是 spec / 政策 / 安全文件**(見下方 🔴)。
3. **不含**上面以外的任何檔(混合即非文件,見判定單位)。

🔴 **一律跑完整 SOP(含跨模型)——不論副檔名或路徑:**
- **spec / 決策 / 計畫**:任何「code 之後要照抄」的文件——**所有 ADR**(不論放在哪、
  不論改名)、design doc、plan、可執行 spec。
- **安全 / 權限 / 部署 ops**:任何談 auth / 權限 / 威脅模型 / migration 步驟 / env 設定
  / 部署程序的文件(含 HTML runbook)。
- **專案治理**:`CLAUDE.md`、`.claude/sop/**`、`docs/` 底下的策略檔(例如 SECURITY /
  THREAT_MODEL / BRANCH_PROTECTION 這類命名的檔),以及 `.claude/memory/LESSONS.md`
  裡的 SOP / 安全規則段。**(專案可對照替換自己的治理檔名。)**
- **任何非純說明檔**(常見範例、非窮舉;判不準從嚴):產品碼(`src/**`)· SQL / migration
  · 守門腳本(`scripts/**` 含 `git-hooks/**`)· CI / 設定(`.github/**`、`**/*.config.*`、
  `**/package.json`、`**/tsconfig*.json`、lockfile、`.claude/settings*.json`、`**/.env*`)
  · 測試碼與測試支援(`**/*.test.*`、`**/*.spec.*`、`**/test/**`)。
- **碰安全邊界(auth / migration / 守門)者,Step 4/5 絕對不可跳。**

**判定單位 = 整個 PR / 待 ship 的完整 diff**(不是單一 commit)。PR 內只要有一個
非 docs-only 檔,**全 PR 跑完整 SOP**。不可把 code 改拆進「docs PR」、或在 PR 內
切「純 docs commit」規避跨模型審。

**docs-only 仍必須**:fresh review 對任何技術陳述 **verify against ground truth**;
本地 gate 與 CI checks(lint / typecheck / test / build,依專案實情替換)照綠;
Step 6/7 收尾照走。

**理由**:純說明文字、無 spec / 安全意涵時,跨模型把關邊際價值低,fresh-context +
事實查核已足。但 ADR / 安全 / 策略文件屬 spec → 這條線上一律完整 SOP。

### 風險車道對照表(既有機制的地圖,不新增流程)

| 車道 | 判定 | 流程差異 |
|---|---|---|
| 輕(docs-only) | 本節上方判準(意圖判定,判不準從嚴) | 略 Step 4 跨模型,跑 Step 5 fresh review |
| 標準 | 預設(非 docs-only、安全關未觸發) | 完整 7 步 |
| 高風險 | `npm run check:cso` 判 `CSO_REQUIRED`,或人工視同(機器判定是下限不是上限,見 Step 4.5) | 完整 7 步 + Step 4.5 安全審 + 兩項加強:破壞性探針、Step 5 worktree 審查(見各步條目) |

三條車道**都是既有判準**,本表只把它們放進同一張地圖:風險越高,驗證強度越高
(對應治理架構常見的風險分級驗證矩陣精神)。輕車道的完整判準以上方「適用範圍」
為唯一正本,本表不重複敘述。

## Step 1:Plan(寫 plan file) 🎚️ `high`

- [ ] Plan file 寫在 `~/.claude/plans/*.md`(plan mode 強制)
- [ ] Context 段:為何做 / 觸發 / 預期結果
- [ ] 真實工作目錄(避免在 worktree 殼層工作)
- [ ] Phases 拆 atomic commits(每 commit 一個邏輯單位)
- [ ] 關鍵檔案列表(會改 / 會新建 / 讀過但不改)
- [ ] 驗證方式(end-to-end test plan)
- [ ] 風險與緩解
- [ ] 不在範圍(明文 OUT)
- [ ] Sensible Defaults(D1-DN,用原則 8 自證,讓 Owner 可逐條否決)
- [ ] 蒐 context 時用 `.claude/agents/explore-scoped.md`(最多 3 個,**通常 1 個夠**)
      ——唯讀偵察,回報 `path:line` 摘要而非貼大段程式碼。
      **能自己 grep 完的不要派 agent**;一個夠就不要開好幾個
- [ ] Plan 要**一次寫完整**(完整規格上前、然後放手跑):Opus 5 在「拿到完整任務規格
      再自己跑完」時表現最好,會把任務做完而不是留半成品。這條讓 Step 3 的中途打斷降到最低
- [ ] **盤爆炸半徑(impact radius)**:這一刀動到的**不變量**,它的所有 producer /
      consumer / 入口 / fixture / 操作文件在哪裡?寫成一小塊(不適用填 `N/A`,
      小改動就短短一行,不必做成大表):

      | 不變量 | producer | consumer／入口 | fixture／測試 | 操作文件 | 搜尋證據 |

      ⚠️ 這跟上面的「關鍵檔案列表」**不是同一件事**:那是**你打算改的檔**,
      這是**會被你的改動影響到的檔**。後者常常**不在 diff 裡**,
      而**只看 diff 的 review 抓不到它們**——那是容易漏的一類 finding
- [ ] **起手記憶對抗檢查**:候選主題定了之後、寫 plan 前,先 git 核實推翻 hint
      (記憶層 marker 是 hint 非 truth)。〔若有 gbrain:加跑 `find_contradictions`
      對候選主題抓記憶矛盾;無 gbrain 降級:純 git 核實並於 plan 揭露未做語意檢查〕

**STOP point**:**impact-radius 那一小塊要先寫完**;若 plan 內有真實取捨
(MVP vs full / 商業規則拍板)→ 提問;否則直接 ExitPlanMode 等批准。
**不要**問「plan 好不好」。

## Step 2:Confirm(等批准 / 釐清取捨) 🎚️ `low`

- [ ] 真實取捨用提問釐清(一次最多 3 題)
- [ ] 非關鍵決策走 D-numbering sensible default(原則 8)
- [ ] 沒提問需求時 → ExitPlanMode

**STOP point**:plan 通過才進 Step 3。

## Step 3:Go(atomic commits per phase) 🎚️ `xhigh`

- [ ] 切 feature branch 從開發主線(不直接動保護分支)
- [ ] Phase 0 housekeeping:確認 working tree clean、跑 dry-run / 預演
- [ ] 每 commit 一個邏輯單位(不混雜)
- [ ] Commit msg 用「類別:範圍 — 內容」格式(類別:功能 / 修復 / 重構 / 文件 / 工具 / 測試)
- [ ] 每個 phase 完跑 typecheck + lint + test 全綠 gate
- [ ] 動 DB schema → 跑對應 schema 一致性檢查〔L2:`stack/nextjs-prisma/scripts/check-prisma-schema-refs.ts`〕
- [ ] 跨檔大改 → 跑完整測試 suite 確認 0 regression
- [ ] ⚠️ **此階段不 push、不開 PR**(review 只讀本地 diff `git diff <主線>...HEAD`,
      先在本地審乾淨再公開;push + PR 移到 Step 6)。需備份可單純 `git push` 分支(不開 PR)
- [ ] 執行中浮現**真實取捨**(不同解讀會導出完全不同成果)→ 照
      `.claude/sop/decision-request-template.md` 整理後問 Owner;
      **浮上來 ≠ 停下來**,先做完不依賴答案的部分

**STOP point**:Health stack 任一項紅 → 修到綠才能下一步(原則 7「失敗要大聲說」)。

## Step 4:跨模型 Review(對手 model 找 bug,本地 diff、push 前) 🎚️ `medium`(最後一輪 `high`)

- [ ] **送第一輪之前先固定 baseline**:工作樹乾淨、初始 patch 已 commit,`baseline SHA = HEAD`
      (工作樹髒時記下的 SHA **根本不含**被審的 diff,那個 baseline 是假的;不想 commit
      就得另存 diff hash／bundle,只記 SHA 不算數)
- [ ] 對本地 diff 跑對手模型 review 一輪(**不需先 push**)
      〔預設:Codex CLI `/codex review`;無 Codex 降級:Claude Code 內建 `/code-review high`——
      失去跨模型多樣性,但仍是獨立 fresh-context 審查〕
- [ ] **`/codex review` 撞 exit 124(gstack skill 330s wrapper 撞牆)的 fallback**——**撞牆不等於不審**:
      retry 一次(可能真 API stall,gstack 上游建議)→ 再撞改跑 `/codex challenge <focus>`
      (600s wrapper,同一份 diff 換長 timeout)→ 再撞才切 Herdr codex pane(無 timeout)。
      **跳過分流、直接 Herdr 的判準**(預期會多輪深度或範圍大):
      預估 5+ 輪 review、修改 >6 個檔、或動 SECURITY DEFINER RPC/需並發連線 harness。
      **不建議直接改 gstack skill 的 330 常數**——會被下次 `/gstack-upgrade` 覆蓋;
      330s 是設計選擇(上游註解:「stall 過 5.5 分大概率是 API 問題,重跑或拆比等更久好」)。
- [ ] Round N findings 分類:
  - P1 critical(release-blocker)→ **必修**
  - P2 advisory → 修(模式是「修到 0 findings 為止」)
- [ ] 每個 finding 除了 P1/P2,再標**來源(互斥三選一)**:
      `初始 patch 內既有缺陷` / `初始 patch 漏改的外部 consumer` / `baseline 後新增／修改引入`
      (後者含 review fix,**也含 Step 4.5／4.6 觸發後新加的東西**)。
      **判準依 finding 的「成因」、不依「你打算怎麼修」**——完整 precedence 與例外
      只寫在 `docs/EFFORT.md`〈要做 sweep,先量對東西〉,**這裡不另寫一套**(兩份會漂移)。
      三者的解法完全不同,混在一起就量不出東西
- [ ] **每個 finding 再標「行為級／散文級」二分**——散文級照抄對手給的替換句、機械核對、**不另跑確認輪**;行為級照舊送輪跑到 0。判準(看「完整修法要動什麼」)、兩條 fail-open 紀律、8 條校準表見下方〈壓輪數的三條紀律〉⑴。
- [ ] **prompt 要明確授權對手模型查 diff 以外的受影響處**(「這個不變量在 repo 其他地方
      還有沒有舊說法／其他入口／其他 fixture?」)——不寫它,它就只審你框起來的 diff,
      而漏改的外部 consumer 正是本次量測刻意要區分出來的一類
- [ ] 每輪 fix commit 訊息標 `修復: <feature> review round N — <finding>(P1/P2)`
- [ ] **送下一輪之前,把「自己這輪新加的東西」當成一份新 diff 自檢一遍**——加硬成三句可執行(新機制跑 mutation 探針／改時序常數先問哪條測試的 tick 推不到／新宣稱句跑量詞自檢器),見下方〈壓輪數的三條紀律〉⑵。
- [ ] **finding 涉及「一個被宣稱的不變量」→ 連它的守法一起審,不只審那句敘述**(敘述只准一份 SSOT、呼叫點要另外守、守門用位置＋數量),見下方〈壓輪數的三條紀律〉⑶。
- [ ] 迭代到 round M「no actionable findings」
- [ ] 把 round 數 / P1/P2 finding 數記入 progress entry cost field

**STOP point**:還有 actionable findings → 繼續迭代;0 actionable 才進 Step 5。

> ### 壓輪數的三條紀律(承上 Step 4 checklist 標了「見下方」的三個條目)
>
> **⑴ 行為級／散文級二分——散文級不消耗確認輪。** 判準看「finding 的**完整修法要動什麼**」,不是「這段文字有沒有被程式執行」:
>
> | tag | 界線 | 走法 |
> |---|---|---|
> | **行為級** | finding **主張**要改執行路徑、設定、測試、操作或安全決策 | 照舊,修完送下一輪、跑到 0。**接受它之前要驗證它主張的那條可達序列** |
> | **散文級** | finding 的**完整修法只是更正對既有行為的描述** | **請對手模型直接給替換句** → 精確照抄 → 機械核對 → **不另跑確認輪** |
>
> 🔴 **兩條紀律,缺一就 fail-open**:①**判不準 → 行為級**(從嚴)。②**證據不足 → 先查證,不得改標散文級**——reviewer 懷疑 timer／權限／競態會改變行為、但還沒重現時,那是**待查證的行為級**;證據強度決定的是「成立／駁回／待驗」,**不是** finding 的類型。把它降成散文級等於用「還沒證明」換掉一整輪確認。
>
> **實例分類(用真實發生過的 finding 校準——規則文字再精確,也不如一張校準過的表)**:
>
> | finding | 判 | 為什麼 |
> |---|---|---|
> | 文件把某環境變數名稱寫錯 | **行為級** | 指示了設定動作,照做會壞 |
> | 量詞自檢器把 `++++` 開頭的新增行誤當 diff 檔頭跳過 | **行為級** | 執行結果不同,而且有一條會失敗的測試 |
> | 未追蹤的非 ASCII 檔名因 Git quoting 被靜默漏掃 | **行為級** | 同上,修法要動碼＋補測試 |
> | 註解宣稱「兩道保護各自都足夠」(實際只改註解、一行碼沒動) | **散文級** | 這句是錯的,但修法只改註解 |
> | 「逾時後走跟某既有狀態完全一樣的流程」 | **散文級** | 只是描述既有行為 |
> | 文件寫「每 75 秒重建」、實際穩態約 105 秒 | **散文級** | 對既有節奏的描述 |
> | 契約測試註解「不守時限」→ 實為「有 timeout、但不守產品門檻」 | **散文級** | 拿掉那句,實作與風險結論都不變 |
> | 測試註解「建一個只有一個 commit 的 repo」實際建兩個 | **散文級** | 描述 fixture,改了不影響任何操作 |
>
> 🔴 **這條線被打穿四次,方向各不相同——照上表分,不要自己重新發明**:⑴「有沒有被程式執行或斷言」→ 太寬(那條「文件把環境變數名寫錯」沒被程式執行,卻被照做了)。⑵「改完後有沒有人判斷不同」→ 太窄,散文級只剩標點。⑶ 加「或它是實作的安全前提」→ **舉不出乾淨的例子**(兩個候選都被推翻:被舉的保護其實由另一道機制獨立撐住、或程式自有第二層保護且該路徑走不到時仍然安全);需要改碼／設定／測試／操作的情況已由行為級定義涵蓋,故刪除。⑷「reviewer 給不出可達序列就算散文級」→ **fail-open**,把證據強度當成了類型。
>
> 🔴 **散文級怎麼收尾**:照抄替換句 → 自己做一次機械核對(把套用後的文字與替換句逐字對一遍)→ 就這樣,**不因為它多跑一輪**。若那一輪**行為級還沒歸零** → 散文修正跟著下一輪一起被看到(順帶,不是為它跑的);若**行為級已經 0、只剩散文** → **套用完就出貨,不再送審**。⚠️ 後者的殘餘風險:替換句本身不準不會再被下一輪發現——這是接受的風險,所以散文級仍須精確照抄並機械核對。
>
> **⑵ 「自檢一遍」加硬成三句可執行**(「自檢一遍」不可執行,實測仍可能漏掉多項問題):
> - **修法引入新機制**(新函式／新 timer／新守衛／新狀態)→ 送下一輪前對它跑**至少一條 mutation 探針**(手動改壞 → 看某條測試轉紅 → 還原;repo 有 `scripts/mutate.ts` 時優先用 `npm run mutate`——乾淨工作樹才可跑)。工作樹髒時用手動探針即可,但**要明講那不是完整的 mutation 掃描**。
> - **修法改了任何時序常數、或把某個動作往後排** → 先回答「**哪一條既有測試的 tick 現在推不到它了?**」真實案例:把破壞性動作從 15 秒延到 75 秒、而那條測試只推進到 30 秒 → 同一條 mutation 從被抓變成存活、測試一個字都沒改。**答案若是「沒有任何既有測試推得到」→ 補一條測試涵蓋新時序、或把既有測試的 tick 往後推;不補就是問了卻不行動＝fail-open,不得送審**。⚠️ **只推進 tick 不算數**:推完要確認該測試對新時序**真的有斷言**、且把時序改壞的 mutation 會讓它轉紅——否則 tick 推了、mutation 照樣存活,等於沒守。
> - **修法寫了新的宣稱句** → 對**這一輪的 diff** 跑量詞自檢器(掃新增行裡的量詞與絕對化措辭、產待處置清單),**base 指定成「上一輪送審的 HEAD」**。🔴 **base 一定要指定、不要用預設**:預設 base 是主線,round 2 之後每次都會把整支 PR 重掃一遍,**前幾輪早處置完的幾十個命中會把本輪新增那幾句淹掉**——正好抵銷這條規則的用意。🔴 **那個 base 從哪來**:靠每輪 fix 都 commit(見 checklist 的 fix commit 條目)、HEAD 才會前進;送審的 prompt 裡寫上 `git rev-parse HEAD` 的值,下一輪拿它當 base。(該輪未提交的修法仍會被 `git diff <base>` 一起收進去,不必為了掃描先 commit——但**輪與輪之間要 commit**,否則 base 不動、下一輪會重掃上一輪已處置的。)
>   ⚠️ **前置**:此步用的量詞自檢器(`check:claims`)不一定存在於每個 repo。你的 repo 沒有它時,這一句改成**人工核對本輪新增的宣稱句**。
>
> **⑶ finding 涉及「一個被宣稱的不變量」時,連它的守法一起審,不只審那句敘述**:
> - **敘述只准一份 SSOT**:一個不變量的完整敘述放**單一錨點**,其他入口只放**一個指回該錨點的穩定引用**(repo-relative 連結或標題錨點、指向那份 canonical 敘述)、不放摘要。**指標與摘要並存＝指標形同虛設**(兩份會漂移,而漏改的 consumer 往往就是同一條敘述散在 4–6 處)。
> - **呼叫點要另外守**:純函式有單元測試也有 mutation ≠ 保護在生效——把呼叫它的那一行刪掉,兩者照樣全綠。判準:問「**我刪掉這行呼叫,有什麼會紅?**」修法是把接線那段也抽成可注入的純函式,用拋棄式環境(暫存目錄＋真實資源)或注入的 I/O 替身驗它。
> - **守門優先用「位置＋數量」,別拿字串處理去解析有結構的東西**(每補一次就換一個洞);**白名單用「位置」不用「值」**(以值為準的豁免必然全域,第二個同值的違規就溜過去);**要鎖就鎖完整集合、連值一起鎖**——能被「刪一條真的、補一條假的」湊過的正對照等於沒有。
> - ⚠️ 這種「位置＋數量型」守門守得比你以為的窄:抓得到錨點消失／重複／搬檔／野指標／死錨點,**抓不到「沒帶標記的新摘要」**(那要比對自然語言,通常刻意不做)。知道邊界,別假設它擋得住語意漂移。

## Step 4.5:條件式安全關(觸發判定機器化) 🎚️ `xhigh`

- [ ] 跑 `npx tsx scripts/check-cso-trigger.ts`(對完整變更面做安全域 path 比對),
      把輸出(REQUIRED/NOT + 命中域)暫記 plan file 或 scratchpad
      (Step 5 集中寫進 progress entry;理由見下方 `CSO_NOT_REQUIRED` 條目——
      此刻動 progress.md 也會弄髒工作樹、擋掉下方 mutation 探針)
      〔前置:導入時先填 `scripts/cso-trigger.config.ts` 路徑表,見 docs/ADOPTION.md〕
- [ ] `CSO_REQUIRED` → 跑一輪專責安全審
      〔預設:gstack `/cso`;無 gstack 降級:Claude Code 內建 `security-review` skill〕,
      findings 分類同 Step 5(`[CRITICAL]` 必修),fix commit 標 `修復: <feature> 安全審 findings — <finding>`
- [ ] `CSO_REQUIRED` = 本 sprint 進**高風險車道**(見頂部風險車道對照表),另加兩件事:
  - **破壞性 mutation 探針**:對每個命中域的新增/修改機制跑**至少一條**探針,預設
    `npm run mutate -- --file <檔> --find '<原樣>' --replace '<改壞>' --label '<命中域:哪條不變量>'`
    (多條用 `--spec` 批次;`scripts/mutate.ts` 三道 fail-closed 閘,**乾淨工作樹
    才可跑——先把本輪改動 commit 再跑**)。**exit 0(全部 mutant 被抓)才算過**:
    exit 1 = 覆蓋缺口 → 補測試再跑;exit 2 = 無法判定 → 排除障礙再跑。
    結果暫記 plan file 或 scratchpad,Step 5 集中寫進 progress entry(慣例同下一條)
  - **標記高風險車道**:Step 5 要**多加一道** worktree 獨立審(SHA 在 Step 5
    派工前才記,**不是**沿用 Step 4 的 baseline SHA——fix round 會讓 HEAD 前進;
    做法見 Step 5〔僅高風險車道〕條目)
- [ ] `CSO_NOT_REQUIRED` → 自問一次「diff 是否含腳本路徑表沒涵蓋的安全敏感邏輯?」
      (**機器判定是下限不是上限**);**有 → 視同 `CSO_REQUIRED`**(跑安全審 +
      上一條的高風險車道兩項加強),並照下方條目把新路徑補進路徑表、重跑判定;
      無 → **暫記於 plan file 或 scratchpad**
      (progress entry Step 5 才寫、此刻寫會破 Step 5「最後一個 commit」的 partial-lifecycle
      grep;Step 5 集中把這裡的 REQUIRED/NOT + 命中域 + 理由寫進 entry),進 Step 5
- [ ] 本 sprint 新增了安全敏感模組 → 同步把路徑加進 `scripts/cso-trigger.config.ts` 路徑表

**STOP point**:安全審 critical findings 全修;高風險車道的 mutation 探針全部
exit 0(被抓)——才進 Step 5。

## Step 4.6:條件式視覺關(diff 碰 UI 才觸發) 🎚️ `medium`

> 與 Step 4.5 同構的**條件式**關卡:平常不跑,碰到才跑。純後端 / 純工具 / 純文件
> 的 sprint 直接跳過並記錄「未觸發」。
>
> 為什麼值得單獨設一關:現行模型在圖表、文件、UI 視覺還原上很強,但**視覺這件事
> 靠工具比靠想有用**——官方明講「讓模型有工具去反覆分析、裁切、目視驗證自己的成果」
> 比單純加大思考量更划算。所以本關的重點不是「想久一點」,是**真的把畫面叫出來看**。

- [ ] **觸發判定**:本 sprint 的 diff 是否碰到 UI 檔(元件 / 頁面 / 樣式 / design token /
      字型或色彩設定)?否 → **暫記「未觸發 + 判定理由」於 plan file 或 scratchpad**
      (Step 5 集中寫進 entry;不在此提前寫進 progress、原因見 Step 4.5 同段),直接進 Step 5
- [ ] 觸發時:**實際把畫面跑起來稽核**〔預設:gstack `/design-review`(80 項視覺稽核,
      對照 design token 抓 finding 並直接修 CSS/樣式、一 commit 一 finding、附
      before/after 截圖);無 gstack 降級:瀏覽器 / 模擬器 / 預覽環境手動截圖,
      不要只讀程式碼推論外觀〕
- [ ] 對照 `CLAUDE.md` §4.2 指定的 design token 來源檔逐項核對:
      色彩 / 字型 / 間距 / 圓角 / 狀態記號。**硬編色碼、繞過 token 的寫法一律算 finding**
- [ ] 至少看兩個斷點(桌機 + 手機寬度);有深色模式則兩種主題都看
- [ ] ⚠️ **CSS-first 的樣式框架(如 Tailwind v4 的 `@theme`)拼錯 token 名稱會靜默無樣式**
      ——不會報錯、不會 typecheck 紅。核對時要看**編譯後的實際樣式**,不是只看原始碼
- [ ] findings 分類同 Step 5;fix commit 標 `修復: <feature> 視覺關 findings — <finding>`

**STOP point**:視覺 finding 全修、或明確記錄為什麼不修,才進 Step 5。

## Step 5:同模型 sanity check(第二道 review,本地 diff、push 前) 🎚️ `medium`

- [ ] 跑第二道 review(對本地 diff,**不需先 push**)
      〔預設:gstack `/review`(Claude adversarial subagent + Codex challenge);
      無 gstack 降級:Claude Code 內建 `/code-review` + 派**一個** `.claude/agents/adversarial-reviewer.md`
      對 diff 獨立審(注意:它要從 diff 本身出發,**不是**去驗證前面 review 的結論——
      那會複製盲點。**一個就夠,不要開多個**)〕
- [ ] 〔僅高風險車道,即 Step 4.5 判 `CSO_REQUIRED`(含人工視同)〕本步**多加一道
      worktree 獨立審**:adversarial-reviewer 以 `isolation: worktree` 派出(每次派工
      = 全新拋棄式 worktree、乾淨 checkout),prompt 附**派工當下**的
      `review-tip SHA = HEAD`,要求開工先核對(SHA + 工作樹乾淨度,規則見 agent
      定義檔)。預設(gstack)與降級路徑做法相同——這是高風險車道**刻意增加的
      一輪**,不受上一條「一個就夠」限制(那條講的是同一道 review 不要重複開)。
      ⚠️ 每輪 fix commit 後 HEAD 前進 → 下一輪派工**重記 review-tip、派新 agent**
      (= 新 worktree;舊 worktree 隨舊 agent 作廢,不重用)。Step 4 的 baseline SHA
      只供 finding 來源分類,**不拿來核對**——fix round 後必然 mismatch。
      ⚠️ 收乾後的 bookkeeping commit(progress / BACKLOG / TODOS,見下方條目)是
      **機械核對例外**:不為它重跑 worktree 審,但要機械核對該 commit 的 diff
      **只含記憶層檔**(`.claude/memory/**`、`TODOS.md`、BACKLOG 類追蹤檔)——
      混入任何其他檔就不是 bookkeeping,要再跑一輪。
      目的:抓「依賴本地未提交狀態 / 工作樹污染」的錯——`scripts/mutate.ts` 檔頭
      指出的同一類極限。輕/標準車道不掛,避免 ceremony
- [ ] Findings 分類(severity 與 confidence 是兩條獨立軸):
  - `[CRITICAL]` finding → **一律必修**(severity 軸)
  - `[INFORMATIONAL]` finding → 依 confidence 軸:
    - confidence ≥ 7 → 視具體 trade-off 修(高信心,大機率真問題)
    - confidence 5-6 → cosmetic 或 risk 低可 skip,有 trade-off 才修
    - confidence < 5 → 預設 skip
- [ ] Cross-model agreement rate 記入 progress entry(經驗值:兩個 model 找到的問題
      幾乎不重疊——**cross-model agreement ≠ correctness**,這正是需要兩道 review 的原因)
- [ ] **本步獨立發現數**記入 progress entry cost field(`Step5 獨立發現 X 個` —— 指
      Step 4 完全沒提到、由本步首次抓到的 finding 數)。用途:新世代模型的單 pass
      召回率提高後,「第二道 review 還值不值得」應該由**累積資料**回答而不是靠信仰。
      `npm run health:weekly` 會把這個數字做成趨勢;若連續多個 sprint 都是 0,
      再開 sprint 討論是否簡化本步——**在有資料之前不要動流程**
- [ ] 每輪 fix commit 訊息標 `修復: <feature> review findings — <finding>`
- [ ] 🔴 **本步收乾後,寫 progress entry 進 feature branch 最後一個 commit**
      (避免 Step 7 只為 progress 另開 PR、每 sprint 收尾多 1 支 PR + 1 輪 CI 的浪費)
  - 🔴 **同理適用 BACKLOG / TODOS 標「刀 X ✅」的 bookkeeping**(來源專案 sprint
    觀察後 port 進來)——那些同樣是 pre-merge 可知的資訊(「刀已收乾
    等 merge」這件事 Step 5 就成立),不留給 Step 7。三份 memory 檔(progress / BACKLOG /
    TODOS)的所有 pre-merge bookkeeping **一起寫進同一個 feature branch commit、走同一
    輪 CI**。詳見 LESSONS.md `## 流程/工具` 段。
    - 🔴 **TODOS ✅ 條目必留 `PR #___` placeholder**(Step 6 開 PR 後補 PR 號進去):
      `scripts/check-todos-markers.ts` 對「已完工但沒引用 PR」只回 advisory 不擋合併
      ——若 Step 5 沒留 placeholder、Step 6 也就沒 placeholder 可補、PR 可能合了但
      citation 缺席。留 placeholder 才讓 Step 6 有明確 stop condition。
  - 🔴 **先 grep 有無既有 partial entry**(見 `.claude/memory/progress.md` 檔頭「⚠️ 未完成
    sprint 的 checkpoint 走另一條 flow」):
    `grep -nE '⚠️ (partial|paused)' .claude/memory/progress.md`。有既有 partial → **就地
    擴寫**成 completed schema、**不要**在最上方另加新 entry(同 feature branch squash 若
    含兩份 entry 會一起進 delivery branch、違反「partial 不進主線」)
  - **只寫 pre-merge 可知的資訊**——排除 PR 號 / squash SHA / CI status / merge status
    (這些 post-merge 才可知,而 Step 5 是 pre-merge 時點;git log / GitHub PR page
    自帶這些訊息,progress 不重複記、也不會過時)
  - 用 cost field 模板:
    `📊 成本:CC ~Xh / 跨模型 review N rounds / P1 X 個 / P2 X 個 / Step5 獨立發現 X 個`
    (`Step5 獨立發現` 欄由 `npm run health:weekly` 解析成趨勢)
  - 再記三項(供 `docs/EFFORT.md` 的 sweep 用——**沒有這些就校不了那張建議值表**):
    ① **每輪實際的 model ＋ API effort**(session 當下真正生效的值,不是 `🎚️` 那個提示)
    ② **baseline SHA**(Step 4 送第一輪前固定的那個 HEAD;非 Step 5 進行時的 HEAD)
    ③ **finding 來源分佈**(`初始 patch 內既有缺陷 X` /
    `初始 patch 漏改的外部 consumer X` / `baseline 後新增／修改引入 X`;
    **分類依 finding 成因、不依修法位置**,判準見 `docs/EFFORT.md`)
    ⚠️ **這三項是人工填、人工讀**——`health:weekly` 的 collector **不解析**它們,
    而且它是 3–5 sprint 的 calibration window、不是永久欄位(理由見 `docs/EFFORT.md`)
  - 安全關與視覺關的觸發結果各記一行(`CSO_REQUIRED` / 未觸發 + 理由;視覺關同)
  - 把 Step 1-5 的 checklist 最終狀態貼上去
  - 下一棒議題選項貼上去(給接手 session 用)
  - `check:claims` 逐條處置(留 A / 降級 B)貼進 entry,同時貼進 Step 6 的 PR 描述
      (合併前的關口 in PR、長期紀錄 in progress——**兩處貼、不轉抄**)
  - commit 訊息:`文件:memory — progress 加 <feature> sprint entry`
      (跟 code 進同一 PR、CI 一次跑完、develop 只多一支 squash commit)

**STOP point**:critical findings 全修;informational 排序完;**progress entry 已寫並 commit 進 feature branch**、**適用的 BACKLOG / TODOS ✅ 條目已標並留 `PR #___` placeholder**(本刀是新開發或收尾追蹤條目時適用;純內部 refactor 無關 TODO 追蹤才不適用——判不準當適用、留一條總比漏一條好) → 才進 Step 6。

## Step 6:Push + PR + CI(最終 gate,review 收乾淨後才對外) 🎚️ `low`

- [ ] push 前再跑一次完整本地 gate(把 CI 有、本機 gate 沒有的項目先補齊,
      避免 push 後才被 CI-only 失敗打回)
      ⚠️ **順序有講究:要在「commit 之後」跑,不是 commit 之前。**
      有些 gate 掃的是 **commit 訊息 / git 史**(例如去識別化 gate 的第 3 段),
      commit 前跑它們根本掃不到 —— 會出現「本機全綠、CI 才紅」。
      2026-07-25 實際踩過:訊息裡描述「被 denylist 擋的詞」時原樣寫了那個詞,
      本機(commit 前)綠、CI 紅,代價是 amend + `--force-with-lease`
      (`git log --all` 掃所有 ref,遠端舊 commit 不清掉照樣紅)。
      已機器化為 `scripts/git-hooks/commit-msg`,但那是 opt-in hook —— 沒跑
      `npm run setup-hooks` 的環境仍要靠本條紀律
- [ ] 🔴 **push 前確認 progress entry 已在 Step 5 寫並 commit 進 feature branch**
      (在 Step 6 才發現 progress 沒寫 = 回頭 Step 5 補 commit,不是「先 merge 再另開 PR」)
- [ ] `git push` + 開 feature → 主線 PR(PR 一開即是審過的乾淨版),
      description 對齊 plan(Summary / 完工內容 / Test plan)
- [ ] 🔴 **PR 開了拿到 PR 號後、無條件 stop condition**:**只掃本 branch 新引入的
      placeholder**(不是整檔 grep)——
      ```bash
      git diff origin/<主線>...HEAD -- \
        .claude/memory/TODOS.md .claude/memory/TODOS-done.md .claude/memory/BACKLOG.md \
        | grep -E '^\+.*PR #___'
      ```
      (`<主線>` 依 target repo 慣例:多數是 `main`,GitFlow 專案是 `develop`——先
      `git branch -r | grep -E 'origin/(main|develop)$'` 確認。)**每一個新增的 placeholder
      都要在此補 commit 填本刀 PR 號 → push → 讓 CI 走這一版**。
      ⚠️ **不能整檔 `grep -n "PR #___"` 全掃**:主線若有前一次 Step 6 漏補的 stale
      placeholder(Step 7 例外分支明說會發生),整檔掃會把它們錯認為本刀、以本 PR 號
      覆寫、造成錯誤歸屬。整檔 grep 拿到的**額外**(主線已有的)placeholder 要分開列
      出、報告給 Owner 手動處理(不由本 PR 動)。
      掃本 branch 新增 0 hit ＋ Step 5 本刀有動 TODOS/BACKLOG ✅ → 停下確認為什麼沒
      placeholder(Step 5 沒留 = 流程漏洞、要補)。
      `scripts/check-todos-markers.ts` 的 `MARKER_SELF_PR` 允許 CI 驗自我引用、不擋
      pre-merge 補 citation。這樣 Step 7 完全不需要回頭補 PR 號,徹底消除
      「post-merge 才要另開 PR 補 TODOS」的坑。
- [ ] 等 CI 綠 → **squash merge** 進開發主線(review 修復 round + progress commit +
      bookkeeping fill-placeholder commit 壓成單一乾淨 commit)
- [ ] CI 若抓到本地沒抓的(env / DB / build 差異)→ 修一輪再 push,屬正常

**STOP point**:CI 綠 + squash merge 完成才進 Step 7。

## Step 7:Final(收尾 + 交棒) 🎚️ `low`

> ⚠️ **progress entry 在 Step 5 已寫並隨 code PR 一起 squash merge、此步驟不重複**
> (2026-08-21 改;舊版把 progress.md 更新放這步 → 合 develop 後才寫、progress 動不了
> develop protected branch、只能另開 PR;每個 sprint 收尾多 1 支 PR + 1 輪 CI 純浪費)

- [ ] ⚠️ **`TODOS.md` 完工標記 ✅ 與 `PR #___` citation 已在 Step 5/6 隨 code PR 一起
      squash merge、此步驟不重複**(同 progress entry 的處理):完工項目 ✅ 標在 Step 5、
      `PR #___` 引用位在 Step 6 開 PR 後補 commit push。Step 7 不再有 TODOS 更新動作——
      留到這裡就是「主線 protected 只能另開 PR、多跑一輪 CI」的坑(見 LESSONS.md
      `## 流程/工具` 段)。**唯一例外**:若 Step 6 忘了補 PR 號(違反紀律)、Step 7 才
      發現,那才手動做——並記進 LESSONS 別下次再犯。
      (`scripts/check-todos-markers.ts` CI gate 只回 advisory 不擋合併——所以驗證這步
      的責任在 Step 6、不在 CI。)
- [ ] 若有新踩坑 → 寫入 `.claude/memory/LESSONS.md`(按格式模板、告知 Owner 不靜默)
- [ ] progress.md 過長 → 照 `.claude/memory/progress-archive/README.md` 慣例歸檔
- [ ] 通知 Owner 收工

**STOP point**:全部 ✅ 才算 sprint 真結束。

## 例外(不走完整流程)

下列情境可略過 Step 1-5,直接 commit + 通知(Step 3 commit + Step 7 收尾):
- Typo 修正
- 顯而易見的單行修改
- 純格式整理
- Owner 明確說「快速做就好」「不用問」

🔴 **本例外受上方「適用範圍 — 完整 SOP vs docs-only」判準約束**:
- 若改動命中 docs-only 判準的**任何一條 🔴 完整 SOP 條件**(spec / 決策 / 計畫 / 安全 /
  權限 / 部署 ops / 專案治理 / 任何非純說明檔),**一律不適用本例外**——即使只是「顯而
  易見的單行修改」。單行改 auth 邏輯、CI gate、守門腳本、migration 都是本規則要擋的。
- 只有**同時**是「不影響 customer-facing behavior」+「不碰安全邊界」+「不改 spec /
  治理」的 typo / 格式,才走本例外。

**自我檢驗**:①改動會不會影響 customer-facing behavior?②會不會碰上方 docs-only 判準
列的任何一條 🔴 完整 SOP 條件?**任一為「會」→ 走完整流程,不適用本例外。**

## Plan Mode 邊界提醒

- Plan mode 內只能 edit plan file(`~/.claude/plans/*.md`)
- 不能 run write tool(Edit / Write / Bash commit / 等)
- 結束方式只有提問(釐清)或 ExitPlanMode(批准)
- 結束 plan mode 後 bias toward 不停下來問,reasonable call 自己做,Owner 會在偏差時 redirect

## 節奏分層 — per-change / 里程碑 / 階段

> 上面 7 步是**每次 change** 的核心迴圈,**保持精簡、別再往裡塞**。以下是「超出單次
> change」的節奏節點——掛在對的高度,不加重每次開發。

### A. 里程碑 / EPIC 節點(安全審計 + retro)

**三層安全審的分工(別再混用):**

| 層 | 審什麼 | 什麼時候 |
|---|---|---|
| per-change | **這一刀的 diff** | Step 4.5,機器判 `CSO_REQUIRED` 時 |
| per-EPIC | 一整批改動的**橫切面** | 每個 EPIC 收尾(branch-scoped 較輕的安全審) |
| 上線前 / 碰真 auth | **整個攻擊面**撐不撐得住 | 首次上線 / 第一個真用戶 / 生產部署之前(重型戰略審) |

- EPIC 節點那層抓的是 per-diff review **結構上看不到**的東西:token 生命週期跨多支
  migration、secret 處理、授權 blast-radius 跨整個 schema、小決策的累積。
- 三層**不重複**:4.5 問「這個 diff 對不對」,EPIC 問「這批加起來有沒有破洞」,
  上線前那層問「整體撐不撐得住」。
- **每個 EPIC 收尾、或每週**跑一次教訓沉澱流程:把本輪 finding、踩雷、解法統整寫進
  `LESSONS.md`;沒有工具時手動照 LESSONS 模板寫。
- ⚠️ 這些是**里程碑節點,不是 per-change**;塞進每次 change 就失去意義、變 ceremony。

### B. 階段占位節點(達成解鎖條件才啟用)

> 專案生命週期的不同階段會需要不同工具接進 SOP(驗證階段、部署階段、性能階段…)。
> 這些節點**共用一條規則:條件達成時把它們接進 Step 6/7,不到位前不強加**。

範例(通用範式、專案依實情替換):

- **驗證階段**(解鎖條件:E2E fixture 就緒 → 能以真身份跑 auth-scoped 測試):加進
  Step 6 CI gates,或 Step 7 收尾前手動跑一次。
- **部署階段**(解鎖條件:生產環境 credentials 就緒):加進 Step 6/7 的部署對照 checklist,
  上線前置一律照 written checklist,不要憑記憶重建。

### C. 除錯入口(需要時)

- 真整合 bug 出現時走系統化 root cause 分析(先固定 repro、再二分定位、最後補 test),
  別亂猜。有工具就用工具、沒有就手動走同樣步驟。

### 刻意不加(避免 ceremony,誠實標註)

- **完整 UI 設計流程**:Step 4.6 視覺關已覆蓋 per-change 的 UI 核對;完整設計流程留給
  「整批 UI 改版」或 mobile app 動 UI 這類**里程碑**動作,不是 per-change。
- **性能量測 / benchmark**:小 codebase / 無 perf 敏感面時,加它進 per-change 是稅、
  不加價值;真正的性能面出現時再接進 Step 6/7。
- **重複 L3 守門**:許多「更嚴格的守門」工具與模板附帶的 `scripts/git-hooks/**` +
  `scripts/lib/destructive-guard.ts` 重疊,不必重複裝。若專案自己另加 `CODEOWNERS`
  與 branch protection(模板未附帶),那兩層又會多蓋一次同一批面向。唯獨會鎖 session
  編輯目錄的 skill 屬可選 polish(freeze 類)。
- **週健檢 / 教訓機器化率等 harness 自省指標**:模板有 `scripts/weekly-health-check.ts`,
  但**先讓 Step 5 寫進 progress 的 cost field 累積幾個 sprint 的資料,再決定要不要做
  趨勢圖**(沒有資料就做趨勢＝生出看起來像量測、其實不是的數字)。
