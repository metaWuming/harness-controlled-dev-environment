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

## 🤝 hi5 交棒紀錄 — 2026-09-02 20:14
- 交棒時 commit:`2ed1be1cf4bca2da3ac0c260cd25928122f0149e`(main;PR #46 squash;工作樹乾淨、無 WIP)
- 交接檔:`_handoffs/HANDOFF.md`(本機檔,`.gitignore` 忽略)
- 暫停點:Milestone A 全部收尾(v0.2.0 + #45 + #46),無在途工作;下一棒由 Codex supervisor(Herdr w2:p8)拍板選 B1 / TODOS P2 / defer 集合

📅 2026-09-03 ① — **P2#2:`DELIVERY_REFS` 共用政策契約(`lib/delivery-refs.ts`,fail-closed、無 fallback)**

> **緣起**:TODOS P2#2(`DELIVERY_REFS=HEAD` / 本地 feature / 未合併 `origin/feature/x` 都能把未合併 `(#N)` 塞進 allowedPrs)。supervisor 拍板:只准 origin 正規 remote-tracking 交付 ref + 必須是權威 base 祖先 + 綁靜態 `deliveryBranches`(Q1)+ 移除 `origin/develop` / 本地 main fallback(Q2);plan 走 4 rev(rev 2 P1:origin/HEAD 權威 base 本身也受驗;rev 3 P2:`ref.undeclared` 專屬探針;rev 4:`base.unresolvable` 單測)。frozen base `2019f48`,worktree `feat/delivery-refs-remote-only`。
> **改動**:**13 檔 / 5 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count`)。`scripts/lib/delivery-refs.ts`:base 與 env 候選走同一支 `validateRef`(形狀 → 存在 → 正規 → 祖先 → 宣告),拒絕收集原因碼、refs 全空;兩 consumer 只接線,遇 `!ok` 印 stderr 後 exit 2;`check-no-source-terms.ts` 只動 allowedPrs 來源段(`git diff -U0` 5 個 hunk,掃描函式 0 diff)。fixture:兩 makeRepo 預設寫 config + bare origin + set-head main,`noOrigin` 給負對照;A-e1/e2/e3 改寫。catalog CI-008 / CI-009 登錄 lib 與 spec;ci.yml 註解、README、CHANGELOG [Unreleased] Changed、TODOS。
> **驗證(`b4069e2` 實測)**:typecheck / lint;三個相關測試檔 **240 passed**;**25 檔 910 passed + 2 skipped**(bookkeeping 前重跑);check:mutation-specs OK(96 條樣本無漂移);catalog / doc-refs / doc-size / no-source-terms / adoption / hooks 綠;check:todos 以 MARKER_SELF_PR 綠。**mutation `delivery-refs.json` 8/8** 綁 `b4069e28c6ed8d33a791ce7fb3b78095f7a77156`;**`source-term-diff-scan.json` 29/29** 綁 `52dbc7b`(其後該檔只刪一行孤立 docstring)。
> **審查**:Codex 全範圍 PASS(獨立 clone,lib 19/19、todos 45/45、nst 全綠)。Step 5 worktree 審 2 輪:r1 **0 C + 11 I**(順手修 4 條過時註解 + 1 條空字串診斷)→ r2 **0 C + 3 I 收斂**。defer 9 條進 TODOS P3。
> **⭐ 教訓 / 已知限制**:①**祖先契約下 env 通道是空操作**——通過驗證的候選必是 base 祖先,`git log` 集合 ⊆ base 的,永遠加不進新 PR 號;env 現在只剩「驗證會不會拒絕」的意義(r2 conf 9,登錄待 supervisor 決定是否整個移除)。②新 `process.exit(2)` 插在 `main()` 的 mkdtemp 之後,`finally` 清理不會跑(r2;登錄)。③修註解要修整段:r1 修了同一 step 兩行,上方矛盾的兩行留著被 r2 抓。
> **check:claims 逐條處置**:2 處命中留 A(lib 檔頭「沒有任何 ref」= 契約字面;測試註解「只有 main」= fixture 字面)。
> 📊 成本:CC ~4h / plan 4 rev / Codex 1 輪 / Step 5 2 輪 / mutate 3 輪 / P1 0 / P2 0 / Step5 獨立發現 14(0 CRITICAL、修 5、defer 9)
> 📐 量測:claude-fable-5-1 effort low;Codex gpt-5.6-terra medium(w2:p8);來源分佈:既有缺陷 0・漏改 consumer 5(ci.yml 註解 ×3、todos 檔頭、nst docstring)・baseline 後引入 9
> **7 步 checklist**:1 ✅ rev 4 / 2 ✅ supervisor APPROVE / 3 ✅ P1–P5 / 4 ✅ Codex PASS / 4.5 ✅ 人工視同高風險(cso 路徑表空),探針 8/8 + 29/29 / 4.6 ✅ 未觸發 / 5 ✅ r2 收斂 / 6-7 待執行

📅 2026-09-02 ③ — **P2#3:mutation spec 樣本漂移 CI 守門(`check:mutation-specs` + CTRL-CI-013)**

> **緣起**:TODOS P2#3(前兩 sprint 內 spec 漂移被 mutate fail-closed 抓 4 次、都在收尾才發現)。supervisor 拍板只做 P2#3、單獨一支 PR;frozen base `7c4f0a35872de42a103d7ca5d9ed14aec53ae7b7`,worktree `feat/mutation-spec-drift-gate`。plan rev 2 通過(rev 1 P1:spec 檔本身要先過 `checkTarget` 再讀 bytes)。
> **改動**:**10 檔 / 4 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count`)。`scripts/check-mutation-specs.ts` 只複用 `mutate.ts` 的 `checkTarget` / `parseSpecs` / `applyMutation`:spec 目錄 lstat 非 symlink 且 realpath 等於正規路徑;spec 檔與探針目標都用 checkTarget 回的 bytes 解析;exit 0 全對 / 1 DRIFT / 2 無法判定(untrusted 優先)。CI step「Mutation Spec Drift Check」+ catalog CTRL-CI-013 同 commit(現 31 controls / 17 steps);mutations/README、CHANGELOG [Unreleased]、TODOS P2#3 ✅。
> **驗證(`f32e512` 實測)**:typecheck / lint / **24 檔 880 passed + 2 skipped**;check:mutation-specs 對本 repo exit 0(7 spec 檔 88 條);catalog / doc-refs / doc-size / todos / no-source-terms / adoption / hooks 全綠;**mutation `mutation-spec-drift.json` 6/6** 綁 `f32e51237e83291fbd2285fdb895e4bfeba72beb`。
> **審查**:Codex 全範圍 r1 PASS(0 P1/P2,獨立 clone 重跑全部驗證)。Step 5 worktree 審 2 輪:r1 **1 C + 9 I**(C1:`isMain` 未 realpath,經 symlink 目錄呼叫時靜默 exit 0 = 守門自己 fail-open;修成兩邊 realpath + e2e ⑩;順手修 catalog degradation、TODOS 數字、temp dir 洩漏)→ r2 **0 C + 9 I 收斂**(Owner 裁示無 CRITICAL 即停)。defer 合計 15 條進 TODOS P3。
> **⭐ 教訓**:「fail-closed 守門」自己的入口(`isMain`)沿用 repo 慣例就繼承了 fail-open 形狀——`mutate.ts` / `check-control-catalog.ts` 同款,已登錄不在本 PR 動。新 checker 的第一條探針應該是「腳本根本沒跑」。
> **check:claims 逐條處置**:9 處命中全留 A(「只有人工重跑」為 TODOS 原文引述;「沒有任何 spec 檔」= length===0 字面;「每一條問題」= 陣列全部;其餘為測試名 / spec label)。
> 📊 成本:CC ~2.5h / plan 2 rev / Codex 1 輪 / Step 5 2 輪 / mutate 2 輪 / P1 0 / P2 0 / Step5 獨立發現 19(1 CRITICAL、修 4、defer 15)
> 📐 量測:claude-fable-5-1 effort low;Codex gpt-5.6-terra medium(w2:p8);來源分佈:既有缺陷 1(isMain 慣例)・漏改 consumer 0・baseline 後引入 18
> **7 步 checklist**:1 ✅ rev 2 / 2 ✅ supervisor APPROVE / 3 ✅ P1–P4 / 4 ✅ Codex PASS / 4.5 ✅ 人工視同高風險(cso 路徑表空),探針 6/6 / 4.6 ✅ 未觸發 / 5 ✅ r2 收斂 / 6-7 待執行

📅 2026-09-02 ② — **git-add-guard:`git add -A` 誤加工具產物的機器化守門(LESSONS ⚠️ 第 ≥4 次 → 升級階梯)**

> **緣起**:Owner 拍板(PR #45 merge 後):把 LESSONS ⚠️ [2026-08-29] 的規則寫進本 repo 並機器化。frozen base `80f76b8`(main = v0.2.0 + #45),直接在主 worktree 開 `feat/git-add-guard`(當時已無其他 worktree、工作樹乾淨)。
> **改動**:**13 檔 / 5 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count`)。三層:①`.gitignore` 列 `.codegraph` / `.gbrain-source` / `_handoffs`(**不加尾斜線**,symlink 才會被 ignore);②`code-pattern.sh` 第三個 SSOT `TOOL_ARTIFACT_PATTERN='(^|/)\.codegraph(/|$)|…'`,pre-commit 在**任何分支**、任意深度、檔 / 目錄 / symlink 皆擋,刪除放行以便清理;工具產物段用 `git diff --cached --name-only -z --diff-filter=d` 寫暫存檔(失敗即 exit 1)後 `read -d ''` 逐筆原始位元組比對;③`CLAUDE.md` §4.6 成文規則。`check-hooks.sh` 載入 + 冒煙第三個 SSOT;ADOPTION §4 / OVERVIEW / LESSONS / catalog CTRL-HOOK-001 同步。
> **驗證**:typecheck / lint / **23 檔 856 passed + 2 skipped**;`check:hooks`(三個 pattern)/ catalog / doc-refs / doc-size / no-source-terms / adoption / todos 全綠;`tests/check-hooks.test.ts` 18 條(含真 `git commit` 行為級:非 ASCII、TAB、symlink、巢狀、`rm --cached` 清理放行、`.gitignore` 第一道 `add -A` 正對照)。**mutation `git-add-guard.json` 7/7** 綁 `875b015e089c04b8ea9066c287ac33d606698e4a`。
> **審查**:Codex commit-only 4 輪(r1 P2 檔頭「兩個 pattern」;r2 **P1:`core.quotePath=false` 只解高位元、TAB / LF 仍 C-quote → 繞過**;r3 / r4 PASS)。Step 5 worktree 審 3 輪:r1 **2 C + 8 I**(C1 quotePath 非 ASCII 繞過、C2 刪除也被擋封死清理路徑)→ r2 **1 C + 5 I**(C1 修一半,`"` / `\` / TAB 仍繞過 = Codex P1 同形狀)→ r3 **0 C + 7 I 收斂**(順手修 F2 fail-open、F3 測試斷言、F7 用語)。共 3 CRITICAL + 1 P1 全修;登錄 F1 LF 路徑誤擋(安全方向)、F4 BSD grep locale、F5 測試 gitc 未切 global config、F6 訊息拆行、F6(r2)巢狀冒煙為刻意升級訊號。
> **⭐ 教訓**:①**「修一半」比不修更危險**——r1 用 `quotePath=false` 修 C1,只覆蓋了 fixture 用的中文檔名;Codex 與 Step 5 r2 各自獨立用 TAB / `"` 打穿。修 encoding 類問題要拿**規格**(git 文件:引號 / 反斜線 / 控制字元不論設定一律跳脫)驗,不能拿一個樣本驗。②**目錄假設會在 symlink 上同時打穿兩道**(`.gitignore` 尾斜線 + pattern 尾 `/`);兩道防線用同一個假設就不是縱深。③process substitution 在 `set -e` 下是 fail-open 形狀——gate 讀外部指令輸出要落地並檢查 exit code。
> **⏭️ 下一棒候選**(hint 非 truth):A. Milestone B1;B. TODOS P2#2 / P2#3;C. A2 / A3 defer 集合(含 protectedBranches 擴大警示)。
> **check:claims 逐條處置**:命中以 pre-commit / code-pattern.sh 註解與測試名為主,留 A(「任何分支」「一律」是 hook 實際行為;「唯一」為 SSOT 設計)。
> 📊 成本:CC ~3h / Codex 4 輪 + Step 5 3 輪 + mutate 5 輪 / P1 1 個 / P2 1 個 / Step5 獨立發現 20 個(3 CRITICAL、修 10、defer 7)
> 📐 量測:claude-fable-5-1 effort low;Codex gpt-5.6-terra medium(新 pane w2:p8);baseline `80f76b858d1ffdfa902387dd62c6321575009c44`;來源分佈:既有缺陷 0・漏改 consumer 3(check-hooks 檔頭、ADOPTION §4、OVERVIEW)・baseline 後引入 17(其中 2 CRITICAL + 1 P1 由 r1 修法引入)
> **7 步 checklist**:1 ✅(Owner 口頭 scope,無 plan file——小型 governance PR)/ 2 ✅ / 3 ✅ / 4 ✅ Codex r1–r4 / 4.5 ✅ 高風險車道(hooks),探針 7/7 / 4.6 ✅ 未觸發 / 5 ✅ r3 收斂 / 6-7 待執行

> 更早的 entries:2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
