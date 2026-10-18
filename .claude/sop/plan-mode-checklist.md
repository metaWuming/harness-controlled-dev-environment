---
title: 開發流程 Checklist(三車道)
type: sop
related: GLOSSARY.md / docs/adr/0001-slim-sop-by-risk-lane.md / docs/DEGRADATION.md
---

# 開發流程 Checklist(三車道)

> 用語(車道、一道 review、一輪、增量審查、已處理清單、嚴重問題、殘留問題)定義在 `GLOSSARY.md`。
> 為什麼這樣分級見 `docs/adr/0001-slim-sop-by-risk-lane.md`。舊版 7 步全文封存在
> `docs/archive/plan-mode-checklist-v1.md`,只供查歷史,不是現行規則。
>
> 外部工具(Codex CLI、gstack、gbrain)都是 optional;沒有時照各步〔降級〕執行,
> 對照表見 `docs/DEGRADATION.md`。

## 0. 先判車道(1 分鐘內做完)

開工前還沒有改動可比對,所以先**預判**,送審前再用機器**複判**:

1. **預判**:自問「預計會不會碰金流、權限、個資、資產轉移、audit trail、CI 設定(`.github/**`)、
   資料庫結構、守門腳本放寬?」會 → **高風險車道**
2. 不會 → 看預計大小:最多 3 個檔**或**最多 100 行 → **快速車道**;否則 → **標準車道**
3. 判不準 → 往上一級
4. **複判**(Step 4 送審前,已有 commit 之後):跑 `npx tsx scripts/check-cso-trigger.ts`,並照實際 diff
   重看大小
   - `CSO_REQUIRED` 且有命中域 → 升為**高風險車道**,補做該車道的步驟
   - `CSO_REQUIRED` 但沒有命中域清單(路徑表空 / base 非法)= 工具未導入或壞掉,先修好再判。
     **模板 repo 本身**的路徑表刻意為空:以自問結果代替,並在 progress entry 記明
   - 實際大小超出快速車道 → 升為標準車道

| | 快速 | 標準 | 高風險 |
|---|---|---|---|
| 計畫檔 | 不寫 | 寫 | 寫 |
| 等 Owner 核准計畫 | 否 | 只在有真實取捨時 | 一律等 |
| 第 1 道 review | Claude `/code-review`,**1 輪** | Codex,**最多 2 輪** | Codex,**最多 3 輪** |
| 安全審 + 破壞性探針 | — | — | 要 |
| 第 2 道 review | — | — | adversarial-reviewer(worktree),**最多 3 輪** |
| 最後全範圍審查 | — | — | 1 次 |
| 視覺關 | diff 碰 UI 才跑 | 同左 | 同左 |

**例外(不走流程,直接 commit)**:typo、純格式、Owner 說「快速做就好」。
但碰到上面自問清單任何一項,就不適用例外。

## 1. Plan(標準 / 高風險)

- 計畫檔寫:為何做、要改哪些檔、**會被影響但不在 diff 裡的檔**(呼叫端、測試、文件)、
  驗證方式、不在範圍、Sensible Defaults(D1…DN,標 `[Owner 可否決]`)
- 起手先用 git 核實記憶層的 hint(progress / TODOS 寫的「下一棒」可能已過時)
- 需要大範圍偵察才派 `.claude/agents/explore-scoped.md`,一個就夠;自己 grep 得完就不派
- 計畫一次寫完整再開工。**計畫本身不另跑 review 輪**

**停點**:有真實取捨(不同選擇導出完全不同成果)→ 問 Owner(`.claude/sop/decision-request-template.md`)。
高風險車道一律等核准。其餘直接開工。

## 2. Go

- 從主線切 feature branch;每個 commit 一個邏輯單位,訊息格式「類別:範圍 — 內容」
- 每個 phase 結束跑 typecheck + lint + test,紅了修到綠才往下
- **先不 push、不開 PR**;review 只讀本地 diff
- 中途浮現真實取捨 → 整理好就問,等待時繼續做不依賴答案的部分

## 3. Step 4:跨模型 Review(第 1 道)

**送審前**:工作樹乾淨、改動已 commit,並做完「0. 先判車道」的複判。記下 `REVIEWED=$(git rev-parse HEAD)`。

**第 1 輪**審整支分支(`origin/<主線>...HEAD`)。**第 2 輪起只做增量審查**:範圍改成
`<上一輪的 REVIEWED>..HEAD`,並把已處理清單一起送進去。每輪之間都要 commit,範圍才會前進。

〔Codex,標準 / 高風險〕顯式指定 model,不靠預設值。⚠️ `codex review` 的 `--base` **不能**和自訂說明
同時使用(CLI 0.162.1 實測),所以每一輪都只用自訂說明(從 stdin 讀),在說明裡寫審查範圍:

```bash
codex review \
  -c 'model="<model>"' -c 'review_model="<model>"' -c 'model_reasoning_effort="high"' - <<'EOF'
審查範圍:`git diff origin/main...HEAD`(第 2 輪起改成 `git diff <上一輪 REVIEWED>..HEAD`)。
也檢查這次改動影響到、但不在 diff 裡的檔案。
以下 finding 已處理,不要重提;除非這次的改動讓它重新成立,並說明是哪一行:
- [R1-1 已修] <一句話>
- [R1-2 不修,理由] <一句話>
EOF
```

- `<model>` 預設清單在 `scripts/check-codex-env.ts` 的 `DEFAULT_ALLOWED_MODELS`(目前 `gpt-6.1-sol`,
  需 Codex CLI ≥ 0.159.1)。gstack `/codex` 走 env var `GSTACK_CODEX_MODEL`
- `codex review` 撞逾時:重跑 1 次 → 改 `/codex challenge` → 再撞才換無逾時的執行方式。撞牆不等於不審

〔Claude,快速車道,或無 Codex 時降級〕Claude Code 內建 `/code-review`。第 2 輪起同樣只給
`git diff $REVIEWED_PREV..HEAD`,並在指示裡貼已處理清單。

**每個 finding 的處置**:

| finding | 處置 |
|---|---|
| 嚴重問題(Codex P1 / Claude CRITICAL) | 一定修。輪數用完也要修完才能合併 |
| 其他、輪數還沒用完 | 會改到執行行為的就修;只是描述不準的,請審查者直接給替換句,照抄後**不為它另跑一輪** |
| 其他、輪數已用完 | 不修。在 progress entry 記成殘留問題,一個一行 |

- fix commit 訊息:`修復: <feature> review round N — <finding>`
- 輪數用完後若還出現嚴重問題:修完只對那個修法跑 1 輪增量審查;再出現嚴重問題就停下問 Owner
- **殘留問題不自動進 TODOS、不自動開 sprint**,Owner 點名才做

**停點**:沒有未修的嚴重問題,且輪數已用完或已收斂 → 往下。

## 4. Step 4.5:安全關(只有高風險車道)

- 跑一輪專責安全審〔預設 gstack `/cso --diff --base <主線> --budget 600`;無 gstack 降級:派
  `security-reviewer` subagent(`.claude/agents/security-reviewer.md`)〕。
  不要改用 `security-review` skill(實測主 session 會在報告後直接結束 turn);
  subagent 回來後在同一個 turn 繼續往下做
- 結果是 INCOMPLETE → 先補資料或排障,再重派。拿到 COMPLETE_CLEAN 或處理完 findings 才算過
- findings:明顯 P1 且只有一種修法 → 直接修。有兩條以上修法、動到範圍外、或可能延後 → 問 Owner
- **破壞性探針**:每個命中域至少一條,`npm run mutate -- --file <檔> --find '<原樣>' --replace '<改壞>' --label '<命中域:不變量>'`。
  工作樹要乾淨才能跑。**exit 0(全被抓)才算過**;exit 1 補測試,exit 2 排障。
  之後只要再有非 bookkeeping 的 commit,就在新 HEAD 重跑探針
- 新增了安全敏感模組 → 把路徑加進 `scripts/cso-trigger.config.ts`

## 5. Step 4.6:視覺關(diff 碰 UI 才跑)

- 把畫面實際跑起來看〔預設 gstack `/design-review`;降級:瀏覽器 / 模擬器截圖〕,不靠讀碼推論外觀
- 對照 `CLAUDE.md` §4.2 的 design token:硬編色碼、繞過 token 一律算 finding
- 至少看桌機與手機寬度;有深色模式兩種都看。CSS-first 框架拼錯 token 會靜默無樣式,要看編譯後的結果

## 6. Step 5:第 2 道 review(只有高風險車道)

- 派 `.claude/agents/adversarial-reviewer.md`,`isolation: worktree`,prompt 附 `review-tip SHA`
  (完整 40 字元 `git rev-parse HEAD`)。它從 diff 出發,不去驗證第 1 道的結論
- 輪數、增量審查、已處理清單、finding 處置,都照 Step 4 的規則
- 每次 fix 後 HEAD 前進 → 派新的 agent(新 worktree),綁新 SHA
- **最後全範圍審查**:第 1、2 道都收乾後,對 `origin/<主線>...HEAD` 整段再審 1 次,
  補增量審查可能漏掉的「新舊改動互相影響」。只修嚴重問題

### bookkeeping 的定義(唯一正本)

收乾之後才 commit 的狀態簿記,不為它重跑 review 或探針。diff 只能動這些檔:
`.claude/memory/progress.md`、`.claude/memory/progress-archive/*.md`(`README.md` 除外)、
`TODOS.md` / `BACKLOG.md` / `TODOS-done.md`(root 或 `.claude/memory/`)。
`LESSONS.md`、任何規則或安全文字都不算。commit 後跑 `npm run check:bookkeeping` 機器核對。

## 7. Progress entry(三條車道都要,進 feature branch 最後一個 commit)

在 `.claude/memory/progress.md` 最上方加一條,**3–5 行**:

```markdown
📅 YYYY-MM-DD ⓝ — **一句話標題**

> **車道**:<快速|標準|高風險>(判定理由一句)
> **做了什麼**:N 檔,一句話
> **審查**:Codex round N(或 Claude code-review round N),0 P1;殘留問題:無 / ①… ②…
> 📊 成本:review N rounds / P1 X 個 / P2 X 個
> **下一步**(hint 非 truth):…
```

- `📊 成本` 行由 `npm run health:weekly` 解析成審查趨勢,格式照抄
- **標準 / 高風險車道沒有 Codex、改用 Claude 審查時**,審查行之前另起一行,行首寫
  `> 降級 Claude:<原因,例如 Codex CLI 不可用>`,CI 才會放行;只有快速車道免寫這行

- CI 會檢查這條 entry 有 review 紀錄與「0 P1」之類的收斂字樣(`scripts/check-progress-codex-review.ts`)
- 快速車道用 Claude 審時,`> **車道**:快速` 要放在行首,而且同一行不能再出現「標準」或「高風險」,CI 才認得
- 高風險車道多記一行:命中域、每條探針的 exit code 與綁定 SHA
- 先 `grep -nE '⚠️ (partial|paused)' .claude/memory/progress.md`:有同 sprint 的未完成 entry 就就地改寫,不另加一條
- 只寫合併前就知道的事(不寫 PR 號、squash SHA、CI 結果)

## 8. Step 6:Push + PR + CI

- **commit 之後**再跑一次完整本地 gate(有些 gate 掃 commit 訊息,commit 前跑會漏)
- push + 開 PR,描述寫 Summary / 改了什麼 / Test plan
- TODOS 有新的 ✅ 條目 → 開 PR 後把 `PR #___` 補成本 PR 號再 push
- CI 綠 → squash merge。CI 抓到本機沒抓到的 → 修一輪再 push;高風險車道的非 bookkeeping 修復要重跑探針

## 9. Step 7:收尾

- 新踩的坑寫進 `.claude/memory/LESSONS.md`,並告訴 Owner
- progress.md 太長 → 照 `.claude/memory/progress-archive/README.md` 歸檔
- 通知 Owner 收工

## 超出單次改動的節奏

- **EPIC 收尾或每週**:整批改動跑一次較輕的安全審(看跨多個 diff 的破洞),並把教訓整理進 LESSONS
- **首次上線 / 第一個真用戶前**:對整個攻擊面跑重型安全審
- **階段工具**(E2E、部署 checklist、效能量測):條件到位才接進 Step 6/7,之前不強加
- **除錯**:先固定重現,再二分定位,最後補測試
