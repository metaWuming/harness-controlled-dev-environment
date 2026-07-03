# Harness-Controlled Dev Environment

> **EN overview** — A batteries-included harness template for AI-assisted software development
> (Claude Code and similar coding agents). It packages feed-forward *Guides* (working principles,
> plan-mode SOP, memory conventions) and feedback *Sensors* (git hooks, secret scanning, CI gates,
> self-checking scripts) refined over 80+ real development sprints. Click **Use this template**,
> follow `docs/ADOPTION.md`, and your repo starts with guardrails on day one.
> This harness is maintained in Traditional Chinese; scripts and CI are language-neutral.

AI 協作開發的**可控安全環境模板**。把「前饋 Guides + 回饋 Sensors」的 harness 工程
打包成 GitHub template：按下 Use this template，新專案第一天就有防護欄。

## 這是什麼

**Agent = Model + Harness**。模型很強，但沒有 harness 的 agent 會重複犯錯。
本模板把一套經 80+ 個實戰 sprint 打磨的 harness 抽取成通用核心：

| 層 | 內容 | 位置 |
|---|---|---|
| **L1 通用核心** | 工作原則(CLAUDE.md)、Plan Mode SOP、記憶層慣例、git hooks、CI 安全掃描、自檢腳本 | repo top-level(開箱即用) |
| **L2 堆疊層** | Next.js + Prisma 專用:ESLint AST 規則、migration 守衛、CI 片段 | `stack/nextjs-prisma/`(opt-in) |
| **L3 專案層** | 你的業務知識、安全域路徑表、實際教訓 | 不在模板內,由你累積 |

## 快速上手

1. **Use this template** 建立你的 repo
2. 讀 [`docs/ADOPTION.md`](docs/ADOPTION.md) 走完導入 checklist(改旗標名、填安全域路徑表、設定分支)
3. `npm install && npm run setup-hooks` 啟用本機 git hooks
4. (若用 Next.js+Prisma)照 [`stack/nextjs-prisma/README.md`](stack/nextjs-prisma/README.md) 疊加 L2 層

## 內容物導覽

- `CLAUDE.md` — AI 協作工作原則(Part 1 通用原則 / Part 2 協作偏好 / Part 3 放寬規則),Part 4 留白給你的技術上下文
- `.claude/sop/` — Plan Mode 7 步 SOP、上下文管理判準
- `.claude/memory/` — progress / LESSONS 記憶層格式模板(內容空白,由你的專案累積)
- `scripts/` — 自檢腳本(TODOS marker 治理、文件引用驗證、安全審查觸發判定、週健檢骨架)+ git hooks
- `.github/workflows/ci.yml` — 常駐安全掃描(gitleaks 全史 + npm audit high)+ 品質閘門
- `docs/` — 導入指南、外部依賴降級路徑、擴充評估

## 設計哲學

1. **每當 agent 犯錯,就在環境裡工程化一個永久修復**(Hashimoto, 2026)
2. **教訓 → 機器的升級階梯**:第 1 次踩寫 LESSONS → 重複踩升 RUNBOOK → 預期再踩就機器化(hook / CI gate / lint rule)
3. **守門要常駐不要事件**:一次性掃過乾淨只代表當下,掛進 CI 才是永久保證
4. **Keep quality left**:檢查越早跑越便宜——本機 hook > CI > review > production

## License

MIT
