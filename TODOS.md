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

### 🟢 delivery-refs 移除 sprint defer 集合(2 條)
- **來源**:2026-09-03 移除 sprint Step 5 r2–r4;Owner 裁示停止遞迴後登錄
- **內容**:①**缺一份經驗證的「換交付線」runbook**——本版 MIGRATION 刻意不提供(四輪審查證明:任何一句指引都牽動 `deliveryBranches` 語意(證據白名單 vs `check:adoption` A5 `if:` 行與 A2.4.6 §4.6)、`ci.yml` `on:` / 三處 `if:` / Fetch step 的 fetch 與 set-head 行、push event 下沒有 `MARKER_SELF_PR` 豁免、Source-term scan 只對 `PR #N` / `pull/N` 字面判 allowedPrs)。要寫就要在 adopted mode fixture 上實跑過每一步(conf 8);②`docs/ADOPTION.md:125` / `docs/MIGRATION.md` 0.2.0 段 / `CHANGELOG.md` 0.2.0 段仍教導入者把 `develop` 列進 `deliveryBranches` 以過 A5——語意已變成「允許的 origin/HEAD 目標白名單」,多列對證據零影響但會改 A5 期望(conf 6;屬歷史版本敘述,改時與 ① 一起)
- **方向**:① 1–2h(含 fixture 實跑);② 隨 ① 收
- **工時**:2h

### 🟢 P2#2 Step 5 defer 集合(delivery-refs 契約邊角,9 條 INFORMATIONAL conf 5–9)
- **來源**:2026-09-03 PR P2#2 Step 5 worktree 審 r1–r2;0 CRITICAL 未修
- **內容**:①**env `DELIVERY_REFS` 在祖先契約下是空操作**——通過驗證的候選必是 base 祖先、`git log` 集合 ⊆ base,加不進任何新 PR 號;通道只剩「驗證會不會拒絕」(conf 9;待 supervisor 決定:登錄為已知限制、或整個移除以縮攻擊面);②`ci.yml` 第 59 行與 Fetch step 註解仍寫「GitFlow 導入者覆蓋 env 常數即可 / env 能加交付分支」,新契約下 `origin/develop` 非 base 祖先 → 永久 exit 2(conf 9);③`check-no-source-terms.ts` 新 `process.exit(2)` 在 `main()` mkdtemp 之後,`finally` 清理不跑、本機反覆失敗會留 `cnst-*` 目錄(conf 9;修法:把 `loadAllowedPrs` 移到 pattern file 建立前、或改回傳值);④`merge-base --is-ancestor` exit 128(未 fetch / shallow)與 1(真非祖先)同判 `ref.nonancestor`,診斷誤導(conf 6);⑤tag 同名 `origin/main` 讓兩 gate 對所有 PR exit 2(fail-closed 型 DoS,非繞過;conf 6);⑥`ci.yml` 的 `develop` fetch 是死步驟(conf 6);⑦`harnessConfigJson` 在兩個測試檔逐字兩份,schema 升版要改兩處(conf 6);⑧無 base 時 env 候選借用 `ref.nonancestor` 原因碼、語意不精確(conf 5);⑨`LESSONS.md` / `docs/OVERVIEW.md` 仍寫四條來源與舊 env 語意(conf 5;LESSONS 屬治理內容需完整 SOP)
- **交付(PR #49)**:① supervisor 拍板移除——env 通道、workflow-level env、`ref.*` 原因碼與對應測試 / 探針整組刪除,新增「不讀 env」等價測試與 DR-M9;② 與 ⑥ 隨 ci.yml 同段改寫一併收(develop fetch 行刪除;`if:` 的 `refs/heads/develop` 不動,屬 A3 defer ①);⑧ 隨 env 移除自然消失
- **方向(其餘)**:③ 0.5h;④ 隨 env 通道移除自然消失(祖先檢查已不存在);⑤⑦⑨ 逐條 0.5h
- **刻意保留(移除 sprint Step 5 r2)**:`tests/check-baseline-governance.e2e.test.ts` (9) 仍對 `check-baseline-governance` 傳 `DELIVERY_REFS`——那是 `baseline-governance.json` BG-M5(env 偷渡)探針的唯一偵測器,不是殘留,**不要清**;另 `ci.yml` 三處 `if:` 上方註解仍把 develop 當交付分支,屬 A3 defer ①(`if:` 行)同一組,一併處理
- **工時**:合計 2–3h

### 🟢 P2#3 Step 5 defer 集合(check-mutation-specs 邊角;①–⑮已交付或決策、collection closed;含 ④ WONTFIX 決策記錄、非 code 交付)
- **來源**:2026-09-02 PR P2#3 Step 5 worktree 審 r1–r2;0 CRITICAL 未修
- **內容**:~~①`mutate.ts` / `check-control-catalog.ts` 的 `isMain` 同款未 realpath,經 symlink 目錄呼叫靜默 exit 0(r1 C1 只修了本 checker;conf 7);②`invokedAsMain` realpath 單邊 fallback 仍可能不等 → 靜默 exit 0,根本解是 isMain false 時印 stderr(conf 7);③`fileURLToPath` 對非 file: URL 在模組頂層 throw(conf 6)~~;~~④測試手拼 `'file://'+path` 應改 `pathToFileURL`(conf 7)~~ **[④ WONTFIX 決策記錄、見下方「刻意保留」段;PR #60]**;~~⑤只認小寫 `.json` 且不遞迴,子目錄 / 大寫副檔名 spec 靜默不受守門(conf 8)~~;~~⑥`checkTarget` nlink 檢查在純讀情境多餘拒判(conf 7)~~;~~⑦MSD-M1 / M5 實際 kill 機制是 TypeError 走 exit 2,與 label「判 DRIFT / untrusted」不一致(conf 8)~~ **[登錄簡寫;實測見交付段:M1 是 catch fallback drift exit 1、M5 unit 是 pure TypeError、M5 對本 repo 是 self-reflection drift exit 1;都非「TypeError→exit 2」單一形狀]**;~~⑧catalog CI-013 `implementation` 未列 `scripts/mutate.ts`(邏輯所在;conf 6)~~;~~⑨README / catalog degradation 的 exit 2 清單漏 root 解析失敗、argv 錯、未預期例外三種(conf 7)~~;~~⑩`formatReport([])` 回 code 0,純函式對空輸入 fail-open、只靠 listSpecFiles 前置擋(conf 6)~~;~~⑪`--root` 指外層 repo 子目錄時「repo 內」與「tracked」兩個邊界不同(conf 5)~~;~~⑫e2e ⑤「外部檔未成為輸入」斷言靠 `not.toContain('對得上')`、fixture 加第二個 spec 就失效(conf 6)~~;~~⑬`--allow-empty` 多餘(conf 5)~~;~~⑭spec 帶 UTF-8 BOM 診斷訊息差(conf 5)~~;~~⑮ PR-number placeholder token 佔位靠 Step 6 補號(A3 defer ② 同形;conf 5)~~
- **交付(PR #50)**:①② 一併收——抽 `scripts/lib/invoked-as-main.ts` 共用 lib(discriminated outcome 三態 + 集中式 reporter + sanitize),三支 owner-scoped consumer(mutate / check-control-catalog / check-mutation-specs)接線;caller 對 indeterminate 顯式 `process.exit(2)`。17 unit + 12 e2e + 8 mutant(全被抓,含 3 條 caller-wiring exit(2) branch);catalog CTRL-SOP-003 / CTRL-CI-011 / CTRL-CI-013 追加 implementation;另 8 支同款 fail-open 移出成 P3 新條目(見下方「其他 8 支 script 同款 invoked-as-main 舊寫法」)
- **交付(③,無新 PR)**:PR #50 完成 lib + 3 支 owner-scoped caller、PR #51 完成其餘 8 支;抽 lib 之後 non-file URL 由 `detectInvocation` 內部 `try/catch fileURLToPath` 歸 indeterminate reason=`selfurl-not-file`(sprint 3 unit #7 已驗)、**頂層不再 throw**;caller 對 indeterminate 顯式 `process.exit(2)` 是 sprint 3 D3 拍板的 fail-closed 設計、非 bug。「模組頂層 throw 讓 caller 無法 graceful 處理」的 pending 具體症狀已消失、supervisor 2026-09-03 APPROVE 收條(路 A、拒絕 B1-B4 抽象、無實務 use case 要求改 API)
- **交付(⑤,PR #54)**:新 `scripts/lib` 無獨立檔——contract 在 `scripts/check-mutation-specs.ts` 內:`listSpecFiles` 改名 `discoverSpecFiles`(D7)+ 加 `walkSpecDir(absDir, relPrefix, io?)` 純函式(遞迴 + case-insensitive + walker I/O 邊界:readdir/lstat/stat throw + symlink dir + 異常型別全 fail-closed)+ `findCaseCollisions(paths)` 純函式(lowercased 完整 posix path 為 key,避免不同目錄同名誤判)。D1-D7 契約寫進 docstring / mutations/README.md / catalog CTRL-CI-013 三處 SSOT 一致。新 `scripts/mutations/mutation-spec-discovery.json` 8 條 mutant(D1/D2/D2b/D3/D4a/D4b/D5/D6 逐一對應契約);e2e ⑪-⑯(⑯ collision `it.skipIf(!caseSensitive)` 註冊期條件、探測 helper temp dir 建 finally 清、不污染 repo)+ 5 collision pure unit + 9 walker mock IO unit。禁區 mutate.ts checkTarget 定義未動、sprint 3-5 lib 未動。mutate 8/8 killed 綁 `9b1c7b286dae2bc0c0d11360cbcb8721adbb5ea5`。Step 5 defer(11 條 INFO 未修、conf ≤7):F2 conf 5(頂層 lstat/realpath 不走 WalkerIO)、F3 conf 6(空子目錄靜默、需 D8 新契約需拍板)、F4 conf 6(findCaseCollisions localeCompare vs 其他 default sort 不一致、非功能性)、F5 conf 4(collision message lowercased key 可讀性)、F7 conf 3(e2e ⑭ lex 順序脆弱度)、W3 conf 5(symlink dir 收入 recurse 等價 fail-open 額外 mutant)、W4 conf 3(realpath 失敗 unit 覆蓋);r3 conf 3(MSD-D5 mapping 掛在 D4、應歸「輸出排序」子條款 D1 附屬或 D4.5;純文件)
- **交付(⑦,PR #55)**:`scripts/mutations/mutation-spec-drift.json` 的 MSD-M1 / MSD-M5 兩條 find/replace/label 重設計(1 檔 6+/6-)。**校正舊登錄簡寫**(supervisor 明列 Step 5 交付段必修正):defer ⑤ Step 5 快速登錄的「TypeError→exit 2」實測是三種不同 kill 路徑:M1 mutant 讓 spec-level fail-closed 不 fire → 繼續執行 JSON.parse(self.original.toString()) → self.original 是 undefined → TypeError 被 catch → return status="drift" + "解析失敗:Cannot read..."、**exit 1**(非 exit 2);M5 mutant 讓 target-level fail 不 fire → applyMutation(target.original.toString()) 未被任何 catch → 純 TypeError 傳播;對本 repo 直接跑 M5 額外命中 self-reflection drift(M5 spec 的 find 是被 mutant 改的行本身)、exit 1。都非 label 宣稱的「不再判 untrusted/DRIFT → 走真實判定分支」路徑。**重設計**:MSD-M1 find 擴 3-line block(含整段 return untrusted)、replace 為 return status="ok" + problems=[](fail-open 繞 JSON.parse);MSD-M5 find 擴 4-line block(含 push+return)、replace 為 silently skip 的 return(fail-open 繞 push/applyMutation)。dry-run 蒐證:M1→unit「spec 檔本身未追蹤 → untrusted」拿 status="ok"、M5→unit「目標檔不存在 → drift」拿 status="ok"、皆非 exception/catch/self-reflection。mutate 6/6 killed 綁 `97e32c79926fa6ca601c60a9ab96ef081a45af58`。禁區守住(check-mutation-specs.ts / mutate.ts / 其他 lib / 其他 spec / CI / catalog / tests 全 0 line 動)。Step 5 defer(4 條 conf 3-4 全 skip):F1 M5 label vitest halt-first 措辭精準性、F2 M5 label「非 TypeError」歷史對照獨立讀不明所以、F3 M1 label 對 e2e ⑤/unit 覆蓋面略窄、F4 M1 label「繞開 JSON.parse」措辭易誤讀
- **交付(⑩,PR #56)**:`scripts/check-mutation-specs.ts` formatReport 加空 results preflight fail-closed 分支(code 2 + diagnostic「結果集為空——沒有任何 spec 檔被檢查(defense-in-depth 第二道)」、放函式最頂表達 preflight 意圖);檔頭 docstring D5 契約 + exit 2 契約段補述 defense-in-depth 第二道(三處 SSOT 一致:docstring / catalog / README);mutation-spec-drift.json MSD-M2 label 校正(killer = unit L82-90 `.ok===false + reason.toContain('沒有任何 spec 檔')` 直接斷言、不靠 exit code);加 MSD-M7 攻 formatReport 新分支(killer = direct unit `formatReport([]).code === 2` + `text.toContain('結果集為空')` 兩條斷言);catalog CTRL-CI-013 evidence/degradation + README 條目 6→7 對齊。**兩層 diagnostic 都含穩定子句「沒有任何 spec 檔」**讓 CLI e2e ④ stderr 斷言在兩層情境都通過、M2/M7 各自獨立 killer 不交叉污染。禁區守住(mutate.ts checkTarget / discoverSpecFiles / walker / checkSpecFile / runCheck / 其他 mutant / CI 骨架 全 0 line 動)。mutate 7/7 killed 綁 `9b53435a34d1f120a0d82a733ad64641853e2144`。Step 5 defer(0 條 skip;所有 findings 已修:F1/W1/W2 SSOT 三處合併補 + F2 preflight 位置移 + F3 M7 label 補述)
- **交付(⑧,PR #57)**:`scripts/control-catalog.json` CTRL-CI-013 `implementation` 陣列於 idx 2 插入 `"scripts/mutate.ts"`(位置介於 `"scripts/check-mutation-specs.ts"` 與 `"scripts/lib/invoked-as-main.ts"` 之間,對齊 CTRL-SOP-003 主 script → 依賴 lib 順序);`docs/CONTROL-CATALOG.md` catalog:render 產物同步(L50 CTRL-CI-013 表格列「實作」欄新增)。**Atomic implementation commit**(2 檔 +2/-1、tip `27bda60b49af2a5d3d21db7cb31a0e4e6e6e1f08`)——JSON + rendered md 同一 commit,避免中間 catalog.doc.drift fail。SSOT 修正:catalog locator/notes 已宣告倚賴 mutate.ts、implementation 補上 = catalog 內部 SSOT 一致(check-mutation-specs.ts:51 static import `applyMutation` / `checkTarget` / `parseSpecs` 三純函式全在關鍵路徑)。**OUT-of-scope 掃描**:mutate.ts 在 catalog 只出現 CTRL-SOP-003(已列)一處、scripts/ 內 static import mutate.ts 只有 check-mutation-specs.ts:51 一處,無其他 CTRL 同款遺漏。禁區守住(mutate.ts / check-mutation-specs.ts / CI / 其他 CTRL / 其他 defer / 其他 lib / MSD-M1-M7 定義 / testRefs / evidence / degradation / notes 全 0 line 動)。mutation-spec-drift 7/7 + mutation-spec-discovery 8/8 killed 綁 `27bda60`。Step 5 defer:0 條(Step 5 標準審 APPROVE 0 findings、標準車道 CSO_NOT_REQUIRED 不加 worktree 獨立審)
- **交付(⑥,PR #58)**:`scripts/mutate.ts` 加 `export type ReadTargetCheck = { ok: true; original: Buffer } | { ok: false; reason: string }`(discriminated union、刻意不含 dev/ino/mode/abs、TS 編譯期擋 writeCheckedSync 寫回);抽 private module-scope `openAndReadTracked` helper(六道 fail-closed 邊界 + O_NOFOLLOW + 同 fd fstat/read + gateAfterFstat callback);加 `export function readCheckedTarget`(純讀 caller 專用、docstring 頂端 🔴 警語);`checkTarget` 內部改呼叫 helper + 補 nlink=1 拒判(公開 signature + observable behavior 完全不變、gateAfterFstat callback 保住 hardlink 拒判優先於 UTF-8/read 錯誤的 diagnostic precedence);既有 doc comment 加句「readCheckedTarget 絕不可供寫回」。`check-mutation-specs.ts` L216/L229 兩處遷移為 readCheckedTarget、narrowing 簡化 `if (!self.ok)`。tests 加 7 unit + 1 TS 型別負對照 @ts-expect-error + 1 P2-1 regression(hardlinked 非 UTF-8 → checkTarget 仍回 hardlink 拒);check-mutation-specs.test.ts 加 e2e ⑰(hardlink spec + target → exit 0);mutation-spec-drift.json 加 MSD-M8(readCheckedTarget→checkTarget import alias 誤回退)+ MSD-M1/M5 find 對齊新 narrowing 語法。CTRL-CI-013 catalog locator/evidence/degradation/notes + check-mutation-specs.ts 檔頭 + mutations README 全同步兩種 nlink 契約(純讀 vs 破壞性)+ 錨式修法(不含行號、Step 5 fix)。mutate 8/8 + 8/8 killed 綁 `07ce311e751ea4fcef3debcd4998ac653c6e86f6`。禁區守住(writeCheckedSync nlink guard / mutate main CLI / mutate.ts 檔頭 prelude 全 0 line 動)。Step 5 defer(0 條:1 條 conf 3 docstring 短版 vs 錨式長版詳略級 skip)
- **交付(⑪,PR #59)**:D1 = OPT-A wontfix + documented --root contract(supervisor plan rev 1 拍板;evidence-first、5 fixture scenario 實測分類 exploitability 低)。三處 SSOT 全補述:`scripts/check-mutation-specs.ts` 檔頭 docstring Usage 段加 --root 契約 block(real git worktree top-level 為要求、nested outer-tracked 不支援屬使用者責任、真獨立 nested repo 邊界對得上、boundary-escape 由 isInsideRepo 擋、SSOT 三處指涉);`scripts/control-catalog.json` CTRL-CI-013 notes 補述 defer ⑪ 契約段;`docs/CONTROL-CATALOG.md` catalog:render 產物同步(25755→26029 bytes、atomic);`scripts/mutations/README.md` 「discovery 契約」+ 「CI 守樣本漂移」段補述。**Atomic documentation/SSOT commit**(4 檔 13+/2-、tip `aeef033907e63b87eceef0df2318180c788b9ef2`)。無 runtime code / test / spec 改動。禁區守住(checkTarget / readCheckedTarget / writeCheckedSync / mutate main CLI / discovery contract D1-D7 / MSD-M1-M8 / MSD-D1-D6 定義 全 0 line 動)。標準車道 CSO_NOT_REQUIRED。Step 5 defer:0 條
- **交付(⑬,PR #63)**:`tests/check-mutation-specs.test.ts` L72 移除 makeRepo fixture initial commit 的 `--allow-empty`(single argv token、+1/-1)。**Evidence-verified**:makeRepo(L53-74)files 永遠含 `src/guard.ts`(L57 default from opts.src ?? SRC);25+ 現有 makeRepo() call variants 全部至少 1 staged file、無 combo 需 empty commit;唯一 zero-stage combo `{ noDir: true, skipTrack: ['src/guard.ts'] }` **於現有 tests 未使用**、屬 YAGNI defensive 冗餘(掩蓋未來 caller misuse、commit fail 是明確反饋)。**驗證**:vitest 本檔 44 passed + 1 skipped、npm test 全 suite 1021 passed、check:mutation-specs / check:catalog 綠。禁區守住(scripts/check-mutation-specs.ts runtime / scripts/mutate.ts runtime/CLI 不使用 --allow-empty / 其他 test 檔 --allow-empty:check-todos-markers L371/451、delivery-refs L163、tests/mutate.test.ts L635-646 HEAD-drift 模擬、check-no-source-terms 多處 全 0 line 動)。標準車道 CSO 模板 repo 例外。Step 5 defer:0 條(adversarial-reviewer 9 項 check 全 clean、0 findings、特別驗證 zero-stage combo not invoked)。**教訓**:①YAGNI defensive 對 hypothetical combo 冗餘 → 移除更誠實(commit fail 反饋 > 靜默 empty);②evidence-verified 拍板(enumerate 全 calls + vitest 實測)勝於 hypothetical 恐懼;③scope literal + source-path precision(supervisor r1 修正讀不改段 tests/mutate.test.ts vs scripts/mutate.ts);④9 項 check 全 clean 於 single-token diff = 極窄 scope + evidence-first plan 的複合效果
- **決策(⑮,PR #___、無 code 交付、decision-record + SOP L423-425 coverage repair)**:defer ⑮「PR-number placeholder token 佔位靠 Step 6 補號(A3 defer ② 同形)」= 既有 SOP contract **對此機制有敘述(Step 5/6/7 三段)但 L423-425 command target list 在本 repo scope 有 gap 需修**。**注意**:此段唯一 live placeholder token 只在段首 header;段內所有其他 placeholder 逐字出現(引文 / 歷史敘述)一律用「PR-number placeholder token」或描述式表達,避 Step 6 placeholder fill-in scope error(Step 6 若 fill 範圍過寬會誤改非 live token)。**核實 SOP contract 三段(截 2026-09-05、`.claude/sop/plan-mode-checklist.md`)+ 本 sprint 修**:①**Step 5 L369-372**:「TODOS ✅ 條目必留 PR-number placeholder token(Step 6 開 PR 後補);`scripts/check-todos-markers.ts` 對『已完工但沒引用 PR』只回 advisory 不擋合併;留 placeholder 才讓 Step 6 有明確 stop condition」;②**Step 6 L420-438**:「PR 開了拿到 PR 號後、無條件 stop condition:只掃本 branch 新引入的 placeholder(不是整檔 grep);每個新增 placeholder 都補 commit 填本刀 PR 號 → push → CI 走該版」;**MARKER_SELF_PR** 允許 CI 驗自我引用、不擋 pre-merge 補 citation;③**Step 7 L457-464**:「TODOS ✅ + PR-number placeholder citation 已在 Step 5/6 隨 code PR squash;不重複;check-todos-markers CI gate 只 advisory、責任在 Step 6」。**Gap 發現**:SOP L423-425 現行 command 的 target list 只列 legacy `.claude/memory/*` 三檔;本 repo 實際 marker consumer = root `TODOS.md`(`scripts/check-todos-markers.ts` MARKER_DOCS 指向 root TODOS)、本 branch live placeholder 也在 root TODOS,現行 SOP command 對本 repo 是 no-hit、placeholder 靜默漏補。**本 sprint 修**:SOP L423-425 command target list **加 root `TODOS.md`**、**preserve legacy** `.claude/memory/*` paths 避 breaking downstream(single-line add、不改 wording 其他)。**Observed successful run(evidence、引用前 sprint、非新宣稱)**:defer ⑭ Phase 2 用 PR-number placeholder token 佔位 → Step 6 completed placeholder fill-in for pull request 編號 64 → CI run 33907437393 green → squash merged main HEAD `4bd0abc`。**具體 fill-in tool 不斷言**(F7 指出未證實、sed 非既有官方機制、實作 tool 由執行者選擇:手動 Edit / sed / 其他)。**D9 anti-overclaim**(5 點明列(4 anti-overclaim + 1 acknowledgment)):①**不宣稱** CI 已機器化補號(`check-todos-markers.ts` gate 只回 advisory、不擋合併是已知契約邊界、supervisor lock 不改);②**不宣稱** 補號流程已 automation(仍靠 SOP 紀律驅動 + 執行者手動 tool 選擇);③**不宣稱** permanent guarantee(SOP Step 7 明列「Step 6 忘補則 Step 7 手動 + 記 LESSONS」exception);④**不宣稱** 未來 sprint 一定不出漏補;⑤**額外**:承認 r1-r3 plan 誤判「既有 SOP contract 已完整覆蓋」;r4-r6 校準:contract 有敘述 + L423-425 target list 有 gap 已修。**scope literal**:SOP L423-425 target list 加 root TODOS(preserve legacy)+ TODOS decision closure atomic;**不加** code / CI(不改 ci.yml)/ hook / staging automation / check-todos contract。**禁區守住**:runtime scripts(含 `scripts/check-todos-markers.ts` CI advisory 邊界)/ tests / CI / catalog / mutation specs / hook / staging 全 0 line 動。**Phase 1 atomic 2 檔**:`.claude/sop/plan-mode-checklist.md` L423-425 single-line target list add + `TODOS.md` 三處(header 精確閉合集合表述、⑮ strikethrough + 描述式、此決策段)。標準車道 CSO 模板 repo 例外(路徑表為空 = 設計、人工判定 = SOP wording repair + decision closure、無 auth/authorization/payment/PII/audit or production logic 邊界)。
- **交付(⑭,PR #64)**:`scripts/check-mutation-specs.ts` L246-253 catch 內加 BOM detect(`self.original.length >= 3` + 前 3 bytes = `0xef/0xbb/0xbf`)+ hint 三元(命中 BOM → 「JSON 不允許 UTF-8 BOM(檔首 3 bytes 為 EF BB BF)——請用無 BOM UTF-8 存檔」/ fallback → 「解析失敗:${e.message}」),drift 分類與 exit code 語意不變(status='drift'、code=1)。`tests/check-mutation-specs.test.ts` 加 2 新測試:1 unit checkSpecFile BOM fixture 鎖 status='drift' + `problems[0]` 含「UTF-8 BOM」、1 CLI e2e case ③.5 BOM 鎖 code=1 + stderr 含「UTF-8 BOM」;既有非 BOM JSON 壞測試(L272 unit + L349 e2e)fallback wording 完全不動、regression 全過(D4c contract)。`scripts/mutations/mutation-spec-drift.json` MSD-M6 find/replace 對齊修後 catch return 逐字(**label 不變、replace intent `status: "drift"` → `status: "untrusted"` 不變**、semantic lock、kill mechanism 由 e2e ③ code=1 vs mutant code=2 + unit L272 status='drift' vs mutant 'untrusted' 兩處捕捉、supervisor r4 D1.1 semantic lock)。**Atomic 3 檔 commit**(24+/3-、tip `23f2c0c78f7d6184fca743cf6eec5a79c2ce47d7`)。**Precise contract**:BOM spec → readCheckedTarget pass(BOM = valid UTF-8、pass isUtf8Text)→ JSON.parse catch → hasBom 命中 → hint 拼進 problems → formatReport code=1 → CLI console.error → BOM hint 在 stderr。**驗證**:vitest 本檔 46 passed + 1 skipped(pre 44 + 2 新)、npm test 全 suite 1023 passed(比 base 多 2)、check:mutation-specs 12 spec 130 條探針(MSD-M6 find 對齊、樣本繼續匹配)、check:catalog CATALOG_OK 32 controls;pre-flight hex-verified U+FEFF 編碼寫入 test fixture。禁區守住(scripts/mutate.ts runtime/CLI / trust boundary isUtf8Text/readCheckedTarget/openAndReadTracked / SpecFileStatus enum / exit-code 語意 / catalog / 其他 mutation entry / 其他 e2e cases 全 0 line 動)。標準車道 CSO 模板 repo 例外(supervisor r4 明列 with mutation-spec maintenance file 保留)。Step 5 defer:0 條(adversarial-reviewer 10 項 check 全 clean、0 findings)。**教訓**:①drift generic summary + text 含 U+FEFF 未明列 BOM 是 diagnostic granularity 缺口非分類錯誤、只補 hint 不動 status/code/enum;②BOM = valid UTF-8(EF BB BF pass isUtf8Text)、走 JSON.parse catch 而非 untrusted;detect 用 buffer bytes literal 判、length-guard `>= 3` 前置避 OOB;③MSD-M6 semantic lock = co-evolve mutation-spec pin 的關鍵 pattern(label 不變、replace intent 不變、find/replace 對齊修後行逐字、mutation kill 機制由既有 e2e ③ + unit L272 兩處捕捉);④adversarial 10 項 check 全 clean + hex-verified test source 是極窄 scope + evidence 端到端 + pre-flight uniqueness 的複合效果
- **交付(⑫,PR #62)**:`tests/check-mutation-specs.test.ts` case ⑤ 斷言穩定化——unique marker(EVIL_LABEL/EVIL_SENTINEL inline scope 常量、pre-flight grep 唯一性 0-hit)+ 必然 drift 策略:evil.json 從 GOOD_SPEC(合法且對得上)換 EVIL_SPEC(find 用 src/guard.ts 內不存在的 sentinel、shape 合法但 acceptance 路徑必印 label)。斷言刪脆弱 `not.toContain('對得上')`、新加 `r.err.not.toContain(EVIL_LABEL)`(主通道 stderr、CLI code=1 走 console.error)+ `r.out.not.toContain(EVIL_LABEL)`(defensive no-leak 雙通道)。**Precise contract**:防線回歸 → checkSpecFile → applyMutation 找不到 EVIL_SENTINEL → problems.push 含 label(check-mutation-specs.ts:257)→ formatReport code=1 → CLI stderr → 主斷言抓;defensive assertion hedges future stdout redirect / log-path change。1 檔 +12/-3(tests/check-mutation-specs.test.ts case ⑤ L348-370、inline scope、無 module-level 污染、其他 case 全 0 動、makeRepo helper 不動)。禁區守住(runtime / CI / catalog / mutation specs / production script / 其他 e2e cases 全 0 line 動)。標準車道 CSO 模板 repo 例外。Step 5 defer:0 條(adversarial-reviewer 12 項 check 全 clean、0 findings)。**教訓**:①間接證明缺席 assertion 依賴 fixture 具體形狀、直接證明 = unique marker + 必然 drift + acceptance 路徑必印 marker 的 contract;②必然 drift 是 marker 可觀測性關鍵(若合法且對得上、formatReport 對 ok 只印 rel/探針數不印 label、marker 斷言 false negative);③主 stderr + 雙通道 defensive 精確對齊 CLI code=1 行為 + hedges 未來路徑改變
- **交付(⑨,PR #61)**:`scripts/mutations/README.md` L111(check-mutation-specs.ts 的 exit-code section「## CI 守樣本漂移」內)+ `scripts/control-catalog.json` CTRL-CI-013 `degradation` 欄兩處 SSOT 補「root 解析失敗(fs.realpathSync throw)/ argv 錯(parseRootArg fail-closed)」加進 exit 2 條件、「未預期例外」拉出 exit 2 clause 獨立陳述「main try/catch 印訊息但不重設 exit code(保留當前 code:runCheck 前拋 = initial 2、runCheck 回傳並賦值後拋 = 該次 report code(0/1/2))」;`docs/CONTROL-CATALOG.md` catalog:render 產物同步。**Atomic docs/SSOT commit**(3 檔 4+/-4 → Step 5 round 1/2/3 fix 覆蓋 → 累積 3 檔 3+/-3;final tip `54e52bd`)。無 runtime / test / spec 改動。禁區守住(scripts/check-mutation-specs.ts 為 ground truth source、supervisor scope 排除;catalog schema / 其他 controls / evidence 欄 / notes 欄 全 0 line 動)。標準車道 CSO fail-closed 模板 repo 例外。Step 5 defer(1 條 conf 7 skip:F2 evidence/degradation 欄不對稱、依「degradation only」scope boundary defer;F1 CRITICAL 修 + F3 supervisor 覆判必修 round 2/3 修)。**教訓**:①L53 mutate.ts 與 L111 check-mutation-specs.ts 是兩個 script 的獨立 exit-code section、修對地方才是 SSOT accuracy;②「保 code=2」需精確描述保留當前 code、conf 5 skip 判斷不能取代 supervisor SSOT accuracy 拍板(F3 覆判必修);③generic clause 選擇 vs enumerate 對齊 pattern 密度、避免 wording coupling(選 A 避 parseRootArg 擴展)
- **刻意保留(④,PR #60)**:本地 git clone file:// fixture 兩例實測——`tests/check-baseline-governance.e2e.test.ts` case 16 fixture path 含 `#` 一例 clone exit 0、path 含 literal space 一例 clone exit 0;pathToFileURL 產出的 encoded URL 對同兩例亦 exit 0 clone、與 raw URL 無可觀察差異。**兩例範圍內** pathToFileURL swap 對 git clone 無 regression evidence、屬 cosmetic swap 不接受;**不宣稱** general git URL semantics / URL parser implementation / 對其他 URL-significant chars 之通用行為
- **方向(其餘)**:⑨ 0.5h;其餘逐條 0.5h
- **工時**:剩下條目合計 3–5h

### ✅ 其他 8 支 script 同款 invoked-as-main 舊寫法(遷移到 `scripts/lib/invoked-as-main.ts`)(PR #51)
- **來源**:2026-09-03 PR P2#3 defer ①② 交付 sprint 中,repo-wide grep 發現 owner-scoped 3 支以外仍有 8 支 script 用舊 isMain 寫法(A/B 兩派)、經 symlink 目錄呼叫可能靜默 exit 0
- **內容**(原未修 8 支;分數關係:PR #50 owner-scoped 3 / 本 sprint 遷 8 / 總計 11,含已修 1):
  - A 派(fileURLToPath 直比 path.resolve,無 realpath):
    - `scripts/check-doc-size.ts:143-145`
    - `scripts/check-bookkeeping-commit.ts:185-186`
    - `scripts/check-no-source-terms.ts:1905-1907`(變數名 `isDirect`)
  - B 派(pathToFileURL(argv1).href 比 import.meta.url,無 realpath):
    - `scripts/check-cso-trigger.ts:216 附近`
    - `scripts/check-adoption-readiness.ts:722`
    - `scripts/check-doc-refs.ts:407`
    - `scripts/check-baseline-governance.ts:232`
    - `scripts/render-control-catalog.ts:162`(⚠️ **是 `npm run catalog:render` 的 CLI 入口**;遷移時同時要對 `tests/fixtures/invoked-as-main-wrapper/check-control-catalog-wrapper.mjs` 改 2-step dynamic import,因為 check-control-catalog.ts 頂層 static import render-control-catalog、遷移後會撞 chain 問題,類似 check-mutation-specs → mutate 的處理)
- **方向**:每支 script 各 ~10 分鐘遷移(import lib + 換 caller pattern + 加 caller 顯式 exit 2 branch);對應 e2e 若既有可覆蓋、就 rely;若無、加 minimal wrapper e2e。catalog 依 D7 grep 規則決定 implementation 是否追加 lib
- **工時**:遷移 1–2h;e2e 補完 0.5–1h
- **交付(PR #51)**:8 支全遷完,每支 1 commit(A 派 3、B 派 5);check-baseline-governance 用 3-step wrapper 化解 static-import chain(→ check-bookkeeping-commit + check-no-source-terms);check-control-catalog-wrapper 從 sprint 3 的 defensive 註解升級為真 2-step(render-control-catalog 遷完 chain 假設成真);新 `invoked-as-main-migration.json` 8 條 caller-wiring mutant 全被抓;catalog 6 個 control(CTRL-CI-005/006/007/009/012 + CTRL-SOP-007)追加 lib 到 implementation(D7 evidence)。32 新 e2e case(8 支 × 4 場景)全綠。**P2#3 defer ③(fileURLToPath 非-file URL 頂層 throw、caller 無法 graceful 處理)當時不在本 sprint scope 內、pending;後由 2026-09-03 路 A 收條結案(見上方 defer ③ 交付段)**

### 🟢 A3 Step 5 defer 集合(control catalog / baseline governance 邊角,20 條 INFORMATIONAL conf ≤7;⑩ 已交付)
- **來源**:2026-09-03 PR A3 Step 5 worktree 審 r1–r5;0 CRITICAL 未修
- **內容**:①模板自身 ci.yml 三處 `if:` 行含 develop、對 template config(deliveryBranches main)不合,A5.ci.if 只在 adopted 跑(conf 6);②`PR #___` 佔位 TODOS Markers Check 不抓,靠 Step 6 補(conf 6);③`repoFilePathViolation` 放行 `|` 與反引號(conf 4);④單一 `mergeStrategy` 表達不了雙階段策略(conf 3);⑤template 遺產舊值解不開視為首次設定,把全史掃描縮成 cutover(刻意,Owner PR 授權)(conf 4);⑥tab 縮排讓 keyIndent 撞更深 `name:`(YAML 禁止 tab)(conf 3);⑦同 item 兩個直屬 `name:` 後者覆蓋(parser 會拒)(conf 3);⑧`steps: [{…}]` 非空 flow sequence 不算區塊(假紅)(conf 3);⑨回灌 PR(main → develop)SKIPPED 訊息措辭反向(conf 2);~~⑩`protectedBranches` 集合擴大無任何 gate 警示,promotion 豁免健全性依賴人審 + branch protection(GOV-005 advisory)(conf 6)~~;⑪steps 混合縮排(不合法 YAML)靜默漏抓(conf 4);⑫引號跳脫其餘形狀(`\\`、`\t`、`"x" # c "d"`)fail-closed 假紅(conf 5);⑬舊值 null 時 OK 行寫「見 info」但無 info(conf 7);⑭`config.head.invalid` / `config.base.invalid` 兩條 UNDETERMINED 丟掉 infoLines(conf 6);⑮UNCHANGED + info 與 `directionChecked` 文字無測試斷言(conf 5);⑯–㉑r1 其餘:`--root` dynamic import 已在檔頭標明、mutate spec 每個突變跑全套 vitest 超 10 分鐘(建議 `--cmd` 縮到相關測試檔或拆 spec)、`mutate.ts` 被 SIGTERM 砍不還原(已在 P3 defer 集合)、CTRL-CI-009 notes 限制 1 敘述、check:catalog 錯誤訊息對 `steps: # 註解` 已修、E-self 在本 repo 合法推進 baseline 後跳過(已實作)
- **交付(⑩,PR #53)**:新 `scripts/check-protectedbranches-drift.ts` + `scripts/lib/protectedbranches-drift.ts` + CI step「Protected Branches Drift Check」+ CTRL-CI-014(hard-automated);對 PR 內 protectedBranches 集合**擴大**(added > 0)fail-closed exit 2、**無 PR-controlled marker/opt-out**。trust-boundary:讀 merge-base 那側 config bytes(git show <mb>:...),用 immutable `github.event.pull_request.base.sha` 作 --base(rev5 P1-A);CI step `if:` 唯一允許 `pull_request` 事件(rev5 P1-B、無 branch filter)。10 unit + 10 e2e + 7 mutant(全被抓、含 trust-boundary M2、CI-condition M3、diff 對稱 M7)+ YAML structural test 對 CI step if/run 逐字鎖(tests/ci-step-conditions.test.ts,DP-M3 killer)。CTRL-GOV-005 branch-protection advisory **保留、非升級**;合法擴大 escape hatch = Owner/admin 組織治理層 override + full revert(rev5 P1-1 rollback)。
- **方向(其餘)**:~~⑩ 是唯一結構性項目——在 `check:adoption` 或獨立 gate 對「`protectedBranches` 集合相對 merge-base 擴大」印 warn 並要求 PR 描述說明(Milestone C governance verification 一併看)~~(已交付 CTRL-CI-014 strict exit 2、無 marker/warn;見上方交付段);⑬⑭⑮ 一起收(0.5h);其餘逐條 0.5h
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
