# Harness-Controlled Dev Environment

**A batteries-included harness template for AI-assisted software development.**
**AI 協作開發的可控安全環境模板 —— 開箱即用的 GitHub template。**

[English](#english) | [繁體中文](#繁體中文)

---

## English

### What is this

A "controlled, safe development environment" that lets a **product owner — even one
without an engineering background** — collaborate with AI coding agents (Claude Code
and similar) on production software, long-term.

The core formula comes from the industry *Harness Engineering* framework:
**Agent = Model + Harness**. The model (Claude / GPT) sets the intelligence ceiling,
but the harness — everything in the environment *around* the model — sets the error
floor. This template is built on a single philosophy:

> **Every time the agent makes a mistake, engineer a permanent fix into the
> environment.** (Mitchell Hashimoto, 2026)

It was battle-tested on a real production system: 8 months, 80+ sprints, 320+ pull
requests, 2,300+ automated tests — covering payments, member PII, and multi-tenant
isolation — built by a single non-engineer owner working with AI. Every gate in this
template exists because a real mistake happened on that production line and was
distilled into machinery.

### Two directions, four groups of gates

Harness components run in two directions (Fowler / Böckeler):

- **Feed-forward guides** — steer the agent *before* it acts, raising the odds it
  gets things right the first time
- **Feedback sensors** — detect errors *after* it acts, so it can self-correct

The template ships 13 gates in four groups:

| Group | Gates |
|---|---|
| **1. Feed-forward guides** (before acting) | ① Three-part conduct rules (`CLAUDE.md`: working principles / collaboration preferences / relaxation rules, with "sensible defaults, owner can veto" D-numbering) ② Plan-Mode 7-step SOP with explicit STOP points and per-step **effort guidance** (`.claude/sop/plan-mode-checklist.md`, `docs/EFFORT.md`) ③ Governed memory layer (`progress.md` / `LESSONS.md` / `TODOS.md` — completion claims must cite a merged pull-request number with real evidence; CI verifies) |
| **2. Local feedback** (before code leaves the machine) | ④ Per-phase quality gate (typecheck + lint + tests, incl. custom AST lint rules written for your own failure modes) ⑤ Git hooks in depth (pre-commit protected-branch guard; commit-msg de-identification check; pre-push local gitleaks — secrets and source-project terms are stopped *before* they leave the machine) ⑥ Four-layer destructive-operation guard (env flag + confirm token + dry-run default + summary) |
| **3. Review layer** (before pushing) | ⑦ Cross-model adversarial review, iterated to zero findings — carrying three round-compression disciplines (classify each finding *behavioral vs prose* so a wording fix never burns a confirmation round; harden "self-check once more" into executable probes — mutation probe for new machinery, tick-reachability question for changed timing, quantifier self-check for new claims; audit an invariant's *compliance*, not just its prose) and a **quantifier self-check tool** (`check:claims`) that flags over-claiming — "only / sole / each alone suffices / comprehensive" — in your own diff's added lines *before* it reaches the reviewer. It is deliberately a to-do-list generator, **not** a blocking CI gate: quantifiers have legitimate uses, so a hit means "you must be able to enumerate the set this sentence claims," not "you were wrong" ⑧ Conditional security review with **machine-decided triggering** (`check-cso-trigger` matches the full change surface — committed+staged+unstaged+untracked — against your sensitive-path table; the machine verdict is a floor, not a ceiling). When it returns `CSO_REQUIRED` with a matching-domain list, the sprint enters the **high-risk lane**: destructive mutation probes (via `scripts/mutate.ts`, exit 0 gate) plus a second worktree-isolated review in gate ⑩ ⑨ **Conditional visual review** — when the diff touches UI, the change must be *rendered and screenshotted*, then checked against your design tokens; inferring appearance from source code does not count ⑩ Second review pass (design-level risk, cross-file consistency) — all reviews run on the *local* diff, so the PR opens already clean; the high-risk lane adds a **second worktree-isolated review** here (fresh checkout, review-tip SHA binding) so any dependency on uncommitted local state gets caught |
| **4. Remote & long-term** (after pushing) | ⑪ Always-on CI gates (least-privilege `GITHUB_TOKEN`, SHA-pinned actions, full-history gitleaks with pinned binary + sha256, dependency audit hard-gate on high/critical, doc-reference integrity, TODOS marker governance, full test suite) ⑫ Weekly health check — three collectors: work backlog, lesson-production rate, and **review-dulling detection** (review rounds and P1 counts per sprint, parsed from progress cost fields) ⑬ Quarterly retro (archive mechanized lessons, keep the memory lean, scan doc cross-references for drift) |

> **On gate ⑫ — what is and isn't implemented.** The weekly health check ships three
> working collectors. Two further harness-self metrics — *lesson-mechanization rate* and
> *memory-archive parser drift* — are **specified but deliberately not implemented**: both
> need a marker convention established in `LESSONS.md` and the archive stubs first, and
> shipping them before that would produce a number that looks like a measurement but isn't.
> See the TODO in `scripts/weekly-health-check.ts`.

### The lesson-to-machine ladder (the soul of this harness)

Individual gates are not the point — how they *grow* is. Every lesson climbs the
same ladder:

1. **First hit** → written into `LESSONS.md` (four-part format: situation / mistake /
   root cause / prevention; every new session reads it first)
2. **Second hit** → entry flagged ⚠️ repeated
3. **Third hit or expected to repeat** → codified into a runbook / SOP
4. **Still hitting** → **mechanized**: wrapper script, git hook, CI gate, custom lint rule

At least 7 of the 13 gates above are products of this ladder. **The harness was not
designed — it was distilled from mistakes.**

The newest rung shows the ladder still running: the review layer's long tail kept
being spent re-fixing the *same* over-claimed sentence — "A and B are both cleared"
(B was never called) → "the only reason it holds is A" (C also holds it) — round after
round on one line. Third hit, so it was mechanized into the quantifier self-check tool
(`check:claims`, gate ⑦). Note the honest shape of that rung: it is a review-time to-do
generator, **not** a blocking gate — quantifiers have too many legitimate uses to hard-block,
so a denylist-by-value would just breed the anti-pattern this template warns against.

One meta-lesson deserves special mention, verified repeatedly across 8 months of
dual-model review: **cross-model agreement ≠ correctness.** Two models finding
almost non-overlapping issues is why this SOP runs two independent reviews — and why
"model X says it's fine" is never accepted as evidence.

### Three layers

| Layer | Content | Where |
|---|---|---|
| **L1 generic core** | Conduct rules, SOPs, effort policy, subagent definitions, memory templates, self-check scripts, git hooks, CI security scanning | Repo top-level — works for any stack, any language |
| **L2 stack layer** | Next.js + Prisma specific: 4 custom ESLint AST rules, migration guard, CI snippets | [`stack/nextjs-prisma/`](stack/nextjs-prisma/README.md) — opt-in |
| **L3 project layer** | Your domain knowledge, your sensitive-path table values, your actual lessons | Not shipped — accumulated by each project |

### Quick start

1. Click **Use this template** to create your repo
2. `npm install && npm run setup-hooks` to enable local git hooks (needs Node ≥ 22.13)
3. Walk through [`docs/ADOPTION.md`](docs/ADOPTION.md) — fill in your tech context,
   your effort level, your security-sensitive path table, your branch strategy
4. Using Next.js + Prisma? Layer on
   [`stack/nextjs-prisma/README.md`](stack/nextjs-prisma/README.md)

Prefer a step-by-step walkthrough with the exact prompt to paste into your coding
agent? See [`docs/QUICKSTART.md`](docs/QUICKSTART.md) (written in Traditional Chinese,
like the rest of the harness docs — see the language note below).

### Design principles

- **Dogfooding** — this template eats its own gates: its CI runs gitleaks over full
  history, runs its own self-check scripts, runs 221 tests, plus a de-identification
  scan that keeps source-project terms out of the template forever
- **Degradation paths are written down** — every external tool the SOP references
  (Codex CLI, gstack skills, gbrain) is optional; each reference carries a
  "what to do without it" note ([`docs/DEGRADATION.md`](docs/DEGRADATION.md)).
  The skeleton of the process depends on no single tool
- **Keep quality left** — the earlier a check runs, the cheaper the fix:
  local hooks → per-phase gates → pre-push reviews → CI → production never

### For adopters

1. Start from the template, not from scratch — the ADOPTION checklist is 30 minutes
2. **Don't skip the memory layer** — tooling catches known errors; memory catches
   unknown ones
3. Review with two models from different vendors — single-model blind spots are
   systematic
4. Accept that it keeps growing — this environment is never "done"; every new
   mistake is the blueprint for the next gate

### Language note

The harness documents (CLAUDE.md, SOPs, memory templates) are maintained in
**Traditional Chinese** — they were refined over 80+ real sprints in that language,
and translation would risk semantic drift. Scripts, CI, and code comments are
language-neutral in structure; an English-first adopter can translate the docs once
at adoption time (the formats are simple and stable).

### References

- Mitchell Hashimoto, *engineering the harness* (2026-02)
- Martin Fowler / Birgitta Böckeler, *Harness engineering for coding agent users* (2026-04)
- Anthropic, *Effective harnesses for long-running agents* (2026)

### License

MIT

---

## 繁體中文

### 這是什麼

一套讓**非工程背景的產品擁有者**也能與 AI coding agent(Claude Code 等)長期協作
開發正式產品的「可控安全環境」。

核心公式來自業界 Harness Engineering 框架:**Agent = Model + Harness**。
模型(Claude / GPT)決定智力上限,但 harness——模型以外的一切環境工程——決定
錯誤率下限。本模板的建造哲學只有一句:

> **每當 AI 犯錯,就在環境裡工程化一個永久修復。**(Mitchell Hashimoto, 2026)

它在真實產線上驗證過:8 個月、80+ 個 sprint、320+ 個 pull request、2,300+ 個
自動化測試——涵蓋金流、會員個資、多租戶隔離等高風險面——由一位無技術團隊的
產品擁有者與 AI 協作完成。模板裡的每一道關卡,都是那條產線上真實犯過的錯
蒸餾成的機器。

### 兩個方向、四組關卡

Harness 元件分兩個方向(Fowler / Böckeler 框架):

- **前饋 Guides**:在 AI 行動**之前**引導它,提高第一次就做對的機率
- **回饋 Sensors**:在 AI 行動**之後**偵測錯誤,讓它自我修正

模板內建 13 道關卡,分四組:

| 組 | 關卡 |
|---|---|
| **一、前饋守則層**(行動前) | ① 三層行為守則(`CLAUDE.md`:工作原則/協作偏好/放寬規則,含「明智預設可否決」D 編號機制) ② Plan Mode 7 步 SOP,每步有明文 STOP point 與**思考力道建議**(`.claude/sop/plan-mode-checklist.md`、`docs/EFFORT.md`) ③ 有治理的記憶層(`progress.md` / `LESSONS.md` / `TODOS.md`——完成宣稱必須引用有真實 merge 證據的 pull request 編號,CI 會驗) |
| **二、本機回饋層**(離開機器前) | ④ 每 phase 品質閘門(typecheck + lint + 測試,含為自己失敗模式手寫的 AST lint 規則) ⑤ git hooks 縱深(pre-commit 保護分支守衛;commit-msg 訊息去識別化檢查;pre-push 本機 gitleaks——密鑰與來源專案識別詞**離機前**就攔) ⑥ destructive 操作四層守衛(環境旗標+確認 token+dry-run 預設+執行摘要) |
| **三、審查層**(推出去之前) | ⑦ 跨模型對抗審查,迭代到 0 findings——內建三條**壓輪數紀律**(每個 finding 標**行為級／散文級**,散文級照抄替換句、不另跑確認輪;把「再自檢一遍」加硬成可執行探針——新機制跑 mutation 探針、改時序先問哪條測試的 tick 推不到、新宣稱句跑量詞自檢器;不變量要連**守法**一起審、不只審那句敘述),外加一支**量詞自檢器**(`check:claims`)——在你自己的 diff 新增行裡、送審**之前**先揪出過度宣稱(「只有／唯一／各自都足夠/全面」)。它刻意是**待處置清單產生器、不是會擋的 CI gate**:量詞在說明文字裡有大量合法用途,命中不代表寫錯,代表「這句話宣稱的那個集合,你得列得出來」 ⑧ 條件式安全審查,**觸發判定機器化**(`check-cso-trigger` 對完整變更面〔committed+staged+unstaged+untracked 四源聯集〕比對你的敏感路徑表;機器判定是下限不是上限)。判 `CSO_REQUIRED`(含命中域清單)時 sprint 進**高風險車道**:破壞性 mutation 探針(`scripts/mutate.ts`,exit 0 硬 gate)+ 關卡⑩ 再加一輪 worktree 獨立審 ⑨ **條件式視覺審查**——diff 碰 UI 時必須**把畫面跑起來截圖**再對照 design token,**讀程式碼推論外觀不算數** ⑩ 第二道審查(設計層風險、跨檔一致性)——所有審查都對**本地 diff** 做,PR 一開出來就是乾淨版;高風險車道在這裡**多加一輪 worktree 獨立審**(全新 checkout、review-tip SHA 綁定),抓「依賴本地未提交狀態」型的錯 |
| **四、遠端與長期層**(推出去之後) | ⑪ CI 常駐閘門(`GITHUB_TOKEN` 最小權限、actions SHA-pin、gitleaks 全史掃描〔pinned binary+sha256 校驗〕、依賴稽核 high/critical 硬擋、文件引用完整性、TODOS marker 治理、全套測試) ⑫ 週健檢——三個 collector:工作累積、教訓產出速率、**審查鈍化偵測**(每 sprint 的 review 輪數與 P1 數,從 progress cost field 解析) ⑬ 季 retro(封存已機器化教訓、記憶防膨脹、掃文件交叉引用防漂移) |

> **關卡⑫ 的實作邊界(誠實揭露)。** 週健檢目前有三個**能跑**的 collector。另外兩個
> harness 自省指標——*教訓機器化率* 與 *記憶歸檔解析漂移*——是**已規格化但刻意未實作**:
> 兩者都需要先在 `LESSONS.md` 與 archive stub 建立 marker 慣例,在那之前硬做只會生出
> 「看起來像量測、其實不是」的數字。見 `scripts/weekly-health-check.ts` 內的 TODO。
>
> 這條揭露本身就是本模板原則 7「失敗要大聲說」的自我適用——README 曾把三個指標
> 都寫成已實作,那是過度宣稱。

### 教訓 → 機器的升級階梯(本環境的靈魂)

單一關卡不稀奇,稀奇的是它們怎麼長出來的。每條教訓走同一條階梯:

1. **第 1 次踩**:寫進 `LESSONS.md`(四段格式:情境/錯誤/根因/避免;新 session 開局必讀)
2. **第 2 次踩**:條目標 ⚠️ 重複錯誤
3. **第 3 次踩或預期再踩**:寫進 runbook / SOP
4. **仍會踩**:**機器化**——wrapper 腳本、git hook、CI gate、自訂 lint 規則

上面 13 道關卡至少 7 道是這條階梯的產物。**Harness 不是設計出來的,是從錯誤裡
蒸餾出來的。**

最新一階正好示範這條階梯還在跑:審查的長尾輪次一直在修**同一句**過度宣稱——
「A ＋ B 一起清空」(B 根本沒被呼叫)→「成立的理由只有 A」(其實還有 C)——整整
幾輪都卡在同一行。踩到第三次,於是機器化成量詞自檢器(`check:claims`,關卡⑦)。
注意這一階誠實的形狀:它是**審查時的待處置清單產生器、不是會擋的 gate**——量詞的
合法用途太多,硬擋只會逼出「以值為準的白名單」,那正是本模板一再警告的反模式。

還有一條反覆驗證的 meta 教訓值得單獨講:**cross-model agreement ≠ correctness**。
8 個月的雙模型審查數據顯示,兩個模型找到的問題幾乎不重疊——這正是 SOP 要跑
兩道獨立審查的原因,也是為什麼「某模型說沒問題」永遠不被當成證據。

### 三層拆法

| 層 | 內容 | 位置 |
|---|---|---|
| **L1 通用核心** | 守則、SOP、effort 策略、subagent 定義、記憶模板、自檢腳本、git hooks、CI 安全掃描 | repo top-level——任何堆疊、任何語言可用 |
| **L2 堆疊層** | Next.js+Prisma 專用:4 支自訂 ESLint AST 規則、migration 守衛、CI 片段 | [`stack/nextjs-prisma/`](stack/nextjs-prisma/README.md),opt-in |
| **L3 專案層** | 你的業務知識、敏感路徑表實值、實際累積的教訓 | 不在模板內——由每個專案自己長 |

### 快速上手

**逐步操作備忘(含要貼給 AI 的那段話、疑難排解)**:
[`docs/QUICKSTART.md`](docs/QUICKSTART.md) —— 第一次導入建議直接照它走。

濃縮版:

1. 按 **Use this template** 建立你的 repo
2. `npm install && npm run setup-hooks` 啟用本機 git hooks(需 Node ≥ 22.13)
3. 走一遍 [`docs/ADOPTION.md`](docs/ADOPTION.md) 導入 checklist:填技術上下文、
   設 effort 力道、填安全敏感路徑表、設分支策略
4. 用 Next.js+Prisma?照 [`stack/nextjs-prisma/README.md`](stack/nextjs-prisma/README.md)
   疊加 L2 層

### 設計原則

- **Dogfooding**:模板自己吃自己的 gate——CI 跑 gitleaks 全史、跑自檢腳本、
  跑 221 個測試,還多一道去識別化掃描(確保來源專案詞彙永遠進不了模板)
- **降級路徑明文化**:SOP 引用的外部工具(Codex CLI、gstack、gbrain)全部
  optional,每個引用旁附「沒有時怎麼辦」([`docs/DEGRADATION.md`](docs/DEGRADATION.md))
  ——流程骨架不依賴任何單一工具
- **Keep quality left**:檢查越早跑修得越便宜——本機 hook → 每 phase 閘門 →
  push 前審查 → CI → 絕不留到 production

### 給導入者的四條建議

1. 從模板開始,不要從零開始——ADOPTION checklist 約 30 分鐘
2. **不要跳過記憶層**:工具擋得住已知錯誤,記憶層才接得住未知錯誤
3. 審查用兩個不同家的模型:單模型盲點是系統性的
4. 接受它會一直長:這套環境沒有「完工」,每次踩雷都是下一道關卡的圖紙

### 參考資料

- Mitchell Hashimoto, *engineering the harness*(2026-02)
- Martin Fowler / Birgitta Böckeler, *Harness engineering for coding agent users*(2026-04)
- Anthropic, *Effective harnesses for long-running agents*(2026)

### License

MIT
