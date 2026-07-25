---
title: QUICKSTART — 從模板開新專案的操作備忘
type: guide
related: docs/ADOPTION.md / docs/EFFORT.md
---

# 從模板開新專案 — 操作備忘

> 2026-07-04 建立|**最後更新 2026-07-25**(模板做完 Opus 5 校準與依賴升級後同步)
> 適用:在 Claude Code 開任何新專案時,讓它從第一天就依循可控開發環境
> 模板:`github.com/metaWuming/harness-controlled-dev-environment`(GitHub template)
> 全程約 30–40 分鐘,你只做 Step 1–3,其餘 AI 做。

**本檔與 [`ADOPTION.md`](ADOPTION.md) 的分工**:

| 檔 | 回答什麼 | 誰執行 |
|---|---|---|
| **QUICKSTART**(本檔) | repo 怎麼開、放哪、第一句話對 AI 說什麼、卡住了怎麼辦 | **你**(前 3 步在終端機) |
| **ADOPTION** | repo 開好之後,模板裡有哪些位置要填實值 | **AI**(照 checklist 逐項) |

先走本檔,它會叫 AI 去走 ADOPTION。

---

## 你做的三步(終端機)

### Step 1|從模板建新 repo

```bash
gh repo create <你的帳號>/新專案名 \
  --template metaWuming/harness-controlled-dev-environment \
  --private --clone
```

或走 GitHub 網頁:模板 repo 首頁綠色 **Use this template** → Create a new repository。
模板 private 沒關係,自己用不受影響。

### Step 2|放到工作區慣例位置

```bash
mkdir -p ~/Claude_Workspace/Projects/新專案中文名
mv 新專案名 ~/Claude_Workspace/Projects/新專案中文名/
cd ~/Claude_Workspace/Projects/新專案中文名/新專案名
```

(這是一種可行慣例:`Projects/中文專案名/repo名/`;你有自己的工作區結構就照你的)

### Step 3|裝依賴 + 啟用本機防護欄

```bash
node -v            # 要 ≥ 22.13(模板 engines 下限,eslint 10 要求)
npm install && npm run setup-hooks
```

之後 pre-commit 分支守衛、pre-push gitleaks 自動生效。

---

## AI 做的部分(開 Claude Code 後)

### Step 4|第一句話直接貼這段

> 這是從 harness-controlled-dev-environment 模板建立的新專案。請照 `docs/ADOPTION.md`
> 的導入 checklist 逐項執行(含 §2.5 思考力道與 agent 定義):先問我這個專案要做什麼、
> 用什麼技術堆疊,然後填 CLAUDE.md Part 4、設 `.claude/settings.json` 的 effortLevel、
> 改 destructive-guard 旗標名、填 `scripts/cso-trigger.config.ts` 安全敏感路徑表
> (依專案性質)、設定分支策略、改寫 README 為本專案說明。
> 遇到商業決策問我,其他照 sensible default 拍板給我否決。

**留意 AI 有沒有問你這三項**(最重要的三個客製點):

1. **安全敏感路徑表**(金流/個資/權限/資產轉移/audit 五域)——決定日後哪些改動
   會強制觸發安全審查
2. **禁區清單**(CLAUDE.md §4.5)——哪些檔案 AI 動之前必須先問你
3. **effortLevel**(`.claude/settings.json`)——實作為主的專案設 `xhigh`;
   文件 / 規劃為主設 `high` 或 `medium`。**這條直接決定每次 session 的成本與速度**,
   出貨預設是 `high`(模型原生預設,不改也能跑)。理由與每步建議值見 `docs/EFFORT.md`

> **專案有 UI 的話再多一項**:CLAUDE.md §4.2 要填 design token 來源檔,
> 否則 SOP 的 Step 4.6 視覺關沒有對照基準(純後端專案不必,視覺關永遠不觸發)。

### Step 5|(條件式)疊 L2 層

新專案用 Next.js + Prisma → 跟 AI 說:

> 照 `stack/nextjs-prisma/README.md` 把 L2 層裝上

得到 4 支租戶隔離 AST 規則 + migration 守衛。不是這個堆疊 → 跳過,`stack/` 目錄可整個刪。

### Step 6|(建議)設 branch protection

> 幫我設 GitHub branch protection:主線要求 CI pass

---

## 不用做的事

- **gstack / Codex / gbrain**:機器上已全域安裝,新專案自動可用
- **take5 / hi5**:全域 skill,直接喊
- **記憶層**:不用初始化——progress/LESSONS/TODOS 模板已就位,第一個 sprint
  收尾 AI 自然開始寫
- **effort 分層**:SOP 每步已標建議值(`docs/EFFORT.md`),AI 照走即可。
  你只要在 Step 4 決定專案預設值就好
- **subagent 定義**:`.claude/agents/` 已附兩支(蒐脈絡 / 獨立審 diff);
  委派規則本身在 `CLAUDE.md` 原則 5.5

之後每個 sprint 都是同一套:說需求 → AI 進 plan mode → 7 步 SOP 自動走
(其中 Step 4.5 安全關、4.6 視覺關是條件式,碰到才觸發)。

---

## 疑難排解

| 狀況 | 處理 |
|---|---|
| `gh: command not found` | 先 `brew install gh` 再 `gh auth login` |
| CI 的 Source-term scan 紅了 | 那是模板的去識別化 gate(掃「來源專案識別詞」)。新專案不需要 → 跟 AI 說「照 ADOPTION.md §6 移除去識別化 gate」;或把 `scripts/deny-terms.txt` 換成你要防的詞 |
| hooks 沒生效 | 每台機器、每次重新 clone 都要跑一次 `npm run setup-hooks` |
| 本機沒裝 gitleaks | `brew install gitleaks`(沒裝 pre-push 會提示放行,不會擋) |
| `npm install` 警告 engine 不符 | 模板要求 **Node ≥ 22.13**(eslint 10 的實際下限)。`nvm use 22` 或升級 Node |
| CI 的 `npm audit` 紅了 | 那是 high/critical 硬 gate,不是誤報。先 `npm audit fix`;若提示需 major 升級,**先查 peer 範圍再升**(例:`npm view typescript-eslint peerDependencies.typescript` 沒放寬就別跟著升 TypeScript major) |
| dependabot 推 `@types/node` major | **預設擋掉了**(`.github/dependabot.yml` 有 ignore 規則)。它要對齊 `engines.node` 的下限,不是追最新——types 比 runtime 新會讓程式碼 typecheck 過但 runtime 沒那個 API |
