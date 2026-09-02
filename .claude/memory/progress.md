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

📅 2026-09-03 ① — **PR A3:Control Catalog + 文件一致性治理 + Milestone A 收尾(0.2.0)**

> **緣起**:優化方案 §7 + 不變量 I3 / I4 / I6;A2 交付後 Milestone A 最後一項。frozen base `5832d9ed7b57c471dcb1a298ddf9245100529bb4`,乾淨 worktree `feat/a3-control-catalog`;dirty main worktree 未讀未動(rev 2 provenance 原則:兩條 A1 defer 由已 commit 證據重建)。plan 走 supervisor 4 輪(trigger 陣列、CI-011/012 與 step 同 commit、不讀 dirty main、baseline gate 檔案集合與單一 `--base`、review 節奏改全範圍;rev 3 路徑精確化與 30 條計數;rev 4 `ciSetupSteps` root schema)。
> **改動**:**33 檔 / 22 commits**(`git diff --name-only base..HEAD | wc -l` / `git rev-list --count base..HEAD`,含本 entry 前全部非 bookkeeping)。P0 歸檔 A1.1 entry 到 `progress-archive/progress-2026-09.md` + `EXPECTED_ADR_REFS` 同 commit(現 10 處);P1 `scripts/control-catalog.json` 正本(fail-closed loader,root 只准三鍵、`ciSetupSteps` 為權威豁免清單)→ 渲染 `docs/CONTROL-CATALOG.md` → `check:catalog`(路徑 tracked、ci.yml 雙向鎖、渲染逐位元組一致)+ CI step;P2 OVERVIEW 16 處行號與兩處「8 個 step」改指 catalog;P3 `check:baseline-governance` + CI step(pull_request only、`--base=origin/$BASE_REF`、同 repo 傳 `--head`、promotion 豁免讀 merge-base 那側 config)+ ADR 限制 1-3 處置 + 長命分支清理程序 + CTRL-GOV-003;P4 A5.ci.if;P5 `harness.config` schemaVersion 2 + `mergeStrategy`,4.6 改宣告式、刪關鍵字 regex;P6 0.2.0 + CHANGELOG + MIGRATION(回滾只留整段 revert)。**out of scope**:掃描器語意、B/C 系列、A2 defer ①–⑩、worktree 清理。
> **驗證(最終 tip 實測)**:typecheck / lint / **23 檔 851 passed + 2 skipped**(`npx vitest run`;2 skipped = 鎖測試 adopted 分支)/ doc-refs / doc-size(progress 11473 bytes)/ todos / no-source-terms / adoption(TEMPLATE_MODE、3 exception)/ **catalog(CATALOG_OK — 30 controls、16 steps、setup 4)**/ hooks 全綠;`check:baseline-governance --base=<frozen base>` UNCHANGED。**mutation**:control-catalog **14/14**、baseline-governance **11/11**、adoption-readiness **20/20** 綁 `7ec6b9ef528a609b1611f9aef73b31ed7ea8fbbc`;source-term **29/29** 綁 `563a2ae`(其後未動該掃描器)。探針五次「存活 / 無法判定」全是探針或測試自身缺口(M10 A7、BG-M5 env、BG-M6 樣本漂移、BG-M10 等價突變、BG-M11 測試分支名),各補後全抓。
> **審查**:Codex commit-only 3 輪(r1 P2:MIGRATION 回滾不可執行;rereview P2:路徑 B 引用 0.1 不存在的檔 → 只留整段 revert;r2 PASS)。**Step 5 worktree 審 5 輪**(每輪新 clone、40 字元 review-tip):r1 **4 C + 11 I**(下游 template 舊值假紅、E-self 硬編 SHA、GitFlow base 錯、無名 step 偷渡)→ r2 **2 C + 10 I**(兩條都在 r1 修法內:巢狀 `name:` 遮蔽、`--head` 文法假紅)→ r3 **1 C + 8 I**(豁免政策從 PR tree 讀 → 改讀 merge-base)→ r4 **0 C + 8 I**(文件漂移為主)→ r5 **0 C + 4 I,收斂**(Owner 裁示:無 CRITICAL 即停)。共 **7 CRITICAL 全修**、41 INFORMATIONAL 修 20、defer 21。cross-model agreement ≈ 0 再次驗證。
> **⭐ 教訓**:①**每一輪 CRITICAL 都出在前一輪的修法裡**(r2 兩條、r3 一條)——教訓⑥「修法自己長面」是本 sprint 主旋律;r3 那條(豁免名單從被守的 tree 讀)是「守門與被守物同源」的形狀,值得寫成 SOP 自檢句:「這個 gate 的政策來源,PR 改得到嗎?」②**gate 要在 `git add` 之後跑**:P6 的 T9 綠是因為 CHANGELOG 還沒 tracked;未 tracked 檔不在位置＋數量鎖內。③**探針 spec 是原始碼逐字樣本**,改碼後 mutate fail-closed 抓到三次漂移——正確運作,但要把「改碼 → 對 spec」放進 phase checklist。④**等價突變要辨識**(BG-M10 前一行已回 error,改壞無效);「存活」先問是不是等價,再補測試。
> **defer 清單**:TODOS P3「A3 Step 5 defer 集合」21 條(含 I3 模板自身 if 行、F-1 protectedBranches 擴大無警示、r5 #2–#4 訊息與測試覆蓋)。
> **⏭️ 下一棒候選**(hint 非 truth):A. Milestone B — B1 agent-neutral policy 與薄 adapter;B. TODOS P2#2 `DELIVERY_REFS=HEAD` / P2#3 mutation spec 漂移 CI 守門(本 sprint 三次踩到,實證有需求);C. A2 defer ①–⑩ + A3 defer 集合;D. Owner 打 `v0.2.0` annotated tag(merge 後)。
> **check:claims 逐條處置**:命中 29 處(CONTROL-CATALOG 6 / renderer 5 / loader 4 / json 3 / tests 4 / 其餘),**全部留 A**(「唯一正本」= I4 設計、「ID 唯一」= loader 驗、「沒有任何硬編 step 名」= grep 可證、「唯一輸入 --base」= argv 白名單、`never` 為 TS 型別、其餘為測試名 / 歸檔原文)。
> 📊 成本:CC ~14h / plan supervisor 4 輪 + Codex 3 輪 + Step 5 5 輪 + mutate 12 輪 / P1 0 / P2 2 / **Step5 獨立發現 48 個**(7 CRITICAL、41 INFORMATIONAL;修 27、defer 21)
> 📐 量測:主迴圈 claude-fable-5-1 effort low;Codex gpt-5.6-terra medium;baseline SHA `5832d9ed7b57c471dcb1a298ddf9245100529bb4`;來源分佈:既有缺陷 0・漏改 consumer 4(OVERVIEW 第二處 step 表、mutations README、CHANGELOG 數字、TODOS 正文)・baseline 後引入 44(其中 3 條 CRITICAL 由前一輪修法引入)
> **7 步 checklist**:1 ✅(rev 4)/ 2 ✅ supervisor 核准 / 3 ✅ P0–P6 每 phase 全綠 / 4 ✅ Codex r1–r2 收斂 / 4.5 ✅ 高風險車道,探針每輪重跑、最終綁 `7ec6b9e…` / 4.6 ✅ 未觸發 / 5 ✅ 五輪、r5 收斂(Owner 裁示)/ 6-7 待執行

> 更早的 entries:2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
