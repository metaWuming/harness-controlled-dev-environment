---
title: ADOPTION — 導入 checklist
type: guide
---

# 導入 Checklist(Use this template 之後做這些)

> 按順序走完,每項都很小。全部做完,你的 repo 第一天就有完整防護欄。
>
> **還沒建好 repo?** 先看 [`QUICKSTART.md`](QUICKSTART.md) —— 它講「repo 怎麼開、
> 放哪、第一句話對 AI 說什麼」,那三步做完才輪到本檔。本檔是給 AI 逐項執行的填空清單。

## 0. 宣告模式(先做這個,其他步驟才有機器驗證)

- [ ] 開 `scripts/harness.config.json`(schemaVersion **2**):`mode` 改成 `"adopted"`、`projectId` 改成你的 slug、
      `mergeStrategy` 選 `squash` / `merge-commit` / `rebase` / `fast-forward`(§4.6 要以反引號提到它)
      (小寫英數與 `-`,不得含 template / placeholder / project)、`protectedBranches` /
      `deliveryBranches` 對齊你的分支策略、`requiredAgentAdapters` 宣告你會用的 agent
      (v1 認得 `claude` / `codex`)、`githubGovernanceRequired` 需要 CODEOWNERS 時設 true
- [ ] **不改 = 停在 template mode**:CI 的 `check:adoption` 只會列出 template exception、
      **不會替你驗導入**。它刻意不猜 mode——沒有這個檔、或 mode 不明確,一律 exit 2 要求你選
- [ ] 分支名只接受**字面名**(英數起頭、其餘英數 `.` `_` `/` `-`):不接受 glob(`feature/*`)、
      ref 形式(`refs/heads/main`、`origin/main`)、空白、引號、`|`;同欄位不得重複(含大小寫差異)
- [ ] 跑 `npm run check:adoption`。之後每做完下面一節就再跑一次,照輸出逐條修,直到首行是
      `ADOPTED_MODE — READY`(完成判準見最後一節)
- [ ] 從 A2 之前的版本升上來的既有專案:拉進更新後會因缺 config 而 exit 2——建立這個檔、
      明確選 mode,不要抄 template 值敷衍(`projectId` 留 sentinel 會被 A1 擋)

## 1. 基本識別

- [ ] `LICENSE`:確認 MIT 條款的著作權人改成你(或依需要換 license)
- [ ] `README.md`:改寫成你的專案說明(本模板的 README 是模板自述,不是你的專案自述)
- [ ] `package.json`:`name` / `description` 改成你的專案
- [ ] `CLAUDE.md`:全文搜尋「Owner」→ 換成你的名字(或保留通用稱呼);
      Part 2「輸出格式」的語言依你的偏好調整

## 2. CLAUDE.md Part 4(技術上下文)

> `check:adoption`(adopted mode)對 §4.1 / §4.3 / §4.5 / §4.6 有**機器可驗的格式**,每段的
> `<!-- 填 -->` 註解裡寫了鍵名與範例;填完要把註解整段刪掉(殘留 `<!-- 填` 會被擋)。
> §4.2 / §4.4 不驗(4.2 純後端可刪、4.4 上線前常無值)。

- [ ] §4.1 技術堆疊:`- 語言：` / `- 框架：` / `- 資料庫：` / `- 部署：` 四行各一、值非 placeholder
- [ ] §4.2 Design System:填設計 token 來源(純後端專案直接刪本節)
- [ ] §4.3 Health Stack:反引號 `npm run <script>` ≥3 個、每個存在於 package.json、含 typecheck / lint / test
- [ ] §4.4 部署資訊:staging / production
- [ ] §4.5 禁區清單:≥2 個 bullet、每個 bullet 用反引號寫實際存在的檔或目錄
- [ ] §4.6 Git 規範:config 宣告的每個分支名以反引號出現、以反引號提到宣告的 `mergeStrategy` 值(關鍵字散文不算)

## 2.5 思考力道與 agent 定義

- [ ] `.claude/settings.json`:`effortLevel` 對齊你的 repo 型態
      (實作為主 → `xhigh`;文件 / 規劃為主 → `high` 或 `medium`)。
      出貨值 `high` = 模型原生預設,不改也能跑
- [ ] 讀一次 [`EFFORT.md`](EFFORT.md):理解「effort 是成本桿不是品質旋鈕」
      與「**不要關 thinking**」兩條;跑幾個 sprint 後回來重校每步建議值
- [ ] `.claude/agents/`:兩支預設 agent(`explore-scoped` 蒐脈絡 /
      `adversarial-reviewer` 獨立審 diff)可直接用;要調語氣或加專屬 agent 就改這裡
- [ ] 你的專案有 UI → 確認 `CLAUDE.md` §4.2 填了 design token 來源檔,
      否則 SOP Step 4.6 視覺關沒有對照基準。純後端專案 → 視覺關永遠不觸發,不必設定

## 3. 安全敏感域路徑表(Step 4.5 安全關的前置)

- [ ] `scripts/cso-trigger.config.ts`:把你專案的安全敏感路徑填進五域
      (金流 / 個資 / 權限·IDOR·資產轉移 / audit-trail / 橫切保守項)+ 前台敏感進入點
- [ ] 真的沒有某個域的專案(例如沒有金流)→ 在同檔 `CSO_NOT_APPLICABLE` 明文宣告
      `{ domain, reason }`(reason 去空白 ≥10 字)。`check:adoption` 驗**五域各恰一種處置**:
      有 pattern **或** 宣告 N/A,兩者皆有(矛盾)或皆無(未處置)都擋;整體至少要有一條 pattern
- [ ] 「路徑表完整性鎖」測試(`tests/check-cso-trigger.test.ts` 檔尾)現在是 **always-on**、依
      `harness.config.json` 宣告的 mode 分支,**不需再手動取消註解**:adopted mode 下它斷言
      每條 pattern 對得到 repo 真實檔案,防路徑表隨重構漂移;template 分支那一條會顯示 skipped、屬設計
- [ ] 之後**每次新增安全敏感模組,同步更新路徑表**(machine 判定是下限不是上限)

## 3.5 Control catalog:你自己加的 CI step 要登錄

- [ ] 每個非 setup 的 ci.yml step 都要在 `scripts/control-catalog.json` 有一條 `hard-automated` control(`ciStep` 逐字等於
      step 名);環境準備 step 列進 `ciSetupSteps`。**每個 step 都必須有單行 `name:`**(無名 step 或 `name: |` 會被
      `check:catalog` 擋)。改完 JSON 跑 `npm run catalog:render`,不要手改 `docs/CONTROL-CATALOG.md`
- [ ] 沒有對應測試的 control 用 `"tested": ["untested"]` 誠實標;`check:catalog` 綠 = 登錄與 CI 雙向對應

## 4. 本機 git hooks

- [ ] `npm run setup-hooks`(設 `core.hooksPath`,一次即可,clone 的每個人都要跑)
- [ ] 檢查 `scripts/git-hooks/pre-commit` 的保護分支清單(預設 main/develop)符合你的分支策略
- [ ] `scripts/git-hooks/commit-msg` 擋「commit 訊息含去識別化 denylist 詞」——
      你若照 §6 移除了去識別化 gate,本 hook 會自動 no-op(不必特別處理)
- [ ] 檢查 `scripts/git-hooks/code-pattern.sh` 的 `PROTECTED_DOCS` SSOT
      (pre-commit / pre-push 兩支共用)。預設涵蓋模板實際附帶或最常見的
      `CLAUDE.md` / `.claude/sop/` / `SPEC.md` / `ARCHITECTURE.md` /
      `GOVERNANCE.md` / `docs/architecture/`;有專案自己的治理文件
      (常見增補:root 級 `AGENTS.md` / `DESIGN.md`、或
      `docs/{SECURITY,THREAT_MODEL,BRANCH_PROTECTION}.md` 這類專案安全文件
      ——路徑依專案實情、非本模板附帶)按實情增補
- [ ] 兩支 hook 用 **default-deny**(`NON_CODE_PATTERN` = `.md` 與
      `docs/*.html` — 後者只放行 `docs/` **直層一級**,`docs/guides/setup.html`
      這種 nested HTML 會被當 code、走 PR)。非文件一律視為 code。若專案有
      其他純說明檔位置要放行,在 `NON_CODE_PATTERN` 加入,但**只放行可信任
      的說明目錄**(避免 `public/**/*.html` 這種同源可讀 session 的檔零阻力
      進主分支)
- [ ] (**強烈建議**)本機裝 gitleaks(`brew install gitleaks`)。pre-push 預設
      **fail-closed**:沒裝就擋 push,要繞得明講 `SKIP_GITLEAKS_CHECK=1 git push …`
      或 `git push --no-verify`;`gitleaks:allow` 行內註解與 `.gitleaksignore`
      已刻意停用(提交者不能自己放行,誤報一律走版控的 `.gitleaks.toml`)

## 5. destructive 腳本守衛

- [ ] `scripts/lib/destructive-guard.ts` 頂部常數:`FLAG_ENV` / `CONFIRM_TOKEN` 改成你的專案名
      (例:`MYAPP_DESTRUCTIVE_OK` / `--confirm=MYAPP-PROD`)。`check:adoption` 在 adopted mode
      會掃整個檔:出廠的 `PROJECT_DESTRUCTIVE_OK` / `PROJECT-PROD` 字面(含註解裡的)一個都不能留
- [ ] 之後所有 wipe / cleanup 類腳本都 require 這個 guard

## 6. CI

- [ ] `.github/workflows/ci.yml`:分支清單對齊你的策略;
      GitHub repo 設 branch protection(主線要求 CI pass)。`check:adoption` 會驗**四處集合精確相等**:
      `pre-commit` 的 `case` 行、`pre-push` 的 `refs/heads/… ) _is_protected=1` 行、ci.yml `push:` 與
      `pull_request:` 各自的 `branches: [...]` 行,都必須等於 config 的 `protectedBranches`(多一個、
      少一個都紅;push 清單裡只允許 `feature/**` 這一個 glob,其他 glob 一律擋)
- [ ] 同一 workflow 的 `Adoption Readiness Check` step(`npm run check:adoption`)要保留,恰 1 行
- [ ] 三處 delivery-branch 的 `if:` 行(Fetch delivery refs / TODOS Markers / Source-term)在 adopted mode 會被 A5.ci.if 驗:
      必須逐字等於 `if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch)`
      再對 `deliveryBranches` 每個 b 接 ` || github.ref == 'refs/heads/<b>'`。出廠 ci.yml 含 `develop`——要嘛把 `develop` 列進
      `deliveryBranches`,要嘛從三行拿掉
- [ ] `Baseline Governance Check` step(pull_request only)要保留:同 repo PR 會帶 `--head`,保護分支之間的 promotion PR
      (例 develop → main)依你宣告的 `protectedBranches` 明文跳過;fork PR 不帶 `--head`。⚠️ 這個豁免只在所有
      `protectedBranches` 都真的開了 branch protection / ruleset(必須經 PR、不得直接 push)時成立
- [ ] 用 Next.js+Prisma → 照 `stack/nextjs-prisma/README.md` 把 L2 層裝上
      (ESLint AST 規則 + migration 守衛 + CI 片段)
- [ ] `Source-term scan` step:本模板用它防「來源專案識別詞」殘留。
      你不需要 → 刪 step + `scripts/deny-terms.txt` + `scripts/check-no-source-terms.ts` + `tests/check-no-source-terms.test.ts`;
      你也從自家私有專案抽模板 → 把 deny-terms.txt 換成你家的識別詞
- [ ] `.gitleaks.toml`:保持空 allowlist;掃到誤報才按「值」精準放行(見檔內原則)

## 7. 記憶層啟用

- [ ] `.claude/memory/progress.md`:第一個 sprint 收尾時寫第一條 entry(格式照檔內模板)
- [ ] `.claude/memory/LESSONS.md`:第一次踩雷時開始累積
- [ ] `TODOS.md`:把你的 backlog 填進 P1/P2/P3 分級(完成宣稱要引用 PR 號,CI 會驗)

## 8. 週健檢(可選但建議)

- [ ] `npm run health:weekly` 跑一次確認輸出正常(報告在 `.claude/memory/health-history/`)
- [ ] 按需擴充 collector(檔內有 TODO 標記點):DB 指標、deadcode、錯誤監控……
- [ ] 排進你的週例行(手動跑或 cron)

## 9. 外部工具(全部 optional)

本 harness 的 SOP 引用幾個外部工具,**沒有它們流程照樣走**(降級路徑見
[`DEGRADATION.md`](DEGRADATION.md)):

- **Codex CLI**(跨模型 review)— 自行取得;沒有就用 Claude Code 內建 `/code-review`
- **gstack**(/cso、/review 等 skill 套件)— 外部依賴,本模板不包含、不教學;
  沒有就用內建 `security-review` / `/code-review`
- **gbrain**(語意記憶檢索)— 沒有就純 git 核實

## 10. 裝第三方 Claude Code skill 前(選用)

- [ ] 裝之前先確認它有沒有**預設路徑假設**會跟本 repo 既有結構衝突——最常見的是 ADR
      家目錄:不少 skill 預設把架構決策記錄寫到自己認定的路徑(例如 `docs/adr/`),但
      本 repo 可能已經有自己的 ADR 慣例(路徑、編號格式都可能不同)。裝之前**先 grep
      skill 內容裡的固定路徑,對照 repo 實際結構**,衝突就在該 skill 檔案開頭加一段
      override 說明,不要照單全收預設值(2026-08-10 在一個下游專案裝
      [mattpocock/skills](https://github.com/mattpocock/skills) 的 `domain-modeling`
      時踩到,已修正)

## 11. 完成判準(機器出具)

- [ ] `npm run check:adoption` 首行是 `ADOPTED_MODE — READY`、exit 0。這是導入完成的**唯一機器判準**;
      template mode 的輸出(`TEMPLATE_MODE — adoption checks NOT applied …`)不算完成
- [ ] `npm test` 全綠(`tests/check-cso-trigger.test.ts` 的 template 分支 1 條 skipped 屬設計)
- [ ] CI 綠:`Adoption Readiness Check` step 與其他 step 一起
- [ ] 本 checker 刻意**不解析** shell / YAML 結構、**不偵測**環境、**不接受** env override;任何
      「無法判定」(config 缺 / 壞、cso config 形狀不對、參數錯)都是 exit 2,不是放行
