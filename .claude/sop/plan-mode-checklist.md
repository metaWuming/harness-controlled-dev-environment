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

**STOP point**:Health stack 任一項紅 → 修到綠才能下一步(原則 7「失敗要大聲說」)。

## Step 4:跨模型 Review(對手 model 找 bug,本地 diff、push 前) 🎚️ `medium`(最後一輪 `high`)

- [ ] **送第一輪之前先固定 baseline**:工作樹乾淨、初始 patch 已 commit,`baseline SHA = HEAD`
      (工作樹髒時記下的 SHA **根本不含**被審的 diff,那個 baseline 是假的;不想 commit
      就得另存 diff hash／bundle,只記 SHA 不算數)
- [ ] 對本地 diff 跑對手模型 review 一輪(**不需先 push**)
      〔預設:Codex CLI `/codex review`;無 Codex 降級:Claude Code 內建 `/code-review high`——
      失去跨模型多樣性,但仍是獨立 fresh-context 審查〕
- [ ] Round N findings 分類:
  - P1 critical(release-blocker)→ **必修**
  - P2 advisory → 修(模式是「修到 0 findings 為止」)
- [ ] 每個 finding 除了 P1/P2,再標**來源(互斥三選一)**:
      `初始 patch 內既有缺陷` / `初始 patch 漏改的外部 consumer` / `baseline 後新增／修改引入`
      (後者含 review fix,**也含 Step 4.5／4.6 觸發後新加的東西**)。
      **判準依 finding 的「成因」、不依「你打算怎麼修」**——完整 precedence 與例外
      只寫在 `docs/EFFORT.md`〈要做 sweep,先量對東西〉,**這裡不另寫一套**(兩份會漂移)。
      三者的解法完全不同,混在一起就量不出東西
- [ ] **prompt 要明確授權對手模型查 diff 以外的受影響處**(「這個不變量在 repo 其他地方
      還有沒有舊說法／其他入口／其他 fixture?」)——不寫它,它就只審你框起來的 diff,
      而漏改的外部 consumer 正是本次量測刻意要區分出來的一類
- [ ] 每輪 fix commit 訊息標 `修復: <feature> review round N — <finding>(P1/P2)`
- [ ] **修完一輪、送下一輪之前,把「自己這輪新加的東西」當成一份新 diff 自檢一遍**
      ——這是 `baseline 後新增／修改引入` 那類的直接解法。修法本身沒被審過就送出去,
      等於花一整輪請對手模型幫你審第一遍
- [ ] 迭代到 round M「no actionable findings」
- [ ] 把 round 數 / P1/P2 finding 數記入 progress entry cost field

**STOP point**:還有 actionable findings → 繼續迭代;0 actionable 才進 Step 5。

## Step 4.5:條件式安全關(觸發判定機器化) 🎚️ `xhigh`

- [ ] 跑 `npx tsx scripts/check-cso-trigger.ts`(對完整變更面做安全域 path 比對),
      把輸出(REQUIRED/NOT + 命中域)記入 progress entry
      〔前置:導入時先填 `scripts/cso-trigger.config.ts` 路徑表,見 docs/ADOPTION.md〕
- [ ] `CSO_REQUIRED` → 跑一輪專責安全審
      〔預設:gstack `/cso`;無 gstack 降級:Claude Code 內建 `security-review` skill〕,
      findings 分類同 Step 5(`[CRITICAL]` 必修),fix commit 標 `修復: <feature> 安全審 findings — <finding>`
- [ ] `CSO_NOT_REQUIRED` → 自問一次「diff 是否含腳本路徑表沒涵蓋的安全敏感邏輯?」
      (**機器判定是下限不是上限**);無 → 記錄不觸發理由,進 Step 5
- [ ] 本 sprint 新增了安全敏感模組 → 同步把路徑加進 `scripts/cso-trigger.config.ts` 路徑表

**STOP point**:安全審 critical findings 全修才進 Step 5。

## Step 4.6:條件式視覺關(diff 碰 UI 才觸發) 🎚️ `medium`

> 與 Step 4.5 同構的**條件式**關卡:平常不跑,碰到才跑。純後端 / 純工具 / 純文件
> 的 sprint 直接跳過並記錄「未觸發」。
>
> 為什麼值得單獨設一關:現行模型在圖表、文件、UI 視覺還原上很強,但**視覺這件事
> 靠工具比靠想有用**——官方明講「讓模型有工具去反覆分析、裁切、目視驗證自己的成果」
> 比單純加大思考量更划算。所以本關的重點不是「想久一點」,是**真的把畫面叫出來看**。

- [ ] **觸發判定**:本 sprint 的 diff 是否碰到 UI 檔(元件 / 頁面 / 樣式 / design token /
      字型或色彩設定)?否 → 記錄「未觸發」進 progress entry,直接進 Step 5
- [ ] 觸發時:把改動的畫面**實際跑起來截圖**(瀏覽器 / 模擬器 / 預覽環境皆可),
      不要只讀程式碼推論外觀
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

**STOP point**:critical findings 全修;informational 排序完才進 Step 6。

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
- [ ] `git push` + 開 feature → 主線 PR(PR 一開即是審過的乾淨版),
      description 對齊 plan(Summary / 完工內容 / Test plan)
- [ ] 等 CI 綠 → **squash merge** 進開發主線(review 修復 round 壓成單一乾淨 commit)
- [ ] CI 若抓到本地沒抓的(env / DB / build 差異)→ 修一輪再 push,屬正常

**STOP point**:CI 綠 + squash merge 完成才進 Step 7。

## Step 7:Final(收尾 + 交棒) 🎚️ `low`

- [ ] 更新 `.claude/memory/progress.md` 加 entry(格式見該檔模板)
  - 用 cost field 模板:
    `📊 成本:CC ~Xh / 跨模型 review N rounds / P1 X 個 / P2 X 個 / Step5 獨立發現 X 個`
    (這一行的 `Step5 獨立發現` 欄由 `npm run health:weekly` 解析成趨勢,見 Step 5)
  - 再記三項(供 `docs/EFFORT.md` 的 sweep 用——**沒有這些就校不了那張建議值表**):
    ① **每輪實際的 model ＋ API effort**(session 當下真正生效的值,不是 `🎚️` 那個提示)
    ② **baseline SHA** ③ **finding 來源分佈**(`初始 patch 內既有缺陷 X` /
    `初始 patch 漏改的外部 consumer X` / `baseline 後新增／修改引入 X`;
    **分類依 finding 成因、不依修法位置**,判準見 `docs/EFFORT.md`)
    ⚠️ **這三項是人工填、人工讀**——`health:weekly` 的 collector **不解析**它們,
    而且它是 3–5 sprint 的 calibration window、不是永久欄位(理由見 `docs/EFFORT.md`)
  - 安全關與視覺關的觸發結果各記一行(`CSO_REQUIRED` / 未觸發 + 理由;視覺關同)
  - 把 Step 1-6 的 checklist 最終狀態貼上去
- [ ] 更新 TODOS.md(mark 完成的條目 ✅,**完成宣稱必須引用交付 PR 號**——
      `scripts/check-todos-markers.ts` CI gate 會驗)
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

**自我檢驗**:這個改動會不會影響任何 customer-facing behavior?會 → 走完整流程。

## Plan Mode 邊界提醒

- Plan mode 內只能 edit plan file(`~/.claude/plans/*.md`)
- 不能 run write tool(Edit / Write / Bash commit / 等)
- 結束方式只有提問(釐清)或 ExitPlanMode(批准)
- 結束 plan mode 後 bias toward 不停下來問,reasonable call 自己做,Owner 會在偏差時 redirect
