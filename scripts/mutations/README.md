# mutations/ — mutation testing spec

這個目錄放 `scripts/mutate.ts` 用的 mutation spec 檔(JSON)。每個 spec 檔是一份**測試
覆蓋率的可執行斷言**——把「我們宣稱某條測試守得住某條不變量」變成一個可以逐條驗的清單。

## Spec 格式

一個 JSON 陣列,每項:

```json
{
  "file": "scripts/check-doc-size.ts",
  "find": "if (!fs.existsSync(abs))",
  "replace": "if (false)",
  "label": "拿掉缺檔 fail-closed → doc-size 測試應該轉紅",
  "all": false
}
```

欄位:

- `file`(必填):repo 相對路徑
- `find`(必填):要被改掉的原文樣本(非 regex——regex 容易誤傷)
- `replace`(必填):改成什麼
- `label`(必填):這條在驗哪一條不變量。**收尾摘要會逐條印出來、直接貼進 PR 當
  覆蓋率佐證**——沒 label 就對不回 PR 的宣稱
- `all`(選填,預設 `false`):樣本出現多處時是否全換。**預設拒跑**避免誤傷

## 怎麼跑

```bash
# 一批
npx tsx scripts/mutate.ts --spec scripts/mutations/<spec-name>.json

# 單條(spec 檔以外的臨時 mutation)
npx tsx scripts/mutate.ts --file src/example.ts \
  --find 'if (!isAdmin) throw' --replace 'if (false) throw' \
  --label '拿掉 admin 檢查應該讓授權測試轉紅'
```

## 開跑前先看

- 工作樹**要乾淨**——`mutate.ts` 閘① fail-closed,先 `git commit` 或 `git stash`
- **`monorepo + turbo` 專案**要顯式指定 `--cwd` 到跑 test 的子專案目錄(不然從 root
  跑會命中 turbo 快取,那個綠什麼都沒證明)
- **每條 spec 都要對得回某條測試**——survived(存活)代表覆蓋缺口,PR 收尾要逐條交代
  是補測試還是說明為什麼不補

## Exit code

- `0` 全部 mutant 被抓到
- `1` 有 mutant 存活(覆蓋缺口)
- `2` 無法判定(拒跑／樣本沒對上／對照紅／turbo 快取／基礎設施錯誤／還原失敗)

## 範例

- `example-fail-closed-guard.json` — 對 `check-doc-size.ts` 的 fail-closed 缺檔守衛
  做 mutation,驗 `tests/check-doc-size.test.ts` 有守得住那條不變量。這是範例,
  你的專案 mutation spec 依業務需求另外寫。
- `source-term-diff-scan.json` — 本模板自身的 29 條探針,守 `check-no-source-terms.ts`
  的 history diff scan(patch 提取 / 路徑解析 / hit framing / 批次邊界 / 長行處理)。
  高風險車道的覆蓋率佐證就是它:`npx tsx scripts/mutate.ts --spec scripts/mutations/source-term-diff-scan.json`。
- `adoption-readiness.json` — PR A2 的 16 條 + PR A3 的 4 條(M15–M18),共 20 條探針,守 `check-adoption-readiness.ts` /
  `lib/harness-config.ts` / `lib/template-governance.ts`(loader fail-closed、mode dispatch、
  A3 / A4 / A5 / A7 規則、字面分支名文法;M12–M14 由 e2e 行為級證據殺)
- `control-catalog.json` — PR A3 的 14 條探針,守 `lib/control-catalog.ts`(loader 形狀與一致性)與
  `check-control-catalog.ts`(路徑 tracked、ci.yml 雙向鎖 3b / 3c / 3e、無名 step、巢狀 name: 不算、引號還原、渲染一致、exit 契約)
- `baseline-governance.json` — PR A3 的 11 條探針,守 `check-baseline-governance.ts`(allowlist、祖先 / 方向檢查、
  promotion 豁免讀 merge-base、ls-tree 失敗不當 absent、argv 與 env 契約、exit 契約)
- `git-add-guard.json` — 7 條探針,守 `git-hooks/pre-commit` 的 TOOL_ARTIFACT_PATTERN 守門(任何分支擋本機工具產物)
  與 `check-hooks.sh` 對第三個 SSOT 的要求
  **spec 的 `find` 是原始碼逐字樣本**——改到那些行就要同步改 spec,否則 mutate 會以
  「樣本沒對上」exit 2(fail-closed,不會靜默通過)。
- `mutation-spec-drift.json` — 6 條探針,守 `check-mutation-specs.ts`(spec 檔與目標檔的可信邊界、DRIFT 判定、exit 0/1/2 契約)
- `delivery-refs.json` — 8 條探針,守 `lib/delivery-refs.ts` 共用契約(受驗 origin/HEAD 的正規 / 存在 / 宣告檢查、拒絕不靜默、無 fallback、**不讀 env**)與兩個 consumer 的 exit 2 接線

## CI 守樣本漂移(`npm run check:mutation-specs`)

CI step「Mutation Spec Drift Check」對本目錄每個 spec 檔的每條探針驗 `find` 樣本**仍能在目標原始碼精準對上**
(存在、恰一處或已標 `all`、replace 有差)。它**不跑 mutation**,只是 `mutate.ts` 閘② 的前置版:
對得上不代表探針仍會 kill(那要 Step 4.5 人工跑 mutate 綁 HEAD),對不上則 mutate 必然拒跑。
- exit **1** = 漂移(內容層):改了那幾行就同步改 spec 的 `find`;JSON / 欄位壞也算這類
- exit **2** = 無法判定:`scripts/mutations` 不是真目錄、0 個 spec 檔、spec 檔本身是 symlink / 未追蹤 / 非一般檔 / hardlink / 非 UTF-8
  (spec 檔與目標檔都先經 `mutate.ts` 的 `checkTarget` 取 bytes,再解析——PR 把 tracked spec 換成指向 repo 外的
  symlink 時,外部檔不會成為 CI 輸入)
兩者在 CI 都是紅;分開只為診斷語意。
