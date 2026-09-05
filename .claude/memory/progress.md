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

📅 2026-09-06 ② — **P2#2 defer ⑦:harnessConfigJson 抽 test-only fixture(dedup 兩測試檔逐字兩份輸出等價 helper、P2#2 集合最後 1 條、collection closed)**

> **緣起**:TODOS.md「P2#2 Step 5 defer 集合」⑦ 條目(conf 6):「harnessConfigJson 在兩個測試檔逐字兩份,schema 升版要改兩處」。集合前 8 條(①②③⑤⑥⑧⑨已 PR 交付 / ④隨 env 通道移除自然消失)、⑦為最後 1 條 code 交付。#69 P2#2 defer ⑤ squash 後、Codex supervisor w6:p4 gpt-5.6-terra 拍板本 sprint = A-⑦ 單條 test infrastructure dedup、標準車道 CSO_NOT_REQUIRED、review effort medium(test infrastructure 非契約邊界);frozen full base `bfb1a7c02ff14b7bf7907412d95288307e2cb8dc`(origin/main tip = #69 squash);shared local main 仍在 233858f + CLAUDE.md M(全程 lock)。plan review r1(1 round、APPROVE + GO Step 3)。
> **改動**:**Phase 1 atomic + Step 4 review fix + Step 5 round 1 fix、3 檔基礎 + 累積 +38/-33 folded**(Phase 1 final tip `71b8467049736504674022c02f24d5aaaf48e7c0`):
> - Phase 1(`4ccd06c`、+36/-32、3 檔):new tests/fixtures/harness-config-fixture.ts(test-only fixture generator、0 imports、header L7-11 明列不 import production loader / config generator 避 same-source 假綠、`harnessConfigJson(deliveryBranches: readonly string[]): string` 硬編 JSON.stringify 結構、與 scripts/lib/harness-config.ts 邏輯上獨立)/ tests/check-no-source-terms.test.ts(移除 local `harnessConfigJson` 定義 L606-620、加 named import)/ tests/check-todos-markers.test.ts(移除 local 定義 L385-398、加 named import)
> - Step 4 review fix(`dac556e`、+2/-1、1 檔):fixture header L3-4 wording「原本各自定義一份逐字重複」校正成「原本各自定義一份輸出等價的 harnessConfigJson(source quote style 不同、但 JSON.stringify 結果逐字相同)」——Codex Step 4 抓 P2 wording finding:frozen base 兩份 source 使用不同 quote style(check-no-source-terms 用 "、check-todos-markers 用 ')、只有 JSON.stringify output 逐字相同、非 byte-for-byte source 重複
> - Step 5 round 1 fix(`71b8467`、+1/-1、1 檔):tests/check-no-source-terms.test.ts import order 對齊 sibling caller——新增 harnessConfigJson import 從 node:fs 與 node:os 之間(L34)移到 vitest 之後、其他 relative imports 之前;node builtins → external `vitest` → relative 分組與 tests/check-todos-markers.test.ts 一致
>
> **禁區守住**:production loader `scripts/lib/harness-config.ts` / schema / runtime / consumers (check-no-source-terms / check-todos-markers 兩 runner 邏輯) / mutation specs / CI workflow / catalog register / SOP / shared main 233858f + CLAUDE.md M / 2 支 stash / 保留 worktrees / remote:全 0 line 動。
> **驗證(fresh worktree wt-p2p2-defer-7-harness-config-fixture、frozen tip 71b8467、非 preflight)**:git diff bfb1a7c..71b8467 --stat 3 檔 +38/-33 folded;typecheck / lint 綠;`npx vitest run tests/check-no-source-terms.test.ts tests/check-todos-markers.test.ts` **219 pass**(174 + 45、base counts 對得上);`npm test` 全 suite **31 files / 1027 passed + 3 skipped**(base bfb1a7c 1027 + 0 新增)、`npm run check:mutation-specs` 12 spec 129 條探針對得上、`npm run check:catalog` CATALOG_OK 32 controls、`npm run check:doc-refs` 653 refs / 0 失效、`npm run check:claims --base=origin/main` 22 hits 全 pre-existing 在 base bfb1a7c(Sprint 3 defer ⑤ 已 merge 內容;Phase 1 diff 0 新增 claim 字);package-lock.json 未進 diff。**Byte-identity 驗證**(adversarial-reviewer 獨立 clean clone 逐 hunk 核對):key insertion order / value semantics / spread `[...deliveryBranches]` 語意 identical、JSON.stringify 皆 compact output(無 whitespace 參數)、byte-identical for identical input。
> **審查**:Codex plan review r1(1 round、APPROVE + GO Step 3、6 決策拍板 D1 KEEP tests/fixtures/ / D3 quote style 單一 " KEEP / D1-D9 全 KEEP);Codex Step 4 對 `4ccd06c` NEEDS-REVISION 1 P2 wording finding(fixture header 「逐字重複」不精確)→ 修為 `dac556e` APPROVE。Step 4.5 CSO 標準車道人工 CSO_NOT_REQUIRED(test infrastructure、兩 consumer runtime 全不動、無 auth/authorization/payment/PII/audit or production logic 邊界、模板 repo 路徑表為空 = 設計)。Step 4.6 未觸發(無 UI diff)。Step 5 adversarial round 1 **0 CRITICAL / 1 INFORMATIONAL**(F1 import placement conf 4);supervisor 分類:F1 in-scope FIX(本 sprint 新增 import 造成的分組破壞、非「順便優化」既有 code);round 2 rereview:0 actionable。
> **⭐ 教訓**:①**Test 檔逐字兩份 fixture generator 抽 test-only helper 的最小 surgical pattern**——不引用被測實作(production loader / config generator)避 same-source 假綠、schema 升版時 production 邏輯與 fixture output 各自表述、由 loader 對 fixture 的解析結果做 assertion 保持 mutation-sensitive;不新增永久 unit test(硬編 expected JSON 會製造第二個 schema 維護點)、等價證據採 Codex commit-object review 逐欄核對 + 兩 caller test suite 全過 + adversarial 獨立 clean clone byte-identity 驗證。②**「輸出等價」vs「逐字重複」精確措辭差異**——本 sprint header 起初寫「逐字重複」被 Codex Step 4 抓 P2 wording finding(frozen base 兩份 source 使用不同 quote style、只有 JSON.stringify output 逐字相同),精確描述 source-level 差異與 output-level 等價避免下游讀者誤讀關係;dedup refactor 的 comment SSOT 需精確表達「等價於什麼」而非泛稱「重複」。③**新增 import 造成的分組破壞屬本 sprint 責任**(非「順便優化」既有 code)、supervisor 拍板 in-scope FIX 而非 defer——修法邊界關鍵在「這一行是不是本 sprint 引入」;原則 3 Surgical Changes 的「不順便優化」不覆蓋自己新加行的分組義務。④**P2#2 集合 close**:本 sprint 為集合最後 1 條 code 交付、集合 code + 敘述層面 已無 pending(①②③⑤⑥⑦⑧⑨已 PR 交付、④隨 env 通道移除自然消失);TODOS 集合 header 更新為「①-⑨已交付或決策、collection closed」。⑤**低 review round 密度屬 test infrastructure sprint 正常代價**:plan r1 APPROVE + Step 4 x2(NEEDS-REVISION + APPROVE)+ adversarial x2(1 INFO + 0 actionable)= 5 rounds、對比 defer ⑤ 的 15 rounds、屬 taxonomy 級 refactor vs test dedup 的合理差距。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A. A3 Step 5 defer 集合 剩 19 條 INFO conf ≤7;B. A2 Step 5 defer 集合 17 條 INFO conf ≤6;C. A1.1 defer 集合 23 條 conf ≤7 doc governance;D. 單條:grep.column NUL 錯位(conf 8、0.5-1h)/ mutate.ts SIGTERM 不還原(conf 8、1h、P3);E. Milestone B1(新開)。P2#2 集合已 closed、無 pending。
> **check:claims 逐條處置**:25 命中(base=origin/main):22 條 pre-existing 在 base bfb1a7c(Sprint 3 defer ⑤ 已 merge 內容)、3 條由 Phase 2 bookkeeping 引入(TODOS.md L77 交付(⑦)敘述 + progress.md L83 Step 4 review fix + progress.md L89 教訓 ②,皆為「只有 JSON.stringify 結果逐字相同」句型精確描述 byte-identity 比較的 scope、非絕對化宣稱)——**全部 KEEP**:(a) pre-existing 22 條屬 Sprint 3 已 merge 內容、非本 sprint 引入;(b) 新增 3 條「只有」屬 dedup refactor 的 SSOT wording、精確描述 source-level vs output-level 等價的 scope 邊界(Codex Step 4 明列必要 wording)、無替代措辭可表達精確等價語意。0 個 actionable 新絕對化宣稱句。Phase 1 code diff 3 檔本身 0 新 claim 字。
> 📊 成本:CC ~1h / 跨模型 review 5 rounds(plan review r1 1 round + Codex Step 4 x2 對 4ccd06c/dac556e + adversarial rounds x2 (round 1 + round 2 rereview) + supervisor 分類 x1) / Step 4 P2 wording actionable findings 1 個(非 CRITICAL、fixture header 措辭精確度、修為 dac556e 收) / Step 5 獨立發現 1 個(round 1 INFO import placement、修為 71b8467、round 2 0 actionable)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、test infrastructure dedup);Codex gpt-5.6-terra medium(plan / Phase 1 / adversarial)+ high(frozen full-range final)(w6:p4)plan r1 + Step 4 x2 + adversarial rounds x2 + supervisor 分類 x1 + frozen full-range final review;baseline SHA `bfb1a7c02ff14b7bf7907412d95288307e2cb8dc`;來源分佈:既有缺陷 1(逐字兩份 fixture generator、schema 升版兩處維護、defer ⑦ 條目登錄時已存在)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan file `~/.claude/plans/2026-09-06-p2p2-defer-7-harness-config-fixture.md` + Codex plan review r1 APPROVE / 2 ✅ Codex r1 APPROVE + GO Step 3 / 3 ✅ fresh worktree wt-p2p2-defer-7-harness-config-fixture + npm ci + Phase 1 atomic 3 檔 commit `4ccd06c` + Step 4 review fix `dac556e` + Step 5 round 1 fix `71b8467` / 4 ✅ Codex Step 4 x2 對 `4ccd06c`(P2 wording NEEDS-REVISION)+ `dac556e`(APPROVE) / 4.5 ✅ CSO 標準車道人工 CSO_NOT_REQUIRED / 4.6 ✅ 未觸發(無 UI diff) / 5 ✅ adversarial round 1(1 INFO)+ supervisor 分類 F1 FIX + round 2 rereview(0 actionable) / Phase 2 加 ② + doc-size gate 4 段 + TODOS ⑦ ✅ + P2#2 集合 close 註明 + PR 引用位待 Step 6 補號 + entry-count conservation:base archive 25 + current 1(①)= pre 26;新增 ② 草稿後 archive 25 + current 2(①、②)= 27;final archive 26(搬入 ①)+ current 1(②)= post 27、每 entry 恰 1 次 / 6-7 待執行(Owner sprint-loop 授權)

> 更早的 entries:2026-09-06 ① P2#2 defer ⑤、2026-09-05 ⑧ P2#2 defer ⑨、2026-09-05 ⑦ P2#2 defer ③、2026-09-05 ⑥ P3 delivery-refs 移除集合 ①+②、2026-09-05 ⑤ P2#3 defer ⑮、2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
