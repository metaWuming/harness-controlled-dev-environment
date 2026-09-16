# Plan — `loadHarnessConfigOrFail` wrapper

> SOP Step 1 產出。批准後進 Step 3(feature branch + atomic commits)。

## Context

`scripts/lib/harness-config.ts:215` 的 `loadHarnessConfig(root)` 對「檔缺 / JSON 壞 / schema 錯」全 throw,檔頭 doc L9-11 明列 throw 條件並註明「呼叫端 catch → exit 2」。**doc 承諾未兌現成程式碼**——每個 CLI caller 各自手寫 try/catch + exit 2。

**探勘核實 caller 現況**(母 repo,2026-09-16):

| Caller | 位置 | 目前 pattern | 遷移? |
|---|---|---|---|
| `scripts/check-branch-protection.ts` | L18, 157-163 | try/catch → `讀 harness.config.json 失敗:${msg}` + return 2 | ✅ 遷移 |
| `scripts/check-adoption-readiness.ts` | L52, 906-912 | try/catch → `NOT_READY — ${HARNESS_CONFIG_PATH} 無法載入(exit 2)` + return 2 | ✅ 遷移 |
| `scripts/check-claims.ts` | L246-258 (via `resolveDefaultBase`) | try/catch → fail-closed exit 2 + comment 明講「破契約 = exit 1」 | ✅ 遷移 |
| `scripts/check-cso-trigger.ts` | L125-137 (via `resolveDefaultBase`) | 同上 pattern | ✅ 遷移 |
| `scripts/lib/delivery-refs.ts::loadDeclaredDeliveryBranches` | L109-117 | try/catch → `{ rejection: {code:'config.invalid'} }` 資料化 | ❌ 不動 |
| `scripts/lib/delivery-refs.ts::resolveDefaultBase` | L158-159 | 裸呼、throw-through(JSDoc 明講 caller 自理) | ❌ 不動 |

4 個 CLI caller、pattern 100% 一致(exit 2 + 錯訊息);2 個 library 層 caller **語意刻意不 exit**、保留 throw→資料轉換權。

## Phases

### Phase 1 — 抽 wrapper + unit tests

- `scripts/lib/harness-config.ts` 尾部新增 export(依 explore 建議、doc 承諾兌現)
- 簽章:`loadHarnessConfigOrFail(root: string, msgPrefix?: string): HarnessConfig`
  - `exitCode` 硬編 2(SOP 契約唯一值、無其他 caller)
  - `msgPrefix` optional、預設 `'讀 ${HARNESS_CONFIG_PATH} 失敗'`——保留各 caller wording
- 實作 ~8 行:try/catch → `console.error('${msgPrefix}:${(e as Error).message}')` + `process.exit(2)`
- 型別註記:回傳 `HarnessConfig`(never 從 catch 分支的 process.exit 之後不會到)
- `tests/harness-config.test.ts` 加 unit tests:
  - happy path 回 config
  - throw 條件觸發 exit 2(用 vi.spyOn(process, 'exit'))
  - msgPrefix 客製 vs default

**驗證**:typecheck / lint / `npm test tests/harness-config.test.ts`

### Phase 2 — 遷移 4 個 CLI caller

依序改動,每 caller 一個 commit(atomic):
1. `check-branch-protection.ts`——直接 caller、遷移最簡單
2. `check-adoption-readiness.ts`——訊息 `NOT_READY — ...無法載入(exit 2)` 用 msgPrefix 保留
3. `check-claims.ts::resolveDefaultBase`——**間接** caller,`resolveDefaultBase` 本身是 hardcoded ref list 沒讀 config;實際 loadHarnessConfig 呼叫在 `check-claims.ts:243`(依 explore 探勘位置)。遷移該處
4. `check-cso-trigger.ts`——同 check-claims pattern

**注意**:探勘顯示 check-claims / check-cso-trigger 的 `resolveDefaultBase` 是本地版、跟 `delivery-refs.ts::resolveDefaultBase` **不同函式**。Phase 2 起手第一動:讀這 4 個 caller 完整定位真實 loadHarnessConfig 呼叫點,不靠 explore 摘要。

**驗證**:每 caller 遷移後跑 `npm test` + 對應 e2e。全 4 個遷完跑 `npm run typecheck && npm run lint && npm test`。

### Phase 3 — 補 check-branch-protection e2e 缺口

Explore 抓到:`tests/check-branch-protection.e2e.test.ts:87` 走 fixture 寫 harness.config.json、**未見 config 壞掉的 exit-2 案例**。順手補 1-2 條 e2e(config 缺 / config JSON 壞)assert exit 2 + 訊息 prefix。

**驗證**:`npm test tests/check-branch-protection.e2e.test.ts`

### Phase 4 — Doc drop

- `scripts/lib/harness-config.ts` 檔頭 comment L9-11「呼叫端 catch → exit 2」改為「CLI caller 用 `loadHarnessConfigOrFail`;library 層自理 try/catch」
- 若有其他 doc 提到這 pattern(`docs/CONTROL-CATALOG.md` / `docs/ADOPTION.md`),Phase 4 起手 grep 一輪

**驗證**:`npm run check:doc-refs && npm run check:no-source-terms && npm run check:doc-size`

## Sensible Defaults(Owner 可否決)

| # | 決策 | 理由 |
|---|---|---|
| D1 | wrapper 放 `scripts/lib/harness-config.ts` 尾部同檔 export | doc 承諾同檔、explore 建議、無 barrel export |
| D2 | Signature = `loadHarnessConfigOrFail(root, msgPrefix?)`;exitCode 硬編 2 | 唯一契約值、無其他 caller;msgPrefix optional 保原有 UX wording |
| D3 | Feature branch = `feature/load-harness-config-or-fail-wrapper` | 對稱 issue-93 branch 命名 |
| D4 | 遷移範圍 = 4 個 CLI caller;library 層 2 個不動 | Library 語意刻意 throw-through / 轉資料、不 exit |
| D5 | 順手補 check-branch-protection e2e config-throw 案例 | Explore 抓到覆蓋缺口、遷移 wrapper 順手補 |
| D6 | 這 sprint 不動 Team W | Team W 下次 harness upgrade 自動吃到,對稱 issue #93 姿態 |
| D7 | Plan file 位置 = `.claude/plans/`(新建目錄) | 母 repo 無既有慣例、選最中性 |

## 不在範圍

- Team W 側 port(Team W 下次 upgrade 自動)
- 其他 CLI helper wrapper(僅這一條、單一 refactor)
- SOP checklist 母 repo vs Team W drift 對齊(Explore 抓到 12 行 diff、單獨 sprint)
- delivery-refs.ts 兩個 library caller 的 API 設計(語意刻意保留)

## 風險

| 風險 | 觸發面 | 緩解 |
|---|---|---|
| 遷移後 caller 錯訊息 UX drift | check-adoption-readiness `NOT_READY` prefix 特殊 | msgPrefix 逐 caller 帶入原有 wording |
| Phase 2 誤觸 library 層 caller | delivery-refs.ts 兩個 caller | 明列 target list、Step 4 review 檢查 |
| Phase 3 e2e fixture 難模擬 config 壞 | tmpdir 寫壞 JSON 或空檔 | 對稱 tests/harness-config.test.ts 既有 fixture |
| CSO 觸發判定 | `scripts/lib/` 未在 CSO 表 | 起手跑 `npx tsx scripts/check-cso-trigger.ts` 確認 |

## Review 姿態

- **Step 4**:Codex CLI 撞 usage limit(Sep 19th 恢復)→ 走降級 Claude fresh subagent(對稱 progress ㉔ / ㉓ / ㉒ 姿態)
- **Step 4.5**:預期 CSO_NOT_REQUIRED(scripts/lib/ 未命中路徑表),起手跑 check-cso-trigger 核實
- **Step 4.6**:純後端 diff、UI 未觸發
- **Step 5**:同 fresh subagent 一 pass sanity check、寫 progress entry ㉕

## 預估成本

CC ~1h / 4 phases / 5-7 commits(4 caller + wrapper + Phase 3 e2e + Phase 4 doc drop)/ 預期 review 1 round Claude fresh subagent
