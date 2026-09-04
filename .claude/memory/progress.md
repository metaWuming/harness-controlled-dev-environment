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

📅 2026-09-04 ② — **P2#3 defer ⑥:checkTarget nlink 純讀情境過度 fail-closed → 抽 readCheckedTarget 純讀變體 + ReadTargetCheck discriminated union 型別擋寫回誤用**

> **緣起**:TODOS `TODOS.md`(repo 根)L80「🟢 P2#3 Step 5 defer 集合」條目 ⑥(conf 7):「`checkTarget` nlink 檢查在純讀情境多餘拒判」——2026-09-02 PR P2#3 Step 5 worktree 審登錄。純讀 caller(check-mutation-specs)對 hardlink spec/target fail-closed exit 2、但實際不寫回、hardlink alias 不受影響;/tmp 隔離 fixture 場景 1 驗過。Codex supervisor(defer ⑧ 收工後)拍板本 sprint 單條(不併其餘 defer);plan 3 rev(rev 1 P2-1..P2-8 8 項行為級安全邊界修正:ReadTargetCheck 真正 discriminated union 而非 interface+optional / abs 刪除以收窄能力 / helper diagnostic precedence / 三處 SSOT 全同步 / TS 型別負對照 / 高風險車道;rev 2 abs 收窄 + 風險表 prelude 矛盾刪除;rev 3 APPROVE + GO Step 3 only)。frozen full base `5807e8432c89149362d76d0ab72bc8566eae13a3`(origin/main tip post-defer ⑧ PR #57);feature tip `07ce311e751ea4fcef3debcd4998ac653c6e86f6`。
> **改動**:**8 檔 / 6 commits**(P1 atomic implementation + P2 test + P3 catalog + fix r1 P2-1/P2-2 + fix r2 README D6 措辭 + Step 5 fix SSOT 錨式修法,tip `07ce311e751ea4fcef3debcd4998ac653c6e86f6`)。`scripts/mutate.ts`:加 `export type ReadTargetCheck = { ok: true; original: Buffer } | { ok: false; reason: string }`(discriminated union、刻意不含 dev/ino/mode/abs、TS 編譯期擋寫回誤用);抽 private module-scope `openAndReadTracked` helper(六道 fail-closed 邊界 + O_NOFOLLOW + 同 fd fstat/read + gateAfterFstat callback);`checkTarget` 內部改呼叫 helper + 補 nlink=1 拒判(公開 signature + observable behavior 完全不變、hardlink 拒判優先於 UTF-8/read 錯誤);加 `export function readCheckedTarget`(純讀 caller 專用、docstring 頂端 🔴 警語);`checkTarget` 既有 doc comment 加句「readCheckedTarget 絕不可供寫回」。`scripts/check-mutation-specs.ts`:import 遷移為 readCheckedTarget、L216/L229 兩處 caller 改用、narrowing 簡化 `if (!self.ok)`;檔頭 D6 契約 + 安全邊界段 + walker docstring 三處補述兩種 nlink 契約。`tests/mutate.test.ts`:加 7 unit「readCheckedTarget nlink=2 tracked / symlink / untracked / repo 外 / .git 內 / 非 UTF-8」+ 1 TS 型別負對照 @ts-expect-error(D6、驗 ReadTargetCheck 缺 dev/ino/mode 無法傳給 writeCheckedSync)+ 1 P2-1 regression(hardlinked 非 UTF-8 → checkTarget 仍回 hardlink 拒、diagnostic precedence 不變)。`tests/check-mutation-specs.test.ts`:加 e2e ⑰「hardlink spec + target(nlink=2 tracked)→ exit 0」(macOS APFS 支援、無需 skip)。`scripts/mutations/mutation-spec-drift.json`:加 MSD-M8「readCheckedTarget 誤換回 checkTarget(import alias)→ hardlink 恢復 nlink=1 拒 → e2e ⑰ 轉紅」直接 killer;MSD-M1/M5 find/replace 對齊新 narrowing 語法(caller 遷移引起的樣本對齊、非新契約)。`scripts/control-catalog.json` CTRL-CI-013 locator/evidence/degradation/notes 補述兩種 nlink 契約 + Step 5 fix 錨式修法(不含行號)。`docs/CONTROL-CATALOG.md` catalog:render 產物同步(24537 → 25755 bytes)。`scripts/mutations/README.md` D6/D3/CI 段 + mutant→契約 mapping 表全同步。**未動**:writeCheckedSync nlink guard(mutate.ts 內 nlink!==1 第二道防線)/ mutate main CLI 迴圈的第一次 checkTarget 呼叫 / mutate.ts 檔頭 prelude / 其他 CTRL / 其他 defer / 其他 lib / MSD-M2-M7 定義 / MSD-D1-D6 定義 / discovery contract D1-D5, D7 / CI 骨架。
> **驗證(`07ce311e751ea4fcef3debcd4998ac653c6e86f6` 實測)**:typecheck / lint / vitest 30 檔 **1021 passed + 3 skipped** 全綠(+9 對 base:7 unit + 1 TS 負對照 + 1 P2-1 regression + 1 e2e ⑰、其中 e2e ⑰ 對 hardlink 場景 exit 0 綁 nlink 放寬);check:catalog 32 controls / rendered md 25755 bytes;catalog:render idempotent;check:mutation-specs 12 spec 130 探針對得上(+1 MSD-M8);mutate --spec mutation-spec-drift.json --cmd "npx vitest run tests/check-mutation-specs.test.ts" → **8/8 killed** 綁 `07ce311e751ea4fcef3debcd4998ac653c6e86f6`;mutate --spec mutation-spec-discovery.json → **8/8 killed** 綁同 tip。
> **審查**:Codex plan review 3 rev(r1 8 P2 行為級 → r2 2 精確修 → r3 APPROVE + GO Step 3 only);Codex Step 4 commit-only 3 rev(r1 **2 P2**:P2-1 diagnostic precedence 破壞 + P2-2 三處 SSOT stale;修 gateAfterFstat callback + regression test + 三處 SSOT 錨化;r2 **1 P2**:README D6 措辭仍是舊「禁區」→ 統一 qualified 版;**r3 APPROVE 0 findings**、獨立 clone 對 6f6230b 全驗)。Step 5 標準審 **1 INFORMATIONAL conf 9 + 0 CRITICAL**(F1:SSOT 三處寫「L1165/L731」、本 sprint 插入 75 行後真實位置變 L1240/L806、auditor 讀 SSOT 會誤以為 stale);Step 5 worktree 獨立審 r1 **2 INFORMATIONAL 0 CRITICAL**(W1 conf 5 README:84 mapping 表「禁區」措辭 + W2 conf 4 catalog notes 前半 defer ⑤ 遺產「定義為禁區、mutate.ts 不動」)。**3 條全修**(採 reviewer 建議的錨式修法、不含行號:「L731」→「writeCheckedSync 內的 nlink !== 1 拒判」/「L1165」→「mutate main CLI 迴圈的第一次 checkTarget 呼叫」/「D6(checkTarget 禁區)」→「D6(checkTarget/readCheckedTarget 呼叫端邊界)」);Step 5 fix commit `07ce311`;worktree r2 對新 tip 收斂 **0 CRITICAL、0 fresh conf≥7 INFO、r1 全部消解**(1 條 conf 3 純觀察 skip:docstring 短版 vs 錨式長版詳略級)。
> **⭐ 教訓**:①**diagnostic precedence 是 observable behavior 的一部分,helper 抽出時 order 要嚴格保留**——Codex Step 4 r1 P2-1:舊 helper 順序 = open → fstat → read → UTF-8 → caller 判 nlink,導致 hardlinked 非 UTF-8 檔在 base 回 hardlink 拒判、tip 回 UTF-8 拒判、precedence 破壞。修法:helper 加 `gateAfterFstat(fst) => string | null` callback,順序改為 open → fstat → gateAfterFstat → read → UTF-8;checkTarget 傳 nlink 拒 lambda(hardlink 必先於 read/UTF-8)、readCheckedTarget 傳 null(純讀跳 nlink)。加 regression unit(hardlinked 非 UTF-8 → checkTarget 仍回 hardlink 拒)pin 住 order,若順序回退 test 轉紅。②**Discriminated union 型別能力擋寫回誤用比 docstring/命名可靠**——ReadTargetCheck `{ ok: true; original: Buffer } | { ok: false; reason: string }` 刻意不含 dev/ino/mode/abs,TS 於 `if (r.ok)` 分支只能 access original;負對照 @ts-expect-error 驗 writeCheckedSync 拒接;typecheck gate 綠 = 契約成立、若擴 union 讓誤傳可編過反而 fail。這是**編譯期契約**,比 runtime docstring 警語強。命名(`readChecked` vs `checked`)+ 兩處 doc warning + writeCheckedSync 第二道防線構成縱深。③**SSOT 行號會隨插入 code 而 drift,錨式(不含行號、用結構位置)更 robust**——標準審 F1:三處 SSOT 寫「L1165 / L731」,本 sprint 插入 helper + 型別 + docstring ~75 行後真實位置變 L1240 / L806,auditor 讀 SSOT 跳到錯位。修法:改為錨「writeCheckedSync 內的 nlink !== 1 拒判」/「mutate main CLI 迴圈的第一次 checkTarget 呼叫」——未來 refactor 再 drift 也不需回改 SSOT。④**「禁區」語意需 qualify 到「公開 signature 與 observable behavior」層而非「整個檔案不動」層**——舊 D6 措辭「mutate.ts 的 checkTarget **定義**為禁區、不動」在 defer ⑥ 允許 helper 抽出後成為 misleading 絕對政策陳述。修法:qualify 為「公開 signature 與 nlink=1 observable behavior 不動、內部允許 helper/refactor 抽出」,讓政策精確對應交付現實。
> **⏭️ 下一棒候選**(hint 非 truth):A. P2#3 defer 其餘 7 條(④⑨⑪⑫⑬⑭⑮ 逐條 0.5h;含前 sprint defer ⑤/⑦/⑩ Step 5 defer 集合 label 措辭 nit);B. A3 defer 其餘 20 條;C. A2 defer 集合(17 條 INFO);D. Milestone B1;E. P2#2 defer 集合(8 條);F. A1.1 defer 集合(23 條)。
> **check:claims 逐條處置**:0 新命中(本 sprint 加 readCheckedTarget lib + docstring + 三處 SSOT 補述、無新絕對化宣稱句)。
> 📊 成本:CC ~5h / 跨模型 review 3 rounds(Codex Step 4 r1 2 P2 修 + r2 1 P2 修 + r3 APPROVE)/ P1 0 個 / P2 3 個(r1 P2-1 diagnostic precedence + r1 P2-2 三處 SSOT stale + r2 README D6 措辭)/ Step5 獨立發現 3(0 CRITICAL、標準審 1 conf 9 + worktree r1 2 conf 4-5 = 3 唯一 SSOT 一致性主題;修 3、skip 0;worktree r2 收斂 0 fresh)
> 📐 量測:claude-opus-4-7[1m] effort xhigh(主 session、8 檔核心 diff + 3 rev SSOT 修)+ adversarial-reviewer 標準審 + isolation:worktree 2 輪(r1 對 6f6230b、r2 對 07ce311 收斂);Codex gpt-5.6-terra medium(w6:p1)plan 3 rev + Step 4 3 rev;baseline `5807e8432c89149362d76d0ab72bc8566eae13a3`;來源分佈:既有缺陷 0・漏改 consumer 0・baseline 後引入 3(Codex Step 4 r1 P2-1/P2-2 + r2 D6 措辭 + Step 5 F1/W1/W2 SSOT 一致性 = 6 findings 去同源合併 3 唯一)
> **7 步 checklist**:1 ✅ plan 3 rev + Codex APPROVE + impact-radius + 隔離 fixture 實測 hardlink 兩模式 / 2 ✅ Codex supervisor「plan approve = go」/ 3 ✅ P1 atomic + P2 test + P3 catalog 三 atomic commits(a4ff7a4/4df3858/f89797e)/ 4 ✅ Codex Step 4 3 rev(fix r1 8c357e4 + fix r2 6f6230b + APPROVE)/ 4.5 ✅ 高風險車道 CSO_REQUIRED(動 mutate.ts governance lib、Step 5 加 worktree 獨立審);探針 mutation-spec-drift 8/8 + mutation-spec-discovery 8/8 綁 `07ce311` / 4.6 ✅ 未觸發(無 UI)/ 5 ✅ 標準審 1 INFO + worktree r1 2 INFO 全修 → r2 收斂 0 fresh(fix commit 07ce311)/ 6-7 待執行(Owner 授權 CI 綠自動 merge)

> 更早的 entries:2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
