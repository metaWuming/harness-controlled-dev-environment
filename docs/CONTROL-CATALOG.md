<!-- GENERATED FILE — 由 scripts/render-control-catalog.ts 從 scripts/control-catalog.json 渲染。
     不要手改本檔:改 JSON 後跑 `npm run catalog:render`;`npm run check:catalog` 會驗兩者逐位元組一致。 -->
---
title: CONTROL-CATALOG — 控制措施目錄(由 JSON 渲染)
type: reference
---

# Control Catalog

> **正本是 `scripts/control-catalog.json`**;本檔是渲染產物(不變量 I4:規則正本只有一份)。
> 每條 control 標明強度分級(不變量 I3),讓讀者一眼分辨:哪些是 CI 硬擋、哪些可 `--no-verify`、
> 哪些是人守的 SOP、哪些只是 advisory 或週期治理。
>
> **機器驗的**(`npm run check:catalog`):ID 唯一、每個實作 / 測試路徑 tracked、hard-automated 的 CI step
> 與 `.github/workflows/ci.yml` 雙向一一對應(setup step 由 `ciSetupSteps` 明文豁免)、宣稱 mutation-tested 的
> 指到存在的 spec、本檔與 JSON 逐位元組一致。
> **機器不驗的**(誠實邊界):`Locator` / `Evidence` / `Degradation` / `Bypass` / `Notes` 的文字內容——
> 那是人讀的描述,可能過時;發現不符請改 JSON。

## 強度分級定義

| Class | 定義 |
|---|---|
| `hard-automated` | CI 上自動執行、紅了就擋 merge(前提:GitHub branch protection 要求 CI pass,見 CTRL-GOV-005)。bypass 只有 admin override。 |
| `soft-automated` | 機器執行但在本機、可被繞過(`--no-verify`、未安裝、不 import)。是縱深,不是邊界。 |
| `manual-mandatory` | SOP 明文要求、由人(agent / Owner)執行;機器只驗其產物或不驗。 |
| `advisory` | 刻意不擋;產出待處置清單或建議,命中不代表錯。 |
| `periodic-governance` | 週 / 季 / 依需求執行的治理節奏;沒有 per-change 強制力。 |

## 依強度分級

## hard-automated

> CI 上自動執行、紅了就擋 merge(前提:GitHub branch protection 要求 CI pass,見 CTRL-GOV-005)。bypass 只有 admin override。

| ID | 名稱 | 舊編號 | Triggers | 實作(tracked 路徑) | Locator | CI step | Owner | 失敗行為 | Bypass | Evidence | Degradation | Tested | Test refs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTRL-CI-001 | Secret scan(gitleaks 全史) | ⑪ | `push` `pull_request` | `.github/workflows/ci.yml`, `.gitleaks.toml` | CI step「Secret scan (gitleaks)」;pinned binary + sha256 校驗;全史、無 grandfather | `Secret scan (gitleaks)` | github | block | admin override(branch protection 設定;本 repo 未機器驗證,見 CTRL-GOV-005) | CI check 狀態;失敗時 job log 列出 leak 位置(--redact) | 本機 pre-push 有同款 gitleaks(CTRL-HOOK-003),但那是 soft;CI 這道是唯一 hard 的秘密掃描 | manual-drill | — | 與 source-term(CTRL-CI-009)是兩條獨立政策,只共用 CI job |
| CTRL-CI-002 | Typecheck | ④ | `push` `pull_request` | `.github/workflows/ci.yml`, `tsconfig.json` | CI step「Typecheck」= tsc --noEmit;本機 npm run typecheck | `Typecheck` | github | block | admin override | CI check 狀態;本機 exit code | 無(tsc 是 devDependency,離線可跑) | manual-drill | — | — |
| CTRL-CI-003 | Lint | ④ | `push` `pull_request` | `.github/workflows/ci.yml`, `eslint.config.mjs` | CI step「Lint」= eslint .;L2 stack 另掛 harness/* AST 規則 | `Lint` | github | block | admin override | CI check 狀態;本機 exit code | 無 | manual-drill | — | — |
| CTRL-CI-004 | Dependency audit(high / critical 硬擋) | ⑪ | `push` `pull_request` | `.github/workflows/ci.yml`, `package.json` | CI step「Dependency audit (high/critical 硬 gate)」= npm audit --audit-level=high | `Dependency audit (high/critical 硬 gate)` | github | block | admin override | CI check 狀態;moderate / low 只印不擋 | 本機 npm audit;無網路時無法判定 | manual-drill | — | 只有 high / critical 擋;中低風險 CVE 可見不擋(刻意) |
| CTRL-CI-005 | 文件檔案引用完整性 | ⑪ | `push` `pull_request` | `.github/workflows/ci.yml`, `scripts/check-doc-refs.ts` | CI step「Doc Refs Check」;掃 docs/**、.claude/sop、.claude/memory 的檔案引用 | `Doc Refs Check` | github | block | admin override | CI check 狀態;本機 npm run check:doc-refs 列出失效引用 | 無 | unit | `tests/check-doc-refs.test.ts` | 只讀 .md;.yml / .json / .ts 內的引用不驗;#anchor 不驗(ADR 已知限制第 5 條) |
| CTRL-CI-006 | 記憶檔大小額度 | ⑪ | `push` `pull_request` | `.github/workflows/ci.yml`, `scripts/check-doc-size.ts` | CI step「Doc Size Check」;progress.md 20 KB / LESSONS.md 60 KB,額度數字由測試釘住 | `Doc Size Check` | github | block | admin override;調額度須改測試釘值並寫理由 | CI check 狀態;本機 npm run check:doc-size 印各檔 %  | 無 | unit mutation | `tests/check-doc-size.test.ts`, `scripts/mutations/example-fail-closed-guard.json` | — |
| CTRL-CI-007 | Adoption readiness(宣告式 mode) | ⑪ | `push` `pull_request` | `.github/workflows/ci.yml`, `scripts/check-adoption-readiness.ts`, `scripts/lib/harness-config.ts`, `scripts/harness.config.json` | CI step「Adoption Readiness Check」;template mode 列 exception、adopted mode fail-closed | `Adoption Readiness Check` | github | block | admin override | CI check 狀態;本機 exit 0 = READY / 2 = NOT_READY 或無法判定 | 無;config 缺 / 壞一律 exit 2 | unit e2e mutation | `tests/check-adoption-readiness.test.ts`, `tests/check-adoption-readiness.e2e.test.ts`, `tests/harness-config.test.ts`, `scripts/mutations/adoption-readiness.json` | mode 是顯式靜態宣告;無 runtime 偵測、無 env override |
| CTRL-CI-008 | TODOS marker 治理(完成宣稱需 merge 證據) | ③ | `push` `pull_request` | `.github/workflows/ci.yml`, `scripts/check-todos-markers.ts`, `scripts/lib/marker-self-pr.ts` | CI step「TODOS Markers Check」;PR event 一律跑、push 只在 delivery branch 跑 | `TODOS Markers Check` | github | block | admin override;MARKER_SELF_PR 允許同 PR 自我引用(刻意) | CI check 狀態;引用的 PR 號需在 delivery refs 有 merge 證據 | 本機 npm run check:todos(需 origin refs) | unit e2e | `tests/check-todos-markers.test.ts` | 缺 merge 證據 → block;已完工但沒引用 PR 號 → 只 warn(advisory 部分) |
| CTRL-CI-009 | Source-term 去識別化掃描 | ⑤ | `push` `pull_request` | `.github/workflows/ci.yml`, `scripts/check-no-source-terms.ts`, `scripts/deny-terms.txt`, `scripts/source-term-baseline.json` | CI step「Source-term scan (de-identification gate)」;current tree 全量 + baseline..HEAD per-commit diff + commit 訊息 | `Source-term scan (de-identification gate)` | github | block | admin override;baseline 變更走 CTRL-GOV-002(人工授權),機器守門見 ADR 已知限制第 2 條的處置 | CI check 狀態;hit 列 rev 前 8 碼 + 內容片段 | 下游 fork 找不到 template baseline → 降級全史掃描並印 warning;shallow clone fail-closed | unit e2e mutation | `tests/check-no-source-terms.test.ts`, `scripts/mutations/source-term-diff-scan.json` | 已知限制第 1 條:diff hit 缺精確 file:line 屬診斷精度、不影響判定,登錄於此、無排程修復 |
| CTRL-CI-010 | 測試套件(vitest) | ④ | `push` `pull_request` | `.github/workflows/ci.yml`, `vitest.config.ts` | CI step「Test (vitest)」;本機 npm test | `Test (vitest)` | github | block | admin override;skipped 測試不算失敗(原則 7:有 skip 要說明) | CI check 狀態;測試檔 / 通過數在 job log | 無 | manual-drill | — | — |
| CTRL-CI-011 | Control catalog conformance | ⑪ | `push` `pull_request` | `.github/workflows/ci.yml`, `scripts/check-control-catalog.ts`, `scripts/lib/control-catalog.ts`, `scripts/control-catalog.json`, `scripts/render-control-catalog.ts`, `docs/CONTROL-CATALOG.md` | CI step「Control Catalog Check」;路徑 tracked + ci.yml 雙向鎖(ciSetupSteps 豁免)+ 渲染一致 | `Control Catalog Check` | github | block | admin override | CI check 狀態;本機 npm run check:catalog 印 CATALOG_OK / CATALOG_FAIL 逐條 code | 無;catalog 缺 / 壞一律 exit 2 | unit e2e mutation | `tests/control-catalog.test.ts`, `tests/render-control-catalog.test.ts`, `tests/check-control-catalog.e2e.test.ts`, `scripts/mutations/control-catalog.json` | 機器不驗 locator / evidence / degradation / bypass / notes 的文字內容(誠實邊界,見渲染檔檔頭) |

## soft-automated

> 機器執行但在本機、可被繞過(`--no-verify`、未安裝、不 import)。是縱深,不是邊界。

| ID | 名稱 | 舊編號 | Triggers | 實作(tracked 路徑) | Locator | CI step | Owner | 失敗行為 | Bypass | Evidence | Degradation | Tested | Test refs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTRL-HOOK-001 | pre-commit:保護分支 code 守衛 | ⑤ | `commit` | `scripts/git-hooks/pre-commit`, `scripts/git-hooks/code-pattern.sh`, `scripts/setup-hooks.sh` | develop / main 上 staged 含 code 或 PROTECTED_DOCS → block;feature/* 放行 | — | developer | block | --no-verify;未安裝 hooks | hook stderr;npm run check:hooks 驗 hook 活著 | 沒跑 npm run setup-hooks 就不存在;CI 端由 branch protection 補(未機器驗證) | unit | `tests/check-hooks.test.ts` | 縱深用;不能假設遠端一定守得住 |
| CTRL-HOOK-002 | commit-msg:訊息去識別化 denylist | ⑤ | `commit` | `scripts/git-hooks/commit-msg`, `scripts/deny-terms.txt` | 訊息含 denylist 詞 → block;scripts/deny-terms.txt 不在時 no-op | — | developer | block | --no-verify | hook stderr | CI 的 CTRL-CI-009 掃 commit 訊息全史兜底 | unit | `tests/check-hooks.test.ts` | — |
| CTRL-HOOK-003 | pre-push:本機 gitleaks + 保護分支 push 守衛 | ⑤ | `push` | `scripts/git-hooks/pre-push`, `scripts/git-hooks/code-pattern.sh` | 先跑 gitleaks(有 leak 硬擋)再做保護分支 code push 確認;刪保護分支硬擋 | — | developer | block | --no-verify | hook stderr | 本機無 gitleaks → 該段略過並提示;CI CTRL-CI-001 兜底 | unit | `tests/check-hooks.test.ts` | — |
| CTRL-GUARD-001 | Destructive 腳本四層守衛 | ⑥ | `manual` | `scripts/lib/destructive-guard.ts` | NODE_ENV / DATABASE_URL 含 prod / FLAG_ENV / --confirm token + dry-run 預設 | — | developer | block | 改常數;不 import guard;env 與 token 都是本機可設值 | 腳本 stderr 摘要(DRY-RUN / APPLY) | 腳本不 import guard 就沒有守衛;採用者 adopted mode 由 CTRL-CI-007 驗常數已改 | unit | `tests/destructive-guard.test.ts` | ⚠️ 誠實定位(不變量 I6):固定 token + prod 字串偵測是 accident interlock(防誤觸),不是 production security boundary;真正 apply 應驗 target identity 與影響範圍(Milestone C) |
| CTRL-SOP-003 | CSO 觸發判定 + 高風險車道探針 | ⑧ | `sop-step` | `scripts/check-cso-trigger.ts`, `scripts/cso-trigger.config.ts`, `scripts/mutate.ts`, `.claude/sop/plan-mode-checklist.md` | Step 4.5;判定機器化(完整變更面 vs 路徑表,fail-closed exit 2)、探針執行靠人 | — | agent | block | 本機不跑即無;判定是下限不是上限 | progress entry 記 CSO_REQUIRED / NOT + 命中域 + 探針 exit 0 綁定 SHA | 無 gstack /cso → 內建 security-review;模板 repo 表空 = 例外人工判定 | unit e2e mutation | `tests/check-cso-trigger.test.ts`, `tests/mutate.test.ts`, `scripts/mutations/example-fail-closed-guard.json` | 不是 CI gate(CI 跑不了 /cso) |
| CTRL-SOP-007 | Bookkeeping commit 機器化核對 | ⑩ | `sop-step` | `scripts/check-bookkeeping-commit.ts` | Step 5 收尾;純檔名 allowlist(progress / TODOS / BACKLOG / progress-archive 非 README) | — | agent | block | 本機不跑即無;v1 只看檔名不看內容 | 本機 exit code;progress entry 記結果 | 無 | unit | `tests/check-bookkeeping-commit.test.ts` | — |

## manual-mandatory

> SOP 明文要求、由人(agent / Owner)執行;機器只驗其產物或不驗。

| ID | 名稱 | 舊編號 | Triggers | 實作(tracked 路徑) | Locator | CI step | Owner | 失敗行為 | Bypass | Evidence | Degradation | Tested | Test refs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTRL-SOP-001 | Plan Mode 7 步 SOP + STOP point | ② | `sop-step` | `.claude/sop/plan-mode-checklist.md`, `CLAUDE.md` | CLAUDE.md Part 2「Plan Mode 流程規則」;checklist 每步 STOP point 與 effort 建議 | — | agent | block | Owner 明示 trivial 例外(typo / 單行 / 純格式),受 docs-only 判準約束 | plan file + progress entry 的 7 步 checklist 狀態 | 外部工具缺席照 DEGRADATION.md 降級,骨架不變 | untested | — | 人守;機器只驗其產物(progress entry 由 CTRL-SOP-007 / CTRL-CI-006) |
| CTRL-SOP-002 | 跨模型 review(Step 4) | ⑦ | `sop-step` | `.claude/sop/plan-mode-checklist.md`, `docs/DEGRADATION.md` | Step 4;外部 Codex CLI 對本地 diff 迭代到 0 findings;三條壓輪數紀律 | — | agent | block | docs-only 車道可略 Step 4(判不準從嚴) | progress entry 的 round 數 / P1 / P2;fix commit 訊息標 round | 無 Codex → Claude Code 內建 /code-review(失去跨模型多樣性) | untested | — | cross-model agreement 實測接近 0,兩道 review 都不可省 |
| CTRL-SOP-004 | 條件式視覺關 | ⑨ | `sop-step` | `.claude/sop/plan-mode-checklist.md`, `docs/DEGRADATION.md` | Step 4.6;diff 碰 UI 才觸發;外部 gstack /design-review,降級為實際截圖比對 | — | agent | block | 未觸發即不跑(純後端 / 純文件 sprint) | progress entry 記觸發與否 + before / after 截圖 | 無 gstack → 手動截圖;不得只讀碼推論外觀 | untested | — | — |
| CTRL-SOP-005 | Step 5 對抗審 + 高風險車道 worktree 獨立審 | ⑩ | `sop-step` | `.claude/agents/adversarial-reviewer.md`, `.claude/sop/plan-mode-checklist.md` | Step 5;全新拋棄式 clone、40 字元 review-tip 核對、findings 全報再按軸過濾 | — | agent | block | none(SOP 內無例外;docs-only 車道仍跑 fresh review) | progress entry 記 CRITICAL / INFORMATIONAL 數、review-tip SHA、Step5 獨立發現數 | 無 gstack /review → 內建 /code-review + 一個 adversarial-reviewer | untested | — | — |
| CTRL-MEM-001 | 三層行為守則 | ① | `manual` | `CLAUDE.md` | Part 1(工作原則)/ Part 2(協作偏好)/ Part 3(放寬規則);D 編號可否決機制 | — | agent | record-only | none(行為守則無機器強制;偏差由 Owner redirect) | plan file 的 Sensible Defaults 段;Owner 否決紀錄 | 無 | untested | — | CLAUDE.md 屬 PROTECTED_DOCS(CTRL-HOOK-001 / 003 擋直推) |
| CTRL-GOV-002 | Baseline 變更授權(人工段) | ⑤ | `pull_request` | `docs/architecture/source-term-history-baseline.md` | H2「baseline 變更授權」:baseline 是治理決策,改動走 PR + Owner 拍板 | — | owner | block | Owner | PR 描述 + Owner approve 紀錄 | 無 | untested | — | 機器守門(同 PR 推 baseline 洗白)屬 ADR 已知限制第 2 條,由 catalog 批次處置 |

## advisory

> 刻意不擋;產出待處置清單或建議,命中不代表錯。

| ID | 名稱 | 舊編號 | Triggers | 實作(tracked 路徑) | Locator | CI step | Owner | 失敗行為 | Bypass | Evidence | Degradation | Tested | Test refs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTRL-SOP-006 | 量詞自檢器 | ⑦ | `sop-step` | `scripts/check-claims.ts` | 送審前對自己 diff 新增行掃過度宣稱,產待處置清單 | — | agent | record-only | 刻意非 gate;命中不代表錯 | progress entry 與 PR 描述的逐條處置(留 A / 降級 B) | 無工具 → 人工核對新增宣稱句 | unit | `tests/check-claims.test.ts` | — |
| CTRL-GOV-005 | GitHub branch protection | ⑪ | `manual` | `.github/workflows/ci.yml` | ci.yml 檔頭註解建議設 branch protection(主線要求 CI pass);GitHub 端設定非本 repo 內可驗 | — | github | record-only | github | 無(repo 內無證據;Milestone C 才做 governance verification) | 無 branch protection 時所有 hard-automated 的 admin override 等於任何人可 merge 紅 PR | untested | — | ⚠️ 本 repo 的 hard-automated controls 之所以「hard」依賴這條設定存在;目前只能建議、不能驗證 |

## periodic-governance

> 週 / 季 / 依需求執行的治理節奏;沒有 per-change 強制力。

| ID | 名稱 | 舊編號 | Triggers | 實作(tracked 路徑) | Locator | CI step | Owner | 失敗行為 | Bypass | Evidence | Degradation | Tested | Test refs | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTRL-MEM-002 | 記憶層與歸檔慣例 | ③ | `manual` | `.claude/memory/progress.md`, `.claude/memory/LESSONS.md`, `TODOS.md`, `.claude/memory/progress-archive/README.md`, `.claude/memory/LESSONS-archive/README.md` | progress 每 sprint 一 entry(pre-merge schema)、LESSONS 踩坑即寫、TODOS 完成宣稱引 PR 號;超額度歸檔 | — | agent | record-only | none | 檔案內容;額度由 CTRL-CI-006、marker 由 CTRL-CI-008 機器驗 | 無 gbrain → 純 git 核實 | untested | — | 歸檔會搬動 canonical ADR 引用 → 同 commit 更新 template-governance 的位置＋數量表 |
| CTRL-GOV-001 | 週健檢 | ⑫ | `schedule` | `scripts/weekly-health-check.ts` | 三個 collector:工作累積 / 教訓產出速率 / 審查鈍化偵測;輸出 .claude/memory/health-history/ | — | owner | record-only | 不排程即無 | health-history 週報 | 不排程即無;兩個 collector 明文未實作 | unit | `tests/weekly-health-check.test.ts` | — |
| CTRL-GOV-004 | 季 retro 與封存 | ⑬ | `schedule` | `.claude/memory/LESSONS-archive/README.md`, `.claude/memory/progress-archive/README.md` | 封存已機器化教訓、記憶防膨脹、掃文件交叉引用防漂移 | — | owner | record-only | none | archive 目錄內容 | 無 | untested | — | — |

## CI setup steps(不登錄為 control)

> `ciSetupSteps`:這些 `ci.yml` step 是環境準備,不是控制措施;checker 驗每個名稱在 ci.yml 恰出現 1 次、且不與任何 control 的 CI step 重疊。

- `Checkout`
- `Setup Node 22`
- `Install dependencies`
- `Fetch delivery refs (for TODOS Markers Check)`

## 舊編號索引(README / OVERVIEW 的 ①–⑬)

| 舊編號 | Controls |
|---|---|
| ① | CTRL-MEM-001 |
| ② | CTRL-SOP-001 |
| ③ | CTRL-CI-008, CTRL-MEM-002 |
| ④ | CTRL-CI-002, CTRL-CI-003, CTRL-CI-010 |
| ⑤ | CTRL-CI-009, CTRL-HOOK-001, CTRL-HOOK-002, CTRL-HOOK-003, CTRL-GOV-002 |
| ⑥ | CTRL-GUARD-001 |
| ⑦ | CTRL-SOP-002, CTRL-SOP-006 |
| ⑧ | CTRL-SOP-003 |
| ⑨ | CTRL-SOP-004 |
| ⑩ | CTRL-SOP-005, CTRL-SOP-007 |
| ⑪ | CTRL-CI-001, CTRL-CI-004, CTRL-CI-005, CTRL-CI-006, CTRL-CI-007, CTRL-CI-011, CTRL-GOV-005 |
| ⑫ | CTRL-GOV-001 |
| ⑬ | CTRL-GOV-004 |
