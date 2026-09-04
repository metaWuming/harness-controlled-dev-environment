---
title: 開發進度
type: note
---

# 開發進度(progress.md)

> 每個 sprint 收尾時在本檔**最上方**加一條 entry(倒序,最新在上)。
> 這是專案的權威進度紀錄:接手的 session 先讀最上面 1-2 條 entry 就知道「上一棒做了什麼、
> 下一棒候選是什麼」。
>
> ⚠️ **entry 裡的「下一棒候選」是 hint 非 truth**——接手 session 起手一律 git 核實
> (marker 可能腐爛:寫「待完成」的事可能早已完成)。
>
> 檔案過長時照 `progress-archive/README.md` 慣例歸檔舊 entry。

---

## Entry 格式範本

> ⚠️ **這是 completed-sprint 的 pre-merge schema**(2026-08-21 改):entry 在
> SOP Step 5 收乾後寫、進 feature branch 最後一個 commit、跟 code 進同一 PR 一起 squash。
> **排除 post-merge 才可知的欄位**(PR 號 / squash SHA / CI 狀態 / merge 狀態)——
> 這些 git log / GitHub PR page 自帶,progress 不重複記、也不會過時。
> 要驗證某 sprint 是否已合到 delivery branch:先 `git fetch origin`,再對 progress.md
> 這個檔在遠端 delivery branch 的檔案歷史裡查 entry 內容,不要靠 branch tip 或 commit
> subject。用 `CLAUDE.md` §4.6 Git 規範 內填寫的 delivery branch(專案可設定,例如
> `main` / `develop` / 其他;placeholder 未填時 fallback:
> `git symbolic-ref refs/remotes/origin/HEAD` 拿 default branch),跑
> `git log -S '<完整且唯一的 entry heading(含日期、ⓝ、標題)>' origin/<delivery-branch> -- .claude/memory/progress.md`
> ——`-S` 對「內容變化」查、找到就代表這條 entry 已進遠端主線;找不到就是沒進。
> 或去 GitHub PR page 直接看 merge status。**不要用 `--grep` 查 commit subject**
> ——squash commit subject 不必然重複 entry 標題;**也不要用 branch tip 或 `-1`**
> ——只顯示最後一支、無法對應這一個特定 sprint;**local delivery branch 可能 stale**
> ——一定要用 `origin/` 遠端 ref。
> (舊 schema 在 title 塞 `→ PR #N squash 進主線 SHA`,結果 Step 5 寫時全是 pending;
>  改成 Step 7 回寫又動不了 protected delivery branch → 每 sprint 收尾多 1 支 PR
>  + 1 輪 CI 純浪費)

> ### ⚠️ 未完成 sprint 的 checkpoint 走另一條 flow
>
> 上面的 schema 是**完整 sprint 收尾**用的。
> **未完成 sprint** 的情境(工作暫停 / 被阻於外部 / context 快被壓縮前寫交棒):
> 走 `.claude/sop/context-management.md` 的 checkpoint / take5 flow——寫 partial
> entry 保留當下狀態、給下一棒接手。partial entry **不必**滿足上面的 pre-merge schema
> (它本來就是未完成、如果 sprint 中斷不再繼續就永遠不會 squash 進主線),但要明確
> 標示「⚠️ partial / paused」讓下一棒知道這不是完整交付。
>
> 🔴 **partial entry 的生命終結——sprint 若恢復並在同 feature branch 走到 Step 5:
> 必須把既有 partial entry 更新/替換為 completed schema、不能 append 第二份**。
> 否則同 feature branch 的 squash 會含**兩份 entry**(stale partial + completed)、
> 一起進 delivery branch,違反「partial 不進主線」宣稱。做法:Step 5 開始寫時,
> 先 `grep -nE '⚠️ (partial|paused)' .claude/memory/progress.md` 找該 sprint 的既有
> partial entry,把它就地擴寫成 completed schema、不是在最上方另加新 entry。

```markdown
📅 YYYY-MM-DD ⓝ — **一句話標題**

> **緣起**:為何做這件事(觸發來源:Owner 指示 / TODOS 項 / 上一棒 follow-up)。
> 起手 git 核實了什麼、推翻了哪些過時 hint。
> **改動**:N 檔,每檔一句話(新增了什麼 / 改了什麼 / 為什麼)。
> **審查**:跨模型 review N 輪(每輪 findings 摘要 + 收斂結果);安全關觸發與否及結論;
> 第二道 review 結果。
> **驗證**:typecheck / lint / test 數字(N 檔 / N passed)、build 通過。
> (CI 狀態去 GitHub PR page 看、不在此重複——本 entry 是 pre-merge 寫的)
> **⭐ 教訓**:①② 編號列出(可 cross-reference LESSONS.md)。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):候選 A / 候選 B。卡外部的事項單獨標出。
> **check:claims 逐條處置**:命中 N 處,留 A X 條 / 降級 B Y 條(同時貼進 PR 描述)。
> 📊 成本:CC ~Xh / 跨模型 review N rounds / P1 X 個 / P2 X 個 / Step5 獨立發現 X 個
> 📐 量測(供 `docs/EFFORT.md` 的 sweep;目前**人工填、人工讀**):
>    每輪 model＋API effort / baseline SHA / 來源分佈(既有缺陷 X・漏改 consumer X・baseline 後引入 X)
```

---

<!-- entry 從這裡開始,新的在最上面 -->

📅 2026-09-05 ④ — **P2#3 defer ⑭:mutation spec 帶 UTF-8 BOM 診斷 hint 精確化(明列 BOM 因、drift 分類與 exit code 語意不變、MSD-M6 semantic lock)**

> **緣起**:TODOS `TODOS.md` L80 P2#3 Step 5 defer 集合 ⑭(conf 5):「spec 帶 UTF-8 BOM 診斷訊息差、text 含 U+FEFF 但未明列 BOM」。Owner sprint-loop continuous 授權下,Codex supervisor(defer ⑬ 交付 pull request 編號 63 merged squash 後)拍板本 sprint 單條、標準車道;frozen full base `233858fa357ba0189990545b79f76734075407c7`(origin/main tip = defer ⑬ 交付 pull request 編號 63 squash);plan 4 rev(r1 D1 3 檔 atomic;r2 D1.1 MSD-M6 semantic lock 明列 label/replace intent 不變;r3 D2 hint wording 精確化;r4 mutation-spec maintenance file 屬標準車道明列 + APPROVE + GO Step 3)。**Ground truth trace(evidence-measured、pre-flight)**:`scripts/check-mutation-specs.ts:246-248` catch:BOM spec 走 readCheckedTarget(isUtf8Text pass、buffer 含 EF BB BF 傳回)→ JSON.parse 拋 → catch return `status: "drift"` + `problems: [\`spec 檔 ${rel} 解析失敗:${e.message}\`]`;現況 stderr 含 U+FEFF 字元但**未明列「BOM」**、drift generic summary 掩蓋 root cause。
> **改動**:**3 檔 atomic(scope literal supervisor r4)**:(a) scripts/check-mutation-specs.ts L246-253 catch 內加 `hasBom` detect(length >= 3 && bytes 0/1/2 = 0xef/0xbb/0xbf)+ hint 三元(BOM/fallback);(b) tests/check-mutation-specs.test.ts 加 2 新測試(1 unit checkSpecFile BOM fixture 鎖 status='drift' + hint 含「UTF-8 BOM」、1 CLI e2e case ③.5 BOM 鎖 code=1 + stderr 含 hint);(c) scripts/mutations/mutation-spec-drift.json MSD-M6 find/replace 對齊修後 catch return 逐字(label 不變、replace intent `status: "drift"` → `status: "untrusted"` 不變、kill mechanism 由 e2e ③ code=1 vs mutant code=2 + unit L272 status='drift' vs mutant 'untrusted' 兩處捕捉、semantic lock);drift 分類與 exit code 語意 lock、trust boundary 全不動、SpecFileStatus enum 全 3 值不動、scripts/mutate.ts 全 0 line 動、CI/catalog/其他 mutation entry/其他 e2e cases 全 0 line 動。**Phase 1(`23f2c0c`)**:3 檔 24+/3- atomic。**Precise contract**:若 BOM spec 進 checkSpecFile → readCheckedTarget pass(BOM = valid UTF-8) → JSON.parse catch → hasBom detect 命中 → hint = 「JSON 不允許 UTF-8 BOM(檔首 3 bytes 為 EF BB BF)——請用無 BOM UTF-8 存檔」→ problems.push(含 hint)→ formatReport 回 code=1 → CLI main 走 `console.error(report.text)` → BOM hint 在 stderr、CLI e2e 主斷言抓;非 BOM JSON syntax error 走 fallback「解析失敗:${e.message}」與既有 wording 完全一致、既有 L272 unit + L349 e2e 「toContain('解析失敗')」regression 全過。**禁區守住**:scripts/mutate.ts runtime/CLI / trust boundary(isUtf8Text/readCheckedTarget/openAndReadTracked)/ SpecFileStatus enum / exit-code 語意 / catalog / 其他 mutation entry / 其他 e2e cases 全 0 line 動;shared main read-only(CLAUDE.md M 保留、不 carry / 不 inspect);3 支老 stash / `.claude/worktrees/agent-*` / feature/sync-check-claims 不動。
> **驗證(`23f2c0c78f7d6184fca743cf6eec5a79c2ce47d7` 實測、isolated scratchpad worktree wt-defer-14-bom 隔離跑)**:typecheck / lint 綠;`npx vitest run tests/check-mutation-specs.test.ts` **46 passed + 1 skipped**(pre 44 + 2 新 BOM tests);`npm test` 全 suite **30 files / 1023 passed + 3 skipped**(比 base 多 2 = 2 新 BOM tests、其他 test 不受影響);`npm run check:mutation-specs` **12 spec 130 條探針樣本都對得上**(MSD-M6 find 對齊修後 catch return line、mutation-spec-drift.json 樣本繼續匹配);`npm run check:catalog` CATALOG_OK 32 controls;目視 3 檔 diff、無 CLAUDE.md 誤 add。
> **審查**:Codex plan review 4 rev(r1 D1 3 檔 atomic + MSD-M6 需 co-evolve;r2 D1.1 semantic lock 明列 label 不變、replace intent 不變、new find/new replace 逐字對齊;r3 D2 hint wording 「JSON 不允許 UTF-8 BOM(檔首 3 bytes 為 EF BB BF)」精確化;r4 mutation-spec maintenance file 屬標準車道明列 + APPROVE + GO Step 3);Codex Step 4 commit-object 對 Phase 1 tip `23f2c0c` **APPROVE**(isolated clean clone、frozen full base/tip、ancestry + diff scope 一次通過、3 檔 atomic、MSD-M6 semantic lock verified、check:mutation-specs 綠 evidence);Step 5 adversarial-reviewer round 1 **0 CRITICAL、0 INFORMATIONAL、無 finding**(10 項 adversarial check 全 clean:BOM detect guard 短路 + 無 OOB、hint wording 精確、MSD-M6 find uniqueness = 1 hit L253、MSD-M6 semantic identity 由 e2e ③ + unit L272 兩處 kill、非 BOM backward compat fallback wording 對齊、test source U+FEFF 編碼 hex-verified、stderr routing code=1 → console.error、test label 唯一無 collision、無 scope creep、length-guard < 3 bytes 短路 verified);Step 5 直接收乾。標準車道 CSO fail-closed REQUIRED = 模板 repo 例外(路徑表為空 = 設計、人工判定 = 診斷 hint 精確化 + mutation-spec maintenance file、no auth / authorization / payment / PII / audit or production logic、supervisor r4 明列 with mutation-spec maintenance file 保留)。
> **⭐ 教訓**:①**「drift generic summary」+「text 含 U+FEFF 但未明列 BOM」是 diagnostic granularity 缺口、不是分類錯誤**——status enum = ok/drift/untrusted、drift 涵蓋所有非 untrusted 的 spec 檔問題(包含 JSON.parse fail);evidence 量測時要區分「分類是否錯誤」(不是、不動)vs「problem text 是否指出 root cause」(未指出、要補)。修法只在 catch 內補 hint、不動 status/code/enum。②**BOM 是 valid UTF-8(U+FEFF encoded as EF BB BF、pass isUtf8Text)**——所以走 JSON.parse catch 而非 untrusted 分支;detect 用 buffer 前 3 bytes literal 判 `0xef/0xbb/0xbf`、不用 chars 判(避字元編碼歧義);length-guard `>= 3` 前置避 OOB。③**MSD-M6 semantic lock 是 co-evolve mutation-spec pin 的關鍵 pattern**——modifier line 逐字 pin 的 spec entry,catch return line 改一字都會斷 pin;plan lock 「label 不變、replace intent 不變、find/replace 對齊修後行逐字」,mutation kill 機制由 e2e ③(code=1 vs mutant code=2)+ unit L272(status='drift' vs mutant 'untrusted')兩處捕捉,semantic identity 保。stop-and-report → supervisor 選 co-evolve semantic lock、不用 abandon MSD-M6 或退回 non-atomic 拆 commit。④**adversarial-reviewer 10 項 check 全 clean 且 hex-verified test source** = 用 xxd 對 test 檔案內 bomSpec 前 3 bytes 直接看 EF BB BF、確認 U+FEFF 字元真的寫入 fixture、chain 端到端。極窄 scope + evidence 端到端 + pre-flight uniqueness 是 0 finding 三要素。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):A. P2#3 defer 剩 1 條(⑮ conf 5、集合最後);B. A3 defer 剩 19 條;C. A2 defer 集合 17 條 INFO;D. P2#2 defer 集合 剩 7 條;E. A1.1 defer 集合 23 條;F. Milestone B1。
> **check:claims 逐條處置**:0 新命中(本 sprint 純 diagnostic hint 精確化 + test 補、無新絕對化宣稱句加入 lib docstring / docs 主張)。
> 📊 成本:CC ~2.5h / 跨模型 review 6 rounds(plan r1/r2/r3/r4 supervisor + Step 4 supervisor + Step 5 adversarial round 1 0 findings)/ P1 0 個 / P2 0 個 / Step5 獨立發現 0 個(0 CRITICAL / 0 INFORMATIONAL)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、極窄 sprint 單 catch 分支 diagnostic hint + MSD-M6 co-evolve);Codex gpt-5.6-terra medium(w6:p4)plan 4 rev + Step 4 + Step 5 approve;baseline `233858fa357ba0189990545b79f76734075407c7`;來源分佈:既有缺陷 1(現行 BOM spec catch fallback wording 未明列 BOM、defer ⑭ 條目登錄時已為既有缺陷)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan 4 rev + evidence 量測 BOM 現況 status/code/text / 2 ✅ Codex r4 APPROVE / 3 ✅ isolated worktree(wt-defer-14-bom)+ Phase 1 atomic 3 檔 commit(`23f2c0c`、24+/3-)/ 4 ✅ Codex Step 4 對 `23f2c0c` APPROVE / 4.5 ✅ CSO fail-closed = 模板 repo 例外(路徑表為空 = 設計、人工判定 = 診斷 hint 精確化 + mutation-spec maintenance file、no auth / authorization / payment / PII / audit or production logic、標準車道 supervisor r4 明列)/ 4.6 ✅ 未觸發(無 UI diff)/ 5 ✅ adversarial-reviewer round 1(0 CRITICAL、0 INFORMATIONAL、0 findings、10 項 check 全 clean)/ Phase 2 archive ⑫ + 加 ⑭ + TODOS ⑭ ✅ + entry-count conservation ✅(pre 20 + 新增 ⑭ = post 21、每 entry 恰 1 次)/ 6-7 待執行(Owner sprint-loop 授權)

📅 2026-09-05 ③ — **P2#3 defer ⑬:makeRepo fixture initial commit 移除多餘 `--allow-empty`(evidence-verified、25+ calls 皆有 staged file)**

> **緣起**:TODOS `TODOS.md` L80 P2#3 Step 5 defer 集合 ⑬(conf 5):「`--allow-empty` 多餘」。Owner sprint-loop continuous 授權下,Codex supervisor 拍板本 sprint 單條、標準車道;frozen full base `63ab9b09b4e3b2a214238721eb3e7fd498172c03`(origin/main tip = defer ⑫ PR #62 merged squash);plan 2 rev(r1 讀不改 source-path 誤指 scripts/mutate.ts 為使用 --allow-empty / r2 修正為 tests/mutate.test.ts L635-646 HEAD-drift test fixture command、明列 scripts/mutate.ts runtime 不使用此 flag;r2 APPROVE + GO Step 3)。
> **改動**:**1 檔 tests/check-mutation-specs.test.ts:72(+1/-1)**;無 runtime / CI / catalog / mutation specs / production script / 其他 test 檔動;single argv token 移除:`git('commit', '-q', '-m', 'fixture', '--allow-empty')` → `git('commit', '-q', '-m', 'fixture')`。**Evidence gathered pre-plan**:makeRepo 定義(tests/check-mutation-specs.test.ts:53-74)files 永遠含 src/guard.ts(L57 default from opts.src ?? SRC);25+ 現有 makeRepo() call variants(default 8+ / noDir 2 / skipTrack ['src/guard.ts'] 1 / skipTrack [SPEC_DIR+'/guard.json'] 2 / src+specs 多)全部至少 1 staged file、無 combo 需 empty commit;combo `{ noDir: true, skipTrack: ['src/guard.ts'] }` 於現有 tests 未使用、屬 YAGNI 冗餘 defensive、掩蓋未來 caller misuse。**禁區守住**:scripts/check-mutation-specs.ts runtime / scripts/mutate.ts runtime/CLI(不使用 --allow-empty)/ 其他 test 檔的 --allow-empty(check-todos-markers L371/451、delivery-refs L163、tests/mutate.test.ts L635-646 HEAD-drift 模擬、check-no-source-terms 多處)全 0 line 動;CI / catalog / mutation specs / 其他 e2e cases / makeRepo 其他部分全 0 動。
> **驗證(`b2e7d5ba73f1a198a85773d16a42cb2ae7900a5a` 實測、isolated scratchpad worktree wt-defer-13-allow-empty 隔離跑)**:typecheck / lint 綠;`npx vitest run tests/check-mutation-specs.test.ts` **44 passed + 1 skipped**(所有 makeRepo call initial commit 仍成功、無「nothing to commit」);`npm test` 全 suite **30 files / 1021 passed + 3 skipped**;check:mutation-specs 12 spec 130 條探針樣本都對得上;check:catalog CATALOG_OK 32 controls;git diff --stat 目視 1 檔 +1/-1。
> **審查**:Codex plan review 2 rev(r1 讀不改 source-path 誤指、r2 精確修正;r2 APPROVE);Codex Step 4 commit-object 對 Phase 1 tip `b2e7d5b` APPROVE(獨立 clean clone、frozen full base/tip、僅既定單 token diff、ancestor 正確、makeRepo staged-file gate 支持不需 empty initial commit);Step 5 adversarial-reviewer round 1 **0 CRITICAL、0 INFORMATIONAL、無 finding**(9 項 adversarial check 全 clean:zero-staged combo none / skipTrack coalesce / noDir + skipTrack['src/guard.ts'] not invoked / Object.keys files 穩定 / post-commit 無依賴 empty semantics / scope leak 1 token / vitest pass 合法 / doc/comment 無 lie / made[] cleanup 內容不相關)。標準車道 CSO fail-closed REQUIRED = 模板 repo 例外(路徑表為空 = 設計);未加 worktree 獨立審。
> **⭐ 教訓**:①**YAGNI defensive 對 hypothetical combo 冗餘 → 移除更誠實**——`--allow-empty` 是 hypothetical 「若未來 caller 傳 `{ noDir: true, skipTrack: ['src/guard.ts'] }` 就 zero-stage」的 defensive 兜底;但現有 25+ makeRepo() calls 無此 combo、defensive 只掩蓋未來 caller misuse(commit fail 才是明確反饋、勝於靜默 empty commit)。②**evidence-verified 拍板(enumerate 全 calls)勝於 hypothetical 恐懼**——supervisor 明列「先確認每 makeRepo call 於首次 commit 前必有 staged tracked file」= 強制 enumeration 表證據;實測 vitest 44 pass 進一步 verify commit 成功;stop-and-report 條件明列但未觸發。③**scope literal + source-path precision**:supervisor r1 抓「讀不改」段誤把 tests/mutate.test.ts L635-646 標為 scripts/mutate.ts、精確更正;plan wording 對 script vs test 檔案的位置引用需精確(此檔 runtime 用 X = 檔案在 Y、不是 wording 概念混同)。④**adversarial 9 項 check 全 clean 於 single-token diff** = 極窄 scope + evidence-first plan + 無 hypothetical extrapolation 的複合效果;不擴 sprint scope 對齊 supervisor scope literal 是收乾 round 數的關鍵。
> **⏭️ 下一棒候選**(hint 非 truth,起手 git 核實):A. P2#3 defer 剩 2 條(⑭⑮ 逐條 0.5h);B. A3 defer 剩 19 條;C. A2 defer 集合 17 條 INFO;D. P2#2 defer 集合 剩 7 條;E. A1.1 defer 集合 23 條;F. Milestone B1。
> **check:claims 逐條處置**:0 新命中(本 sprint 純 test fixture 單 token 移除、無新絕對化宣稱句)。
> 📊 成本:CC ~1h / 跨模型 review 3 rounds(plan r1/r2 supervisor + Step 4 supervisor + Step 5 adversarial round 1 0 findings)/ P1 0 個 / P2 0 個 / Step5 獨立發現 0 個(0 CRITICAL / 0 INFORMATIONAL)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、極窄 sprint 單 token 改);Codex gpt-5.6-terra medium(w6:p4)plan 2 rev + Step 4 + Step 5 approve;baseline `63ab9b09b4e3b2a214238721eb3e7fd498172c03`;來源分佈:既有缺陷 1(--allow-empty YAGNI 冗餘、defer ⑬ 條目登錄時已存在)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan 2 rev + evidence enumerate 表(25+ calls staged file 分析)/ 2 ✅ Codex r2 APPROVE + Owner continuous auto / 3 ✅ isolated worktree(wt-defer-13-allow-empty)+ Phase 1 atomic single-token commit(`b2e7d5b`、tests/check-mutation-specs.test.ts +1/-1)/ 4 ✅ Codex Step 4 對 `b2e7d5b` APPROVE / 4.5 ✅ CSO fail-closed = 模板 repo 例外、標準車道 / 4.6 ✅ 未觸發 / 5 ✅ adversarial-reviewer round 1(0 CRITICAL / 0 INFORMATIONAL / 9 項 check 全 clean)/ Phase 2 archive ⑨ + 加 ⑬ + TODOS ⑬ ✅ + entry-count conservation ✅(pre 19 + 新增 ⑬ = post 20、每 entry 恰 1 次)/ 6-7 待執行(Owner sprint-loop 授權)

> 更早的 entries:2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
