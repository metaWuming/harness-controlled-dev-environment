---
title: TODOS
type: note
---

# TODOS

技術債、延後工作、未來迭代項目的中央追蹤表。
每項由哪個 review 產生、優先級、預估工時都要記清楚。

**格式:**
- 🔴 P1: 上線前必做,或會影響既有功能
- 🟡 P2: 上線後 1-3 個月內應處理
- 🟢 P3: 長期 / 有時間再做
- ⚪ IDEA: 未採用但想記下以備將來檢視

**Marker 治理公約**(由 `scripts/check-todos-markers.ts` CI gate 執行):
本檔任何**完成宣稱**(`✅` / 完工 / 已晉升)**必須引用交付 PR 號**(`(#N)` 或 `PR #N`)——
CI 會驗該 PR 有 merge 證據,防打錯號 / 投機性標 ✅。
`[🟡 partial]` / `[❌ pending]` 條目若已有交付 PR merged,要嘛翻 ✅、要嘛補阻塞詞
(⏳ / 卡 / 待外部 / 待拍板)說明為何仍未完。等 Owner 決策的條目,阻塞詞用**待拍板**
(決策請求格式見 `.claude/sop/decision-request-template.md`)。
⚠️ 阻塞詞是**子字串比對**:不要在條目裡寫否定句(如在阻塞詞前加「不再」「已不」)——
照樣會被當阻塞、壓掉 stale advisory。阻塞解除時,直接刪掉阻塞詞、或翻 ✅。
**完成狀態的 SSOT 是本檔**,記憶層勿抄寫當權威。

---

## P1(上線前必做)

<!-- 範例格式:

### 🔴 <標題>
- **來源**:哪個 review / 健檢 / 教訓產生
- **內容**:要做什麼、為什麼
- **工時**:估算
-->

## P2

### ✅ 模板作者的簿記契約仍套在採用者身上(G2 / G4)(PR #43)
- **來源**:2026-09-01 PR A1.1 Step 5 r2 I4 / r3 C2(adversarial-reviewer,confidence 7-10)
- **內容**:`tests/check-doc-refs.test.ts` 的 G2 把 `.claude/memory/progress.md` 與 2026-08 archive 的 ADR 引用數釘成 1、G4 斷言 progress.md 不含 `/Users/`。這兩條是**模板作者的簿記**,卻會隨模板複製、由採用者的 `npm test` 執行:採用者改寫自己的 progress、或在 macOS 寫自己的路徑就紅,而 checker 是綠的。
  A1.1 曾用 runtime 判別式(`isTemplateRepo()`)處理,r3 證明那個做法更糟(對族群判反、同時是一行斷路器、fail-open),已整組移除。G6 已改成靜態的模板出貨路徑前綴清單,G2/G4 尚未處理。
- **可能方向**:比照 G6 改成靜態清單;或把這類「模板出貨前的自我檢查」移出交付給採用者的測試套件。**不要**再引入 runtime 判別式。(Step 5 r1 I12:上方「G2/G4 尚未處理」是登錄當時的狀態,已由下方交付收掉)
- **工時**:2-3h
- **交付**:PR A2 —— 走第二個方向:G2 / G4 搬到 `scripts/lib/template-governance.ts`,由 `npm run check:adoption` 只在 `scripts/harness.config.json` 宣告 `mode: "template"` 時執行(T9 / T8);vitest 刪除兩條;mode 是顯式靜態宣告、無 runtime 判別式(mutation M12–M14 行為級證據)

### ✅ `DELIVERY_REFS=HEAD` 可從環境變數還原「未合併分支進 allowlist」(PR #48)
- **來源**:2026-09-01 PR A1.1 Step 5 r3 I9(confidence 6)
- **內容**:`DELIVERY_REFS` 只過 `SAFE_REF_RE` + `rev-parse --verify`(option injection 已擋住),但 `HEAD` 或任何 feature branch 名都解得開。在 feature branch 上設 `DELIVERY_REFS=HEAD`,未 merge commit 的 subject 就進了 `allowedPrs` —— round 2 P1-1 的修法可被整條還原,目前無守門。
- **工時**:1-2h
- **交付**:`scripts/lib/delivery-refs.ts` 共用契約(supervisor rev 4):origin/HEAD 權威 base 與 env 候選走同一支 `validateRef`(形狀 / 存在 / 正規 / 祖先 / 宣告在 `deliveryBranches`);`HEAD`、本地分支、未合併 `origin/feature/x`、未宣告分支一律拒絕、印原因碼、exit 2;移除 fallback ③④。兩支 checker 只接線;`check-no-source-terms.ts` 掃描語意 0 diff。lib 單測 19 條(每原因碼各一)+ 兩 consumer 行為級負對照 + 探針 `delivery-refs.json` 8 條

### ✅ mutation spec 漂移無 CI 守門(PR #47)
- **來源**:2026-09-01 PR A1.1 Step 5 r2 I16(confidence 6);A1.1 內實際發生過一次(M14 隨串流改寫失效、M23 隨編碼釘法插入失效)
- **內容**:29 條探針是高風險車道的覆蓋率佐證,但 CI 只跑 `vitest`、不跑 `mutate`。spec 的 `find` 是原始碼逐字樣本,改到那些行就會對不上;`mutate.ts` 對此 fail-closed(exit 2),但**只有人工重跑時才會發現**。
- **可能方向**:CI 加一支只驗「所有 spec 的 find 樣本仍能在原始碼中找到」的輕量檢查(不跑完整 mutation,避免 CI 時間爆掉)。
- **工時**:1-2h
- **交付**:`scripts/check-mutation-specs.ts` + CI step「Mutation Spec Drift Check」(CTRL-CI-013)。只複用 `mutate.ts` 純函式(`checkTarget` / `parseSpecs` / `applyMutation`);spec 檔與目標檔都先經 `checkTarget` 取 bytes 再解析(supervisor plan rev 2 P1:tracked spec 換 symlink → exit 2,外部檔不成為輸入)。exit 1 = 漂移 / 2 = 無法判定。24 條測試(含 10 條真 CLI e2e)+ 自身探針 `mutation-spec-drift.json` 6 條

## P3

### 🟢 P2#2 Step 5 defer 集合(delivery-refs 契約邊角,9 條 INFORMATIONAL conf 5–9)
- **來源**:2026-09-03 PR P2#2 Step 5 worktree 審 r1–r2;0 CRITICAL 未修
- **內容**:①**env `DELIVERY_REFS` 在祖先契約下是空操作**——通過驗證的候選必是 base 祖先、`git log` 集合 ⊆ base,加不進任何新 PR 號;通道只剩「驗證會不會拒絕」(conf 9;待 supervisor 決定:登錄為已知限制、或整個移除以縮攻擊面);②`ci.yml` 第 59 行與 Fetch step 註解仍寫「GitFlow 導入者覆蓋 env 常數即可 / env 能加交付分支」,新契約下 `origin/develop` 非 base 祖先 → 永久 exit 2(conf 9);③`check-no-source-terms.ts` 新 `process.exit(2)` 在 `main()` mkdtemp 之後,`finally` 清理不跑、本機反覆失敗會留 `cnst-*` 目錄(conf 9;修法:把 `loadAllowedPrs` 移到 pattern file 建立前、或改回傳值);④`merge-base --is-ancestor` exit 128(未 fetch / shallow)與 1(真非祖先)同判 `ref.nonancestor`,診斷誤導(conf 6);⑤tag 同名 `origin/main` 讓兩 gate 對所有 PR exit 2(fail-closed 型 DoS,非繞過;conf 6);⑥`ci.yml` 的 `develop` fetch 是死步驟(conf 6);⑦`harnessConfigJson` 在兩個測試檔逐字兩份,schema 升版要改兩處(conf 6);⑧無 base 時 env 候選借用 `ref.nonancestor` 原因碼、語意不精確(conf 5);⑨`LESSONS.md` / `docs/OVERVIEW.md` 仍寫四條來源與舊 env 語意(conf 5;LESSONS 屬治理內容需完整 SOP)
- **交付(PR #___)**:① supervisor 拍板移除——env 通道、workflow-level env、`ref.*` 原因碼與對應測試 / 探針整組刪除,新增「不讀 env」等價測試與 DR-M9;② 與 ⑥ 隨 ci.yml 同段改寫一併收(develop fetch 行刪除;`if:` 的 `refs/heads/develop` 不動,屬 A3 defer ①);⑧ 隨 env 移除自然消失
- **方向(其餘)**:③ 0.5h;④ 隨 env 通道移除自然消失(祖先檢查已不存在);⑤⑦⑨ 逐條 0.5h
- **工時**:合計 2–3h

### 🟢 P2#3 Step 5 defer 集合(check-mutation-specs 邊角,15 條 INFORMATIONAL conf ≤8)
- **來源**:2026-09-02 PR P2#3 Step 5 worktree 審 r1–r2;0 CRITICAL 未修
- **內容**:①`mutate.ts` / `check-control-catalog.ts` 的 `isMain` 同款未 realpath,經 symlink 目錄呼叫靜默 exit 0(r1 C1 只修了本 checker;conf 7);②`invokedAsMain` realpath 單邊 fallback 仍可能不等 → 靜默 exit 0,根本解是 isMain false 時印 stderr(conf 7);③`fileURLToPath` 對非 file: URL 在模組頂層 throw(conf 6);④測試手拼 `'file://'+path` 應改 `pathToFileURL`(conf 7);⑤只認小寫 `.json` 且不遞迴,子目錄 / 大寫副檔名 spec 靜默不受守門(conf 8);⑥`checkTarget` nlink 檢查在純讀情境多餘拒判(conf 7);⑦MSD-M1 / M5 實際 kill 機制是 TypeError 走 exit 2,與 label「判 DRIFT / untrusted」不一致(conf 8);⑧catalog CI-013 `implementation` 未列 `scripts/mutate.ts`(邏輯所在;conf 6);⑨README / catalog degradation 的 exit 2 清單漏 root 解析失敗、argv 錯、未預期例外三種(conf 7);⑩`formatReport([])` 回 code 0,純函式對空輸入 fail-open、只靠 listSpecFiles 前置擋(conf 6);⑪`--root` 指外層 repo 子目錄時「repo 內」與「tracked」兩個邊界不同(conf 5);⑫e2e ⑤「外部檔未成為輸入」斷言靠 `not.toContain('對得上')`、fixture 加第二個 spec 就失效(conf 6);⑬`--allow-empty` 多餘(conf 5);⑭spec 帶 UTF-8 BOM 診斷訊息差(conf 5);⑮`PR #___` 佔位靠 Step 6 補號(A3 defer ② 同形;conf 5)
- **方向**:①② 一起收(三支 checker 抽共用 `invokedAsMain` 到 `scripts/lib/`,isMain false 印一行);⑤⑨⑧ 各 0.5h;其餘逐條 0.5h
- **工時**:①② 1h;其餘逐條 0.5h

### 🟢 A3 Step 5 defer 集合(control catalog / baseline governance 邊角,21 條 INFORMATIONAL conf ≤7)
- **來源**:2026-09-03 PR A3 Step 5 worktree 審 r1–r5;0 CRITICAL 未修
- **內容**:①模板自身 ci.yml 三處 `if:` 行含 develop、對 template config(deliveryBranches main)不合,A5.ci.if 只在 adopted 跑(conf 6);②`PR #___` 佔位 TODOS Markers Check 不抓,靠 Step 6 補(conf 6);③`repoFilePathViolation` 放行 `|` 與反引號(conf 4);④單一 `mergeStrategy` 表達不了雙階段策略(conf 3);⑤template 遺產舊值解不開視為首次設定,把全史掃描縮成 cutover(刻意,Owner PR 授權)(conf 4);⑥tab 縮排讓 keyIndent 撞更深 `name:`(YAML 禁止 tab)(conf 3);⑦同 item 兩個直屬 `name:` 後者覆蓋(parser 會拒)(conf 3);⑧`steps: [{…}]` 非空 flow sequence 不算區塊(假紅)(conf 3);⑨回灌 PR(main → develop)SKIPPED 訊息措辭反向(conf 2);⑩`protectedBranches` 集合擴大無任何 gate 警示,promotion 豁免健全性依賴人審 + branch protection(GOV-005 advisory)(conf 6);⑪steps 混合縮排(不合法 YAML)靜默漏抓(conf 4);⑫引號跳脫其餘形狀(`\\`、`\t`、`"x" # c "d"`)fail-closed 假紅(conf 5);⑬舊值 null 時 OK 行寫「見 info」但無 info(conf 7);⑭`config.head.invalid` / `config.base.invalid` 兩條 UNDETERMINED 丟掉 infoLines(conf 6);⑮UNCHANGED + info 與 `directionChecked` 文字無測試斷言(conf 5);⑯–㉑r1 其餘:`--root` dynamic import 已在檔頭標明、mutate spec 每個突變跑全套 vitest 超 10 分鐘(建議 `--cmd` 縮到相關測試檔或拆 spec)、`mutate.ts` 被 SIGTERM 砍不還原(已在 P3 defer 集合)、CTRL-CI-009 notes 限制 1 敘述、check:catalog 錯誤訊息對 `steps: # 註解` 已修、E-self 在本 repo 合法推進 baseline 後跳過(已實作)
- **方向**:⑩ 是唯一結構性項目——在 `check:adoption` 或獨立 gate 對「`protectedBranches` 集合相對 merge-base 擴大」印 warn 並要求 PR 描述說明(Milestone C governance verification 一併看);⑬⑭⑮ 一起收(0.5h);其餘逐條 0.5h
- **工時**:⑩ 1–2h;其餘逐條 0.5h

### 🟢 A2 Step 5 defer 集合(check:adoption 邊角,17 條 INFORMATIONAL conf ≤6)
- **來源**:2026-09-02 PR A2 Step 5 worktree 審 r1(10 條)/ r2(1 條)/ r3(6 條);0 CRITICAL
- **內容**:①`checkCiRunsAdoption` 只比對 `run:` 行,step 加 `if: false` / `continue-on-error` 仍過(conf 5);②字面分支名文法比 `git check-ref-format --branch` 寬(`main.`、`a/.b`、`feat/x.lock/y` 通過;fail-closed 方向,4 來源都得含它才 READY)(conf 5);③`parsePart4` 逐行找 `### 4.x` 先於註解剝除,HTML 註解內假標題可覆蓋真段(conf 5);④4.5 路徑放行 `isDir` 讓 `` `..` `` / `` `.` `` 過(conf 4);⑤`PLACEHOLDER_RE` 不含 `?` / `無` / `unknown`(conf 4);⑥hook 檔 CRLF 讓 A5 regex `;;$` 找到 0 → 假紅(conf 4);⑦`--root` dynamic import 會執行該 root 的 `cso-trigger.config.ts`(等同跑對方 npm scripts;檔頭應標明)(conf 3);⑧4.3 反引號計數不辨 fenced code(conf 3);⑨HTML 註解剝除 regex 不辨 markdown code 邊界,code block 內 `<!--` … `-->` 會吞掉真引用(conf 4);⑩A6.claude.link 仍是子字串比對、比 codex 側寬(conf 4);⑪–⑯4.6 合併策略關鍵字檢查:`merge-commit-sha` / `mergecommit` 命中(conf 6)、`ff-only` 在 URL / 檔名內命中(conf 5)、否定句「不要用 no-ff」通過(conf 5)、`fast-forwarded` / `rebases` / 雙空白不過(conf 4)、錯誤訊息與 CLAUDE.md / ADOPTION 未列 ff 系寫法(conf 4)、正對照未覆蓋 `merge-commit` 連字分支(conf 2)
- **方向**:4.6 那組是「關鍵字存在」檢查的固有邊界,不要再打補丁——若要收,改成要求採用者在 harness.config 宣告 `mergeStrategy` 枚舉值、4.6 只驗有沒有以反引號提到它(A3 catalog 時一併評估);其餘逐條 0.5–1h
- **工時**:逐條 0.5–1h;4.6 改宣告式約 2h
- **交付(部分,PR A3)**:⑪–⑯(4.6 那組)—— `harness.config.json` schemaVersion 2 加必要欄位 `mergeStrategy`,4.6 改驗「以反引號提到宣告值」、關鍵字 regex 整段刪除;①–⑩ 仍 pending

### 🟢 `grep.column=true` 時 `git grep -z` 是三個 NUL,顯示會錯位
- **來源**:2026-09-01 PR A1.1 Step 5 r3 I11(confidence 8)
- **內容**:`grep.column=true` 下輸出是 `path\0line\0column\0content`,`parseGrepZLine` 只切前兩個,content 多帶一段欄號前綴。**對判定無安全影響**(CA extractor 仍抽得到全部引用、方向是多保留),但 `displayGrepHit` 印出的 `path:line:content` 會錯位。這個形狀不在〈hit framing〉表格的三種之內。
- **工時**:0.5-1h

### 🟢 `mutate.ts` 被 SIGTERM 殺掉不會還原原始碼
- **來源**:2026-09-01 PR A1.1 Step 5 r3 I12(confidence 8,reviewer 實測留下污染工作樹)
- **內容**:外層 timeout 或 CI 取消時,mutate 已改壞的原始碼不會還原。README 對 spec 的 fail-closed 講得清楚,但沒提這個。
- **可能方向**:signal handler 還原 + README 補一句。
- **工時**:1h

### 🟢 doc governance 測試的其餘缺口(A1.1 defer 集合)
- **來源**:2026-09-01 PR A1.1 Step 5 r1-r3 的 INFORMATIONAL(confidence ≤7,逐條見各輪 review;A1.1 共 defer 23 條)
- **內容**:G2 錨點視窗仍容易被兩字的「決策」誤中;`SCAN_DIRS` 是手維護的非遞迴清單;G1/G3/G5 無條件執行,採用者照 ADR 導入步驟第 4 條刪掉 checker 後會崩而非漂亮地紅;ADR 導入步驟第 1 條描述了採用者不會處在的狀態;ADR 已知限制第 6 條把非 UTF-8 對 CJK 條目的影響講得偏無害。
- **工時**:逐條 0.5-2h

## P3

### ✅ long-lived pre-baseline branch merge grandfathered false positive(PR #44)
- **來源**:PR A1 sprint entry(`.claude/memory/progress-archive/progress-2026-08.md`「2026-08-29 ① PR A1」):
  「R7 剩一條 P2 false positive(long-lived pre-baseline branch merge 誤紅 cleanup PR),Owner 拍板 A defer 給 A3」;
  ADR〈已知限制〉第 3 條。本條由上述已 commit 證據重建(PR A3 P3b),未取用任何未 commit 內容
- **內容**:`--first-parent` 語意下,pre-baseline 建立的長命分支合併後做清理,對 pre-baseline parent 的 diff 把
  grandfathered 標為 add → 阻擋合法 cleanup PR(誤紅、非漏抓)
- **交付**:PR A3 —— **不修掃描器**(混合掃描策略屬架構級變更);ADR 新增〈長命 pre-baseline 分支的清理程序〉
  (rebase 到 post-baseline / 走獨立 baseline PR 受 CTRL-CI-012 守門 / admin override 留紀錄),登錄 control catalog
  CTRL-GOV-003(manual-mandatory)

### ✅ baseline 治理旁路(同 PR 內把 baseline 往前推洗白 forbidden)(PR #44)
- **來源**:PR A1 sprint entry(同上):「Step 5 adversarial-reviewer … conf ≥ 6 一條(治理旁路)defer 給 A3」;
  ADR〈已知限制〉第 2 條。由已 commit 證據重建(PR A3 P3b)
- **內容**:一個 PR 同時改 baseline 到 PR tip、中間 commit 加 forbidden、後續刪 → `baseline..HEAD` 幾近空、
  current tree 乾淨 → gate 假綠;原本只靠 Owner review、machine face 零守門
- **交付**:PR A3 —— `scripts/check-baseline-governance.ts` + CI step「Baseline Governance Check」(CTRL-CI-012,
  pull_request only):baseline 值改變時 PR 只准動 config / ADR / bookkeeping allowlist,新值須為 merge-base 祖先
  (不得指向 PR 內 commit)且為舊值後裔;16 條 e2e + 7 條探針

### ✅ buildDeliveryRefs 前三條 fallback 路徑 e2e 覆蓋 (#33)
- **來源**:2026-08-28 批 7 Step 5 F2(adversarial-reviewer,confidence 7);TODOS 措辭原寫「check-todos-markers」但正確目標是 `scripts/check-no-source-terms.ts`(D0 修正)
- **內容**:e2e 全部走 last-resort 本地 main fallback、①origin/HEAD ②DELIVERY_REFS env ③origin/develop 三條路徑無對照
- **工時**:0.5-1h
- **交付**:批 8 Phase A(commit `1536fa7`)——擴 `makeRepo` opts 加 `originRefs` 支援 + `runChecker` envOverride + 4 e2e case(A-e1..A-e4)。round 1-3 fix:sentinel branch name(A-e1)、逗號多 ref(A-e2)、B-e4 history-blob 獨立 case

### ✅ workflow yml Source-term step 加 MARKER_SELF_PR env(sprint 內 self-reference 可過)(#33)
- **來源**:2026-08-28 批 7 Codex round 6 P2-2(defer:「該做更多」型 finding、Owner 拍板不進本 sprint)
- **內容**:`.github/workflows/ci.yml` Source-term scan step 加 `MARKER_SELF_PR: ${{ github.event.pull_request.number }}` env,checker 讀該 env 把當前 PR 號加入 allowedPrs
- **工時**:1-2h
- **交付**:批 8 Phase B(commit `4855117`)——`loadAllowedPrs` 加 env 讀取(對齊 `scripts/check-todos-markers.ts:423-424`)+ workflow yml env + 3 e2e case(B-e1..B-e3)。round 2-3 fix:診斷輸出改「delivery 已 merge M + self-PR K」+ B-e4 補 history-blob 覆蓋 + B-e3 加 "1.5" 浮點守
- **⚠️ 已知範圍限制(批 8 Step 5 F4)**:此修法只解 `pull_request` event(PR 開之後);`push:feature/**` event 下 `github.event.pull_request.number` 為 null → env 空 → self-PR 引用仍會被擋(feature branch push 走 CI 紅、開 PR 後 CI 綠)。真正解法是把 Source-term scan step 加 `if:` gate 對齊 TODOS Markers Check step、跳過 non-delivery-branch push;defer 進下方新條目

### ✅ README 13 關卡敘述同步風險車道 (#30)
- **來源**:2026-08-27 風險車道升級 sprint(Owner 拍板 defer)
- **內容**:README 關卡⑧⑩ 補「CSO_REQUIRED 高風險車道 = 破壞性探針 + Step 5 worktree 獨立審」一句;關卡⑦不動
- **工時**:0.5h
- **交付**:Phase A(commit `f955f81`)

### ✅ bookkeeping 例外機器化(allowlist 檢查) (#30)
- **來源**:2026-08-27 Step 5 review(altitude finding,教訓階梯第 3 級預備)
- **內容**:寫小腳本核對「bookkeeping commit 的 diff 只含 progress.md / TODOS / BACKLOG 狀態簿記」,取代 SOP 的純散文自我分類;含 LESSONS.md 排除
- **工時**:1h
- **交付**:Phase C 初版 + round 1-5 迭代;實作用「精確 allowlist + progress-archive snapshot」路徑,LESSONS-archive 全排除(archived lessons 屬 governance)。SOP L323 收窄敘述與 F1 SSOT 位置整併

### ✅ mutate.ts 摘要印 HEAD SHA + decision-request 接線 Step 4-6 (#30)
- **來源**:2026-08-27 Step 5 review(2 條 skip 的 informational:探針 SHA 手抄易錯、template 自稱 Step 3-6 但只接線 Step 3)
- **內容**:mutate.ts 收尾摘要加 `git rev-parse HEAD` 輸出;SOP Step 4/4.5/5/6 各補一行 decision-request 指引或把 template 適用範圍改為 Step 3
- **工時**:1h
- **交付**:Phase B + review round 1 fail-closed 加固(startHead ↔ endHead 綁定 + `decideHeadBinding` 純函式);SOP 選「補一行接線」路線、四步都補;template 段落改「Step 3-6」補通用 SSOT 例

### ✅ workflow yml Source-term scan step 加 `if:` gate 對齊 delivery-branch 白名單 (#34)
- **來源**:2026-08-28 批 8 Step 5 F4(adversarial-reviewer, confidence 4)
- **內容**:批 8 Phase B 只解 `pull_request` event 的 self-PR ref 死鎖;`push:feature/**` event 下無 `pull_request.number` → self-PR 引用仍撞 CI 紅
- **工時**:0.5h
- **交付**:批 9 Phase A(commit `7de32f4`)—— Source-term scan step 加 `if:` gate 對齊 TODOS Markers Check step 既有 pattern。註解記錄「導入者若 delivery branch 不是 default_branch 或 develop 要同步加」

### ✅ batch 8 Step 5 F1/F2/F5 三條 informational 累積 (#34)
- **來源**:2026-08-28 批 8 Step 5(adversarial-reviewer)
- **內容**:F1(`MARKER_SELF_PR` 缺 `< 1e9`)/ F2(`selfPrCount` 診斷字面誤導)/ F5(drafts archival policy 缺)
- **工時**:1h
- **交付**:批 9 Phase B(commit `fe8bf94`)+ round 1-3 fix
  - F1:loadAllowedPrs 加 `selfPr < 1e9`;e2e 加 "9999999999" case;round 2 加 "1000000000" boundary case 守 `<` vs `<=` 邊界
  - F2:selfPrCount 語意改「env 通道 acknowledge」(collision 不受影響)+ 診斷用詞 + docstring「僅診斷用」contract
  - F5:archival 政策先加 template.md → round 3 挪到 CLAUDE.md Part 4.6(placeholder-style + 導入者可刪尾註,避免 GitHub template 散布 harness-internal 命名)

### ✅ develop-branch policy 拍板(跨 workflow yml 兩處統一方向)(#35)
- **來源**:2026-08-28 批 9 Codex round 2 vs round 3 pre-existing 兩難兩面
- **內容**:workflow yml 兩處 `DELIVERY_REFS` env 對 `origin/develop` 選擇相反,Owner 拍板方向
- **工時**:0.5h
- **交付**:批 10 Phase A(commit `b18ac7a`)—— Owner 拍板 **policy A(兩處都不加 develop、main-only default)**。理由:harness template 本身 main-only、legacy develop 誤放行是隱性 false negative(比 GitFlow 假紅嚴重)、GitFlow importer 客製 workflow yml 覆蓋 workflow-level env 常數即可

### ✅ workflow-level `DELIVERY_REFS` 常數機械化(SSOT、擋兩處 env 值漂)(#35)
- **來源**:2026-08-28 批 9 Step 5 二輪 F-round23-4(conf 5)
- **內容**:workflow yml 頂端 `env:` 區塊定義 workflow-level `DELIVERY_REFS` 常數、兩 step 都 reference
- **工時**:0.5h
- **交付**:批 10 Phase A(commit `b18ac7a`)+ Step 5 F1 完整化(commit `7633688`,MARKER_SELF_PR 也提到 workflow-level、同 SSOT 論證延伸)。兩 step 的 step-level DELIVERY_REFS + MARKER_SELF_PR 全部移除、繼承 workflow-level env,「未來翻值時只翻一處」漏洞關掉

### ✅ `check-todos-markers.ts:424` `MARKER_SELF_PR` 補 `< 1e9` 對稱 + shared lib(#35)
- **來源**:2026-08-28 批 9 Step 5 二輪 F-round23-5(conf 4)
- **內容**:批 9 F1 修法把 check-no-source-terms.ts 補 `< 1e9` 但 check-todos-markers 沒對齊
- **工時**:0.5h(擴至 1.5h,加 shared lib)
- **交付**:批 10 Phase B(commit `49e7a59`)先抽 pure fn 內部 SSOT → round 1 fix(commit `de3d081`)codex 抓「不是真正單一入口」→ 抽到 shared lib `scripts/lib/marker-self-pr.ts`、兩 script 共用;7 unit test(涵蓋合法/undefined/空字串/NaN/負值零/浮點/≥1e9 boundary)+ 2 e2e case(接線守、批 5 教訓「call site 另守」)

## IDEA

_(無、批 10 收乾)_

---

> **批 10(#35)收乾:P1 = 0 條 / P2 = 0 條 / P3 pending = 0 條**。
> 批 5-10 累積 P3 交付 8 條(批 5 三 / 批 8 兩 / 批 9 兩 / 批 10 三)、
> 現無 backlog。下一棒若需新工作:從 Owner 指示、健康檢查、或新 sprint
> defer 產出的 finding 開新 P3 條目。
