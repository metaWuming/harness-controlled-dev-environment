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
      (v1 認得 `claude` / `codex`;模板出廠是 `["claude", "codex"]` 兩個都宣告、
      對應同時交付 `CLAUDE.md` 與 `AGENTS.md`。只用其中一個就砍成 `["claude"]` 或
      `["codex"]` 單宣告即可;宣告 `codex` 時 `AGENTS.md` 必須被 git 追蹤且含
      恰為 `@CLAUDE.md` 這樣一整行的 import 語法)、`githubGovernanceRequired`
      需要 CODEOWNERS 時設 true
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
- [ ] 宣告了 `codex` adapter → 開 `AGENTS.md`,決定 `## Project-specific Codex overlay`
      這段怎麼處理:填自己專案的 Codex-specific override(例:專案 skill 名、
      design token 讀法、專屬工具說明),或整段刪除(explicit opt-out)、或清空
      本 section 內容。**`<!-- 填 -->` marker 必須清掉**,不然 adopted mode
      `check:adoption` A6.codex.overlay-fill 會擋。precedence 契約在 `AGENTS.md`
      本身(`@CLAUDE.md` line 後、兩 H2 前),不必自己記

## 2.6 Branch Protection 機器驗證 secret setup(Sprint 19 C1)

若你的專案宣告了保護分支(`harness.config.json` `protectedBranches`),CI 每日會自動跑
`.github/workflows/branch-protection.yml` 用 GitHub API 驗證這些分支的 branch protection
設定符合 CTRL-GOV-005 的 A-D 契約(required_status_checks / contexts 非空 /
enforce_admins.enabled=true / required_pull_request_reviews)。要讓這條 gate 生效、
**必須設定 secret**(否則會 exit 2 fail-closed):

- [ ] 到 https://github.com/settings/personal-access-tokens/new 建 **fine-grained PAT**
- [ ] Resource owner:選目標 repo owner
- [ ] Repository access:Only select repositories → 選目標 repo
- [ ] Permissions → Repository permissions:
      **Administration: Read** + **Contents: Read**(這兩個就夠、其他不要開)
- [ ] Copy PAT token value
- [ ] 目標 repo settings → Secrets and variables → Actions → New repository secret
      name = `BRANCH_PROTECTION_TOKEN`、value = 剛才 copy 的 PAT
- [ ] 確認 workflow 有跑:GitHub Actions tab 找 "Branch Protection Check" workflow、
      看第一次 schedule run 或手動改 cron 觸發

**Trust boundary(承 plan r11):**
- 此 workflow 是**獨立 file**(不與 ci.yml 共 job)、**schedule-only** 觸發、絕不 pull_request
- Secret `BRANCH_PROTECTION_TOKEN` **完全不 leak 至 PR CI**(secret 只在此 workflow 的 job 內、
  ci.yml 完全不接觸此 secret)
- **Fork PR / Dependabot PR / 同 repo PR 皆不觸發**此 workflow(schedule-only)、
  secret 完全隔離、無 exfiltration risk
- Fork PR 若被 GitHub 政策 blocked secret delivery → CLI 走 5a fail-closed exit 2、diagnostic
  明列 fork context;這是 by-design、非 bug

**想立刻驗新 protectedBranches**:改 harness.config.json 加分支 → merge → 等 daily schedule
或臨時改 cron。**不要**用 workflow_dispatch(plan r10 明列 out-of-scope、避 ref control 攻擊面)。

**⚠️ 這條 gate 的**強制力語意**(Phase 2 澄清 + Step 4 Codex review 校正、對齊 catalog CTRL-GOV-005 / CTRL-CI-015 分類 `periodic-governance`)**:

1. **Scheduled run 內部** fail-closed:workflow 內任一 protectedBranches 驗 A-D 失敗 → CLI exit 2 → 該 workflow run 標紅、GitHub Actions tab 可見、Owner 稽核
2. **Per-PR merge 阻擋**:上述紅**不會**自動 block PR merge——workflow schedule-only(不觸 push / pull_request、checkout ref=main),PR gate 不知道它紅

⚠️ **不要嘗試把 `branch-protection.yml` 加進 branch protection required status checks 來成 per-PR gate**:此 workflow 只在 schedule 觸發、checkout `ref: main`,**不會**在 PR head SHA 上執行。加進 required status checks 只會讓 PR 缺對應 check、卡 pending,並未驗證該 PR。

想要**每 PR 重驗** protected branches 的 A-D 契約:需另行設計 **PR-head verifier**(在 push / pull_request event 觸發、checkout PR head、token / trust boundary 另議)。此為本次 optimization **out-of-scope**、本 harness 尚未提供;不擴 workflow / secret / policy。

換句話說:catalog 的 `failureBehavior: block` 指的是 CLI/workflow 本身 fail-closed(scheduled run 內部 exit 2),**不是** per-PR merge gate。現況實務:daily schedule 抓 drift + Owner 稽核 Actions tab 紅 run + protected-path human review。

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
- [ ] 檢查 `scripts/git-hooks/code-pattern.sh` 的 `TOOL_ARTIFACT_PATTERN`(本機 AI / 工具產物;出廠列 `.codegraph`、`.gbrain-source`、`_handoffs`,**不加尾斜線**——尾斜線只匹配目錄,symlink 會漏)
      並依你的工具增補(例:`.aider*`、`.cursor/`),**同一份清單也要放進 `.gitignore`**(第一道;hook 是縱深、任何分支任意深度擋、檔案 / 目錄 / symlink 皆擋,刪除放行以便清理)。
      ⚠️ 任意深度表示子目錄同名路徑也擋(例 `docs/_handoffs/README.md`);想刻意進版控的 handoff 範本要改 pattern
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

### 5.1 declared allowlist + max-rows 宣稱(Sprint 20 C2)

L1–L4 是 accident interlock(NODE_ENV / DATABASE_URL 含 prod / FLAG_ENV / --confirm token)。
Sprint 20 C2 加 L5 + L6:

- **L5 declared allowlist mismatch alarm**:DATABASE_URL 的 hostname(選:dbname)不在
  adopter 宣告的 allowlist 就 abort
- **L6 declared max-rows bound**:呼叫方要求時,`--apply` 必帶 `--max-rows=<N>` 且 N ≤ 上限

⚠️ **誠實定位**:這是 declaration-level alarm、**不是** production security boundary。

Catches:
- DATABASE_URL 顯示的 hostname / dbname 打錯或誤連 → guard abort
- `--max-rows` 忘記帶、非正整數、超上限 → guard abort

Does NOT catch(明列限制):
- DNS / CNAME rewrite(URL hostname 顯示 allowlist、實際連 prod)
- Managed DB proxy identity spoof
- adopter caller 的 SQL bug(誤刪錯 table、誤大 WHERE clause)
- adopter caller 未 enforce 實際 affected count ≤ maxRows(guard 只驗 CLI flag、不查 DB 真實 affected count)

真 runtime enforcement 需未來 sprint runtime seam(actual DB fingerprint / SQL 攔截)。

**Runbook**:

- [ ] 打開 `scripts/destructive-guard.config.ts`。出廠 `EXPECTED_TARGET_IDENTITY = null`、
      L5 fail-closed(所有 destructive 腳本進 L5 都 abort、有意的預設)
- [ ] 改成 adopter 的 allowlist,例:
      ```ts
      export const EXPECTED_TARGET_IDENTITY: ExpectedTargetIdentity = {
        allowedHosts: ['localhost', 'staging.myshop.local'],
        allowedDbNames: ['myshop_staging'],  // optional、省略即不驗 dbname
      };
      ```
      hostname 比對前 guard 會 lowercase-normalize、adopter 填的大小寫不重要;dbname exact match
- [ ] 想在特定腳本啟用 L6 上限:呼叫 `requireDestructiveConfirmation(scriptName, opts, expectedMaxRowsBound)`
      第三參數傳你允許的最大 rows(例 `1000`);呼叫方之後跑 `myapp:wipe --apply
      --max-rows=500`;guard 驗 CLI flag 不驗 DB 實查、caller 責任 enforce 實際 affected count
- [ ] 不用 L6 上限就不傳第三參數,行為與 Sprint 20 前一致
- [ ] 認清 threat model:L5 只擋宣稱層的 hostname/dbname 打錯,擋不到 DNS / CNAME rewrite、
      managed proxy spoof、SQL bug 或 caller 未 enforce affected count

### 5.2 Mutation Kill Smoke Check(Sprint 21 C3、CTRL-CI-016)

CTRL-CI-013 只驗 mutation spec 的 `find` 樣本仍能對得上 source(**drift 守門**、不 apply mutation)。Sprint 21 C3 加獨立新 gate **CTRL-CI-016 Mutation Kill Smoke Check**:CI 對 pinned 6 條 smoke probe 真的 apply mutation via `mutate.ts` → 跑 pinned test → assert mutant killed。應 kill 但沒 kill → CI block(**accidental-regression signal**)。

⚠️ **誠實邊界**(承 catalog CTRL-CI-016 notes + CI step comment、三處 SSOT):
本 gate 是 **accidental-regression signal**、**不是** malicious-PR security boundary。

**擋**:accidental mutation regression signal(dev 修 source 造成既有 mutation 不再被 kill、CI 抓)

**不擋**(CI wiring PR-controllable):
- Malicious PR 修 target test 讓 mutant 不 kill
- Malicious PR 修 `scripts/mutation-smoke-manifest.json` / `scripts/run-mutation-smoke.ts` / CI step / package.json
- Machine gate **不對抗** PR 修 wiring

**durable evidence boundary**(Step 4 Codex 校正、live-probe-only、不由 config 或某次 probe snapshot 靜態推論;對齊 catalog CTRL-CI-016 notes + CI step comment 三處 SSOT):

1. **遠端 enforcement 是 live GitHub state**:
   - 必須以 live probe 現場確認:`gh api /repos/.../branches/main/protection`、`/rules/branches/main`、`/branches/main`(`.protected`)
   - **不能由 config 靜態推論**、**不能由某一次 probe snapshot 宣稱永久狀態**
   - 本文件**不宣稱**目前已啟用或未部署;讀者需自行執行 live probe 確認當下狀態
2. **template config `harness.config.json:githubGovernanceRequired: false`** 僅表示 adopter requirement default:
   - 本模板對下游 adopter 沒硬性要求(adopter 可依需要開啟)
   - **不能由此推論** template repo 自身有或無 GitHub-side enforcement
   - 部署由 Owner 個案決定、與 config flag 獨立
3. **schedule A-D audit(CTRL-GOV-005 / CTRL-CI-015)**:
   - 僅在 (a) `BRANCH_PROTECTION_TOKEN` 已設 **且** (b) daily schedule workflow 實際成功時才提供 evidence
   - 此 evidence **非** per-PR required check(schedule-only workflow 不在 PR head 執行)
4. **手動 SOP practices(不論 remote enforcement 是否部署都適用、本身非 GitHub-enforced)**:
   - (a) **protected-path human review**(scripts/ / tests/ / .github/workflows/ / mutation-smoke-manifest.json):SOP 紀律,非 GitHub protection rule;靠 reviewer 自律,無 machine 阻擋
   - (b) **Owner 稽核 CTRL-GOV-005 / CTRL-CI-015 daily schedule drift**:GitHub Actions tab manual review、非 active gate;schedule run 紅時需 Owner 主動看
5. **per-PR A-D 契約 verification / malicious-PR defense**:需另設 **PR-head verifier**(在 push / pull_request event 觸發、checkout PR head、token / trust boundary / adopter GitHub policy 另議),為本次 optimization **out-of-scope**、需另議部署、本 harness 尚未提供

⚠️ 舊 wording「唯一防線 = required-check(GOV-005 branch protection + CI-015 machine check)」實務上**不成立**:GOV-005 / CI-015 皆 schedule-only workflow(checkout `ref: main`、不觸 push / pull_request),**不在 PR head 執行**,不能作 branch protection required status check(加進 required checks 只會讓 PR 缺對應 check、卡 pending)。**非** CI machine gate 對抗 malicious PR。

**運作機制**:
- Runner `scripts/run-mutation-smoke.ts` 硬編碼 `SMOKE_PROBES` map:6 條 probe = { spec, index, expectedEntryFingerprint SHA-256, testSuite }
- Fingerprint = SHA-256 of canonical JSON of `{file, find, replace, label}`(alphabetical key allowlist)
- Manifest `scripts/mutation-smoke-manifest.json` 只列 probeIds(hard cardinality 6 + no duplicates + set-equality vs SMOKE_PROBES keys)
- 7 步 algorithm:validate manifest → clean tree + startHEAD → verify entry fingerprints → pre-control → per-probe spawn mutate.ts(argv-safe、detached process group、SIGTERM 60s + SIGKILL 5s grace)→ post-control → verify tree + HEAD 不變
- Exit code:0 = 全 killed / 1 = 任一 survived / 2 = indeterminate(schema / fingerprint / control / restore / timeout / infra)

**Runbook**(adopter 無需動作、shipped 6 條 probe 對 template 自身 governance code 已生效):

- [ ] 不需改任何 shipped 檔就可用;CI step 已配置 `timeout-minutes: 5`
- [ ] 想加自己的 smoke probe:
  1. 在 `scripts/run-mutation-smoke.ts` 的 `SMOKE_PROBES` map 加新 entry(spec + index + expectedEntryFingerprint + testSuite)
  2. 用 `node -e "..."` 對 immutable spec entry 計算 canonical JSON SHA-256、pin 進 map
  3. 在 `scripts/mutation-smoke-manifest.json` 的 `probeIds` 加對應 probeId(cardinality check 會擋、要同時改 SMOKE_PROBES 才過)
  4. 加對應 unit test 驗 fingerprint verify pass
- [ ] 認清 threat model:CI wiring PR-controllable、machine gate 不對抗 malicious PR

### 5.3 三份 mutation evidence 分工(Sprint 21 引入)

- **Drift**(CTRL-CI-013):CI 驗 spec find 樣本對 source(全 14 spec / 167 probes、不 apply)
- **Kill Smoke**(CTRL-CI-016 = 本節):CI 對 pinned 6 條 smoke probe 真 apply mutation + assert killed
- **Full manual**(Step 4.5):PR 高風險車道時、開發者對全 167 probes 手動跑 `mutate.ts`(HEAD-bound、完整 apply/test/restore/verify)

## 6. CI

- [ ] `.github/workflows/ci.yml`:分支清單對齊你的策略;
      GitHub repo 設 branch protection(主線要求 CI pass)。`check:adoption` 會驗**四處集合精確相等**:
      `pre-commit` 的 `case` 行、`pre-push` 的 `refs/heads/… ) _is_protected=1` 行、ci.yml `push:` 與
      `pull_request:` 各自的 `branches: [...]` 行,都必須等於 config 的 `protectedBranches`(多一個、
      少一個都紅;push 清單裡只允許 `feature/**` 這一個 glob,其他 glob 一律擋)
- [ ] 同一 workflow 的 `Adoption Readiness Check` step(`npm run check:adoption`)要保留,恰 1 行
- [ ] 三處 delivery-branch 的 `if:` 行(Fetch delivery refs / TODOS Markers / Source-term)在 adopted mode 會被 A5.ci.if 驗:
      必須逐字等於 `if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch)`
      再對 `deliveryBranches` 每個 b 接 ` || github.ref == 'refs/heads/<b>'`。**`deliveryBranches` 是允許的 `origin/HEAD` 目標白名單**(delivery evidence 語意);出廠 template `deliveryBranches` = `["main"]`,出廠三處 CI condition 顯式列 `main`、另保留 dynamic default branch;**若要新增 `develop` 或其他非 default delivery branch**,依 [`docs/MIGRATION.md`](MIGRATION.md) `[Unreleased]` 附錄 A.1「換交付線 runbook」同步修改 `deliveryBranches`、三處 `if:` conditions 與相關 branch policy(不宣稱只改 `deliveryBranches` 即可完成換線)
- [ ] `Baseline Governance Check` step(pull_request only)要保留:同 repo PR 的 `--head` 所帶分支名,若存在於 merge-base 那側 `harness.config.json` 的 `protectedBranches`,腳本明文 SKIPPED;fork PR 不帶 `--head`。⚠️ 這個豁免只在所有
      `protectedBranches` 都真的開了 branch protection / ruleset(必須經 PR、不得直接 push)時成立
      —— GOV-005 branch-protection(catalog 分類 `periodic-governance`、schedule-only、非 per-PR gate)屬組織治理層,由 Owner/admin 稽核。
- [ ] **CTRL-CI-014「Protected Branches Drift Check」**(A3 defer ⑩ 交付):對 PR
      內 `harness.config.json` 的 `protectedBranches` 集合擴大(加分支)fail-closed
      exit 2。**無 PR-controlled marker / opt-out**;合法擴大需 Owner/admin 組織治理
      層 override(branch protection allow + 稽核),rollback = full revert PR。
      CI step `if:` 為 `github.event_name == 'pull_request'`(唯一允許條件、無 branch
      filter);`--base` 用 `github.event.pull_request.base.sha`(immutable PR base SHA);
      checkout `fetch-depth: 0` 保證 merge-base object 可用。
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
