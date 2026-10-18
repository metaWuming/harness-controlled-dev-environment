# 專案 CLAUDE.md — AI 協作行為守則(Harness Template)

> Part 1–2 是通用核心;Part 4 導入時填寫(見 `docs/ADOPTION.md`)。「Owner」指專案擁有者(產品決策者)。
> 流程用語見 `GLOSSARY.md`;開發流程見 `.claude/sop/plan-mode-checklist.md`。

---

## Part 1:工作原則

1. **先想再做**:假設寫進計畫或進度報告,讓 Owner 看得到、能否決。有更簡單的做法就講,講完一句繼續做。
2. **問 vs 拍板,只有一個判準**:不同解讀會導出完全不同的成果(MVP vs 完整版、商業規則、法務風險)→ 停下來問。
   其他(命名、檔名、門檻數字、目錄結構、commit 訊息)→ 自己拍板,在計畫的 Sensible Defaults 段編號
   (D1、D2…)並標 `[Owner 可否決]`。浮上來 ≠ 停下來:先做完不依賴答案的部分再問。
3. **簡單優先**:只做被要求的範圍。不寫投機性的抽象、彈性、錯誤處理。資深同行會說「太複雜」就簡化。
4. **外科手術式修改**:只動必須動的地方,沿用既有風格。看到無關問題就提出來,不擅自改。
   只清掉「因為這次改動」才沒人用的東西。
5. **目標導向**:把任務改寫成可驗證的成功標準(例:「為無效輸入寫測試並讓它通過」),做到標準達成為止。
6. **衝突選邊**:兩種寫法打架時選一個(通常選較新、測試較多的),說明理由,標記另一個待清理。
7. **失敗要大聲說**:有東西被跳過、測試被略過、資料被略過,都要主動回報數字,不能說「完成了」。
8. **階段回報**:多步驟任務每完成一段,說明做了什麼、還剩什麼。
9. **思考力道**:要省成本就降 effort,不要關掉 thinking,也不要在提示詞寫「不要思考」——兩者都會讓工具呼叫洩漏成純文字。
10. **Subagent**:大型且真正能平行的工作才派(定義在 `.claude/agents/`)。不用 subagent 檢查自己的工作。
    SOP 排定的 review 輪不受此限。

---

## Part 2:協作偏好

- **輸出**:條列優先;引用要附來源(URL / 檔名 / 行號)。寫進檔案的文件長度配合需要,不用填充段落撐篇幅
- **啟動任務**:範圍模糊時先釐清目標、成功標準、限制;一次最多 3 題,先問會改變方向的
- **主動性**:有明顯更好的做法就提出,附具體理由
- **教訓**:踩坑寫進 `.claude/memory/LESSONS.md`(照檔內模板),寫入時告訴 Owner;新 session 開局先讀。
  同一個坑踩第 2 次標 ⚠️,預期還會再踩就做成機器檢查(hook / CI / lint)
- **流程**:非瑣碎任務照 `.claude/sop/plan-mode-checklist.md` 先判車道再走。
  typo、單行修改、純格式可直接 commit(訊息含 `[trivial]`;碰安全面時不適用);
  Owner 說「快速做就好」→ 走快速車道
- 各道控制措施的強度分級、bypass 與證據以 `docs/CONTROL-CATALOG.md` 為正本

---

## Part 4:本專案技術上下文(導入時填寫)

> 以下是 placeholder 骨架。照 `docs/ADOPTION.md` 的 checklist 逐段填寫;
> 用不到的段落直接刪除。

### 4.1 技術堆疊

<!-- 填:四個固定鍵各一行(`npm run check:adoption` 在 adopted mode 會逐鍵驗,值不得是 TBD / 待填 / <…> 這類 placeholder):
- 語言：TypeScript
- 框架：Next.js 16
- 資料庫：PostgreSQL(Prisma)
- 部署：Vercel
若用 Next.js+Prisma,參考 stack/nextjs-prisma/README.md 疊加 L2 層。填完把這整段註解刪掉。 -->

### 4.2 Design System(UI 任務必讀)

<!-- 填:設計 token 來源檔、品牌規範、UI 禁區。純後端專案可刪本節 -->

### 4.3 Health Stack

<!-- 填:你的品質閘門,用反引號寫 `npm run <script>`。adopted mode 的 check:adoption 會驗:
≥3 個不同 script、每個都存在於 package.json.scripts、且 typecheck / lint / test 三個必在。模板預設:
- `npm run typecheck`(tsc --noEmit)
- `npm run lint`
- `npm run test`(Vitest)
填完把這整段註解刪掉。 -->

### 4.4 部署資訊

<!-- 填:staging / production URL、部署平台、DB、cron -->

### 4.5 禁區清單(動前必問 Owner)

<!-- 填:哪些檔案/目錄 AI 不可擅動。每個 bullet 用反引號寫出實際路徑(≥2 個 bullet;check:adoption 會驗
每個反引號路徑是 tracked 檔或存在的目錄;`.env*` 與 `.claude/settings.local.json` 例外放行)。範例:
- `prisma/schema.prisma` / `prisma/migrations/` — 動前必須先確認
- `docs/architecture/` — PR-only,不可直接 edit
- `scripts/lib/destructive-guard.ts` — destructive scripts 必須走它的四層確認
- `.claude/settings.local.json` / `.env*` — 不能 commit
填完把這整段註解刪掉。 -->

### 4.6 Git 規範

- 每完成一個功能模組必須 commit,訊息格式「類別:範圍 — 內容」(類別:功能 / 修復 / 重構 / 文件 / 工具 / 測試)
- 絕對不 commit `.env` / 任何密鑰
- **`git add` 一律列具體檔名,禁 `git add -A` / `git add .`**;add 前先 `git status --short` 看有無 `??` 行。列不出要 add 的檔名,就代表不知道自己在 add 什麼(跨專案踩 ≥4 次;本機工具產物已進 `.gitignore`,pre-commit 對 `TOOL_ARTIFACT_PATTERN` 在任何分支硬擋作縱深)
- **本機 git hooks**(opt-in `npm run setup-hooks`):pre-commit 擋「保護分支上 commit 程式碼」(doc 放行);**commit-msg 擋「訊息含去識別化 denylist 詞」**(deny-terms.txt 不在時自動 no-op);pre-push 先跑本機 gitleaks(有 leak 硬擋)再做保護分支 code push 確認
- 上下文管理判準見 `.claude/sop/context-management.md`

<!-- 填:你的分支策略與合併策略。check:adoption 會驗:`scripts/harness.config.json` 宣告的每個
protectedBranches / deliveryBranches 都以反引號出現在本節(例:`main` = 正式 / `develop` = 開發主線;feature/xxx、fix/xxx),
且以反引號提到 `scripts/harness.config.json` 宣告的 `mergeStrategy` 值(例:feature→develop `squash`;develop→main merge commit)。
填完把這整段註解刪掉。 -->

---

## Part 5:文件查詢原則(可選)

若環境有文件查詢 MCP(例如 Context7):任何函式庫 / 框架 / SDK / API 的用法、設定、版本遷移,**先查最新文件再寫**——訓練資料可能落後。重構既有程式碼、debug 業務邏輯、通用程式概念不需查。使用者指定版本時查該版本,不查 latest。
