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

📅 2026-09-04 ① — **P2#3 defer ⑧:CTRL-CI-013 catalog `implementation` 補列 `scripts/mutate.ts`**

> **緣起**:TODOS `TODOS.md`(repo 根)L80「🟢 P2#3 Step 5 defer 集合」條目 ⑧(conf 6):「catalog CI-013 `implementation` 未列 `scripts/mutate.ts`(邏輯所在;conf 6)」——2026-09-02 PR P2#3 Step 5 worktree 審 r1-r2 登錄。Codex supervisor(defer ⑩ 收工後)拍板下一 sprint = P2#3 defer ⑧ **單條**(不併其餘 defer);plan 3 rev(rev1 P0 shared main hi5 marker 允許 stash/刪 → rev2 shared main 唯讀、全新 implementation worktree 從 frozen full SHA cut、bookkeeping 全在 feature worktree;rev3 P1/P2 合併 atomic implementation commit 避免 catalog.doc.drift fail、影響表 catalog:render 命令正規化;rev4 純機械 P0/P1/P2 標號 supervisor APPROVE + GO)。frozen full base `6885f40d82970ee478be7c718f893be5600500bd`(main tip post-defer ⑩ PR #56);feature tip `27bda60b49af2a5d3d21db7cb31a0e4e6e6e1f08`。
> **改動**:**2 檔 / 1 commit + 1 bookkeeping**(P1 atomic implementation commit `27bda60`、+2/-1)。`scripts/control-catalog.json`:CTRL-CI-013 `implementation` 陣列於 idx 2 插入 `"scripts/mutate.ts"`,位置介於 `"scripts/check-mutation-specs.ts"` 與 `"scripts/lib/invoked-as-main.ts"` 之間(對齊 CTRL-SOP-003 主 script → 依賴 lib 順序)。`docs/CONTROL-CATALOG.md`:catalog:render 產物同步(L50 CTRL-CI-013 表格列「實作(tracked 路徑)」欄新增)。**刻意不動**:mutate.ts / check-mutation-specs.ts / CI / 其他 CTRL(含 CTRL-SOP-003 已列 mutate.ts、其他 30 CTRL 均無 static import mutate.ts 依賴)/ 其他 defer / 其他 lib / MSD-M1-M7 定義 / testRefs(tests/mutate.test.ts 屬 CTRL-SOP-003 自測)/ evidence / degradation / notes(已有 mutate.ts 引用、implementation 補完後 SSOT 自洽)。SSOT 修正:catalog locator 與 notes 已宣告倚賴 mutate.ts、implementation 補上 = catalog 內部 SSOT 一致。
> **驗證(`27bda60b49af2a5d3d21db7cb31a0e4e6e6e1f08` 實測、feature worktree `.claude/worktrees/impl-p2-3-defer-8` 隔離跑)**:typecheck / lint / **vitest 30 檔 1011 passed + 3 skipped 全綠**;check:catalog 32 controls 綠(JSON ↔ docs 逐位元組一致);catalog:render idempotent(第二次跑 git status 無 diff);check:mutation-specs 12 spec 全對得上;mutate --spec mutation-spec-drift.json --cmd "npx vitest run tests/check-mutation-specs.test.ts" → **7/7 killed** 綁 `27bda60`;mutate --spec mutation-spec-discovery.json --cmd 同 → **8/8 killed** 綁 `27bda60`。
> **審查**:Codex plan review 3 rev(rev1 3 P1:shared main hi5 marker 允許 stash/刪違反 shared-worktree 唯讀 → 改全新 implementation worktree cut 自 frozen full SHA、rev2 1 P1:P1/P2 拆兩 commit 中間 catalog.doc.drift fail → 合併 atomic implementation commit、rev3 純機械 P0/P1/P2 標號校正 + APPROVE + GO);Codex Step 4 commit-only review 1 rev **APPROVE 0 findings**(獨立 clone `/private/tmp/p2-3-defer-8-review.*`、frozen base → tip 是 ancestor、逐項:CTRL-CI-013 implementation 新增精確匹配 check-mutation-specs.ts:51 static import 責任邊界 / testRefs / evidence / degradation / notes / 其他 CTRL 未動 / CONTROL-CATALOG.md 與 JSON render 輸出一致且新增值正確 / 獨立 clone gate check:catalog=CATALOG_OK、catalog:render 後無 diff、check:mutation-specs=12 spec/129 probes、npm test 全綠)。Step 5 標準審 **0 findings APPROVE**(worktree 核對 HEAD/status 乾淨、diff 範圍實測與呼叫方一致、Schema 約束 unique + repoFilePathViolation 無排序規則位置合法、排序慣例對齊 CTRL-SOP-003 script→dep-script→lib 型式、反向命題掃 grep 全 repo 唯一 static import 消費者、mutate.ts 自身依賴 lib/invoked-as-main.ts 已列無漏、SSOT 邊界 testRefs 屬 CTRL-SOP-003 判斷正確、check:catalog + check:doc-refs + check:mutation-specs + commit 訊息 denylist + 類別「工具:」全綠、locator/notes/evidence/degradation SSOT 一致)。**標準車道、Step 5 不加 worktree 獨立審**(CSO_NOT_REQUIRED)。
> **⭐ 教訓**:①**catalog SSOT 一致性檢查**——CTRL implementation 陣列漏 static import 依賴、但同 CTRL 的 locator/notes 已宣告倚賴該檔,catalog 內部 SSOT 不一致。修法:CTRL implementation 應窮舉「執行路徑上的 static import 依賴」+ 「文檔引用的實作檔」;locator/notes 提到某檔 = implementation 應含之(反之亦然,否則 catalog 自證引用該檔但實作面否認)。②**P1/P2 拆分違反 catalog.doc.drift 每 phase gate 綠**——JSON 與 rendered md 若拆兩 commit、中間 commit 讓 check:catalog 的 catalog.doc.drift fail、可獨立 revert 的完整 SSOT 破壞。修法:catalog metadata 改動一律 atomic commit(JSON + rendered md 同一 commit)。③**shared main worktree 內含 WIP 未提交狀態時**——本 session 起手 shared main progress.md 有 M(hi5 marker、屬非本 sprint),plan rev1 允許「stash -u / 刪 hi5 段 / rebase」= 帶入非本 sprint 狀態污染實作與 mutation 證據。修法:shared main 保持唯讀,全新 implementation worktree 從 frozen full SHA cut、所有實作 + bookkeeping 在該 worktree 內。④**Codex supervisor 訊息 pane id 會漂**——HANDOFF.md 寫 pane 為 `w2:p8`,實際本 session 開始時 herdr agent list 回 `w6:p1`;Herdr 開新 workspace 時 pane id 換位、HANDOFF marker 是 hint 非 truth、起手要 `herdr agent list` 核實。
> **⏭️ 下一棒候選**(hint 非 truth):A. P2#3 defer 其餘 8 條(④⑥⑨⑪⑫⑬⑭⑮ 逐條 0.5h;含前 sprint defer ⑦ F1-F4 + defer ⑤ Step 5 defer 集合;本 sprint 0 新 defer);B. A3 defer 其餘 20 條;C. A2 defer 集合(17 條 INFO);D. Milestone B1;E. P2#2 defer 集合(8 條);F. A1.1 defer 集合(23 條)。
> **check:claims 逐條處置**:0 新命中(本 sprint 純 catalog metadata 陣列 append + rendered 同步、無新宣稱句加入 lib 檔頭 / docs 主張)。
> 📊 成本:CC ~1h / 跨模型 review 1 round(Codex Step 4 r1 APPROVE 0 findings)/ P1 0 個 / P2 0 個 / Step5 獨立發現 0(0 CRITICAL、Step 5 標準審 APPROVE 0 findings、標準車道不加 worktree 獨立審)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、極窄 sprint、單 CTRL 條目 metadata 改動)+ adversarial-reviewer 標準審 0 findings;Codex gpt-5.6-terra medium(w6:p1)plan 3 rev + APPROVE + GO + Step 4 commit-only 1 rev APPROVE;baseline `6885f40d82970ee478be7c718f893be5600500bd`;來源分佈:既有缺陷 0・漏改 consumer 0・baseline 後引入 0(0 findings)
> **7 步 checklist**:1 ✅ plan 3 rev + Codex APPROVE + impact-radius 表 + OUT-of-scope grep 掃描全 catalog / 2 ✅ Codex supervisor「plan approve = go」/ 3 ✅ P1 atomic commit(27bda60)+ 全 phase gate 綠(check:catalog / catalog:render idempotent / check:mutation-specs / typecheck / lint / vitest 1011 passed / 2 spec mutation 7+8 全 killed 綁 tip)/ 4 ✅ Codex Step 4 commit-only 1 rev APPROVE 0 findings / 4.5 標準車道 CSO_NOT_REQUIRED(模板 repo 路徑表為空 fail-closed 例外人工判定;本 PR 動 catalog metadata、非安全敏感面)/ 4.6 ✅ 未觸發(無 UI)/ 5 ✅ 標準審 APPROVE 0 findings / 6-7 待執行(Owner 已授權 CI 綠自動 merge)

📅 2026-09-03 ⑨ — **P2#3 defer ⑩:formatReport([]) 純函式 fail-open + defense-in-depth 第二道防線**

> **緣起**:TODOS P2#3 Step 5 defer 集合 ⑩(conf 6):「`formatReport([])` 回 code 0,純函式對空輸入 fail-open、只靠 listSpecFiles 前置擋」。Codex supervisor(defer ⑦ 收工後)拍板本 sprint 單條;理由「剩餘清單中直接改變 guard outcome 的結構性缺口」。frozen base `926fce2ffd6e740c508e4448d5978b31034d63f5`(main tip post-defer ⑦ PR #55);plan 1 rev APPROVE。
> **改動**:**5 檔 / 4 commits**(Phase 1-3 + r1 fix + Step 5 fix,tip `9b53435a34d1f120a0d82a733ad64641853e2144`)。`scripts/check-mutation-specs.ts`:formatReport 加空 results preflight fail-closed 分支(code 2 + diagnostic「結果集為空——沒有任何 spec 檔被檢查(defense-in-depth 第二道)」;放函式最頂表達 preflight 意圖);檔頭 docstring D5 契約 + exit 2 契約段補述 defense-in-depth 第二道。`tests/check-mutation-specs.test.ts`:加 direct unit「空 results → code 2」(M7 direct killer)。`scripts/mutations/mutation-spec-drift.json`:MSD-M2 label 校正(killer 明列 = 既有 unit L82-90 `.ok===false + reason.toContain('沒有任何 spec 檔')` 直接斷言,不靠 exit code)+ 加 MSD-M7(攻 formatReport 新分支、killer 明列 = direct unit code+text 兩條斷言)+ label 補述兩層 killer 分工。`scripts/control-catalog.json` CTRL-CI-013 evidence/degradation 補「或 formatReport 結果集為空 defense-in-depth 第二道」;`scripts/mutations/README.md` 條目 6→7 條;`docs/CONTROL-CATALOG.md` catalog:render 產物。**禁區守住**:mutate.ts / discoverSpecFiles / walker / checkSpecFile / runCheck 核心邏輯未動、其他 sprint 3-5 lib / 其他 defer / 其他 mutant / CI 骨架未動。
> **驗證(`9b53435a34d1f120a0d82a733ad64641853e2144` 實測)**:typecheck / lint / vitest 30 檔 1011 passed + 3 skipped 全綠(+1 M7 direct unit);check:mutation-specs 12 spec 129 探針對得上(mutation-spec-drift 6→7);check:catalog 32 controls 綠;catalog:render idempotent;mutate --spec mutation-spec-drift.json --cmd "npx vitest run tests/check-mutation-specs.test.ts" → **7/7 killed** 綁 `9b53435a34d1f120a0d82a733ad64641853e2144`(M1/M2/M7/M3/M4/M5/M6 全被抓、含新 M7 direct unit killer + M2 校正後 label unit killer;defense-in-depth 兩道防線各自驗)。
> **審查**:Codex plan review 1 rev APPROVE;Codex Step 4 2 rev(r1 **1 P1 行為級**「M2 killer 靠 CLI e2e ④ stderr 間接、違反獨立 killer 原則」→ 修 script 第二道 text 加「沒有任何 spec 檔」子句、M7 find/replace 同步 → M2 mutant e2e ④ 兩斷言都通過、M2 只靠 unit 直接殺;**r2 APPROVE 0 unresolved** 綁 1d7297c、獨立 clone mutation-spec-drift 7/7 killed)。Step 5 標準審 **3 INFORMATIONAL 0 CRITICAL**(F1 conf 5 檔頭 docstring 未同步、F2 conf 4 formatReport preflight 位置、F3 conf 3 M7 label 精確性);Step 5 worktree 審 r1 **2 INFORMATIONAL 0 CRITICAL**(W1 conf 4 檔頭 exit 2 契約 + W2 conf 4 D5 契約 = 同 F1 SSOT 姐妹)。**4 條全修**(F1/W1/W2 SSOT 三處合併補 + F2 位置移函式最頂 + F3 label 補述);Step 5 fix commit `9b53435`;worktree r2 對新 tip 收斂 **0 CRITICAL、0 fresh conf≥7 INFO**(2 條 conf 3 純觀察 skip;vitest 15 e2e fail 是 worktree 缺 tsx bin 環境雜訊、非迴歸;主 checkout 43 passed 已驗證)。
> **⭐ 教訓**:①**defense-in-depth 第二道防線是純函式契約完整性、不能只靠 caller 保證**——formatReport([]) 純函式對空輸入 fail-open、目前靠 runCheck 前置 discoverSpecFiles 拒判來確保永不觸發;若第一道 被 mutant / refactor 誤刪,第二道應接住而非撞 fail-open。修法:formatReport 內加 preflight fail-closed 分支(code 2 + 明確 diagnostic 區分兩層)。②**兩道防線 mutant 需各自獨立 killer**——原 MSD-M2 kill 靠「第一道失效 → 第二道 fail-open → exit code 從應 2 掉到 0」兩層 combined;修 formatReport([])→code 2 讓 M2 存活(第二道接住);修法:M2 label 校正 killer 為 unit `.ok===false` 直接斷言、加 M7 專攻第二道、CLI e2e ④ 對 M2/M7 皆 exit 2 屬預期不算 killer(supervisor 明列)。③**兩層 diagnostic 都要含穩定子句避免 label 間接 kill**——Codex Step 4 r1 P1:M2 mutant 走第二道時 stderr 少「任何」二字 → e2e ④ stderr 斷言不通過 → M2 靠 e2e 間接 kill、違反獨立原則;修法:第二道 text 加「沒有任何 spec 檔」子句(同時保留「formatReport 結果集為空」明確辨識第二道)。④**preflight 檢查放函式最頂表達意圖**——雖然放最後靠 filter/reduce/for short-circuit chain 對空 results 也 fall-through 到 return code 0,但語意上「空一律拒判」是 preflight;放最頂對後續 refactor robust(F2 保守修)。
> **⏭️ 下一棒候選**(hint 非 truth):A. P2#3 defer 其餘 9 條(④⑥⑧⑨⑪-⑮ 逐條 0.5h;含本 sprint F1-F3 措辭 nit + 前 sprint defer ⑦ F1-F4 + defer ⑤ Step 5 defer 集合);B. A3 defer 其餘 20 條;C. A2 defer 集合(17 條 INFO);D. Milestone B1;E. P2#2 defer 集合(8 條);F. A1.1 defer 集合(23 條)。
> **check:claims 逐條處置**:0 新命中(本 sprint 只加 formatReport 分支 + docstring 補述 + mutant label、無新宣稱句)。
> 📊 成本:CC ~2.5h / 跨模型 review 2 rounds(Codex Step 4 r1 P1 修 + r2 APPROVE)/ P1 1 個(M2 killer 靠 e2e ④ 間接、text 少「任何」)/ P2 0 個 / Step5 獨立發現 5(0 CRITICAL、標準審 3 + worktree r1 2 去 F1/W1/W2 SSOT 同源合併 = 3 唯一;修 4 條、skip 0)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、極窄 sprint、單檔核心 diff)+ adversarial-reviewer 標準審 + isolation:worktree 2 輪(r1 對 1d7297c、r2 對 9b53435 收斂;r2 一度 stall fail、重派後成功);Codex gpt-5.6-terra medium(w2:p8)plan 1 rev + Step 4 2 rev;baseline `926fce2ffd6e740c508e4448d5978b31034d63f5`;來源分佈:既有缺陷 0・漏改 consumer 0・baseline 後引入 5(Codex Step 4 1 P1 修 + Step 5 4 INFO 修)
> **7 步 checklist**:1 ✅ plan 1 rev + Codex APPROVE + impact 5 axis 盤點 / 2 ✅ Owner「plan approve = go」/ 3 ✅ Phase 1-3 atomic commits(bd123ea/9eba2b4/4204e32)/ 4 ✅ Codex 2 rev r1 P1 修(1d7297c)→ r2 APPROVE / 4.5 ✅ 高風險車道(governance gate、mutation label 命中 CTRL-CI-013 覆蓋率佐證)、探針 7/7 綁 `9b53435a34d1f120a0d82a733ad64641853e2144` / 4.6 ✅ 未觸發(無 UI)/ 5 ✅ 標準審 3 INFO + worktree r1 2 INFO 全修 → r2 收斂 0 CRITICAL / 6-7 待執行(Owner 已授權 CI 綠自動 merge)

> 更早的 entries:2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
