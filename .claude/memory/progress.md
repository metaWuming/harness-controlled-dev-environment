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

📅 2026-09-05 ⑧ — **P2#2 defer ⑨:LESSONS.md 加版本界線 blockquote(不重寫歷史敘述、避免讀者誤跟批 6 舊四條 delivery-ref 來源)**

> **緣起**:TODOS.md「P2#2 Step 5 defer 集合」⑨ 條目(conf 5):「`.claude/memory/LESSONS.md` / `docs/OVERVIEW.md` 仍寫四條來源與舊 env 語意(LESSONS 屬治理內容需完整 SOP)」。#67 P2#2 defer ③ squash 後、Codex supervisor w6:p4 gpt-5.6-terra 拍板本 sprint = A-⑨ 單條、標準車道(governance documentation);frozen full base `243f12c4dce693be4df23a67d6ddf6912259ba1b`(origin/main tip = #67 squash);shared local main 仍在 233858f + CLAUDE.md M(全程不 pull/touch)。plan review r1-r5(4 次修訂、r5 APPROVE:r1 D2「有 hit 就進 scope」+ D8 pre-Step 5 gate + Context/Impact/D9 line pin;r2 D8 4 段時序 + inventory 分類覆載;r3 D2 inventory 分類 wording verbatim;r4 檔內 3 處殘留 line pin 除;r5 全除、APPROVE + GO Step 3)。
> **改動**:**Phase 1 atomic 1 檔**(+3/-0、tip `feccfcc1caf8940ccd7340287389cb049232a316`):`.claude/memory/LESSONS.md` 於「self-PR # citation 三處撞去識別化 denylist」教訓的「workflow yml 修法」項 bullet 完整結束後、「教訓階梯升級」bullet 之前,加獨立 blockquote(標題「版本界線(僅限交付證據來源)」)。**Step 5 F1/F2/F4 fix commit**(+1/-1、tip `9cee1741ff48197701d72d786af7e9ff6fbe05f1`、single-line replacement):F1 anchor 從只覆蓋末段擴到「上一項『workflow yml 修法』所描述的『三處同步』(包含傳入 `DELIVERY_REFS`)與『script 本身用四條來源』」;F2「不會 fallback 到固定的 `origin/develop` 或任何本地分支」verb-first;F4 隨 F1 去「末段」positional word。**D2 inventory 分類結果**:6 份 active governance docs(README/CLAUDE/ADOPTION/MIGRATION/OVERVIEW/current LESSONS)pattern `DELIVERY_REFS|四條來源|origin/develop.*fallback|本地 main/develop.*fallback` 唯讀掃——`docs/MIGRATION.md`(3 hits 為 [Unreleased] migration/history 敘述、current-accurate)+ `docs/OVERVIEW.md`「交付證據來源與 workflow-level env」段(current-accurate)全 KEEP 無 diff。**#67 overclaim 校正**:#67 squash subject 稱「集合 closed」;實際 #67 僅交付 ③;本 sprint 前仍餘 ⑤⑦⑨、本 sprint 收 ⑨ 後 P2#2 defer 集合 剩 ⑤⑦(不改歷史 commit subject)。**禁區守住**:LESSONS 歷史敘述(批 6 workflow yml chronology / round 1-6 review 收斂 / 教訓階梯升級 bullet)byte-for-byte 保留、`docs/MIGRATION.md` / `docs/OVERVIEW.md` / `scripts/lib/delivery-refs.ts` / delivery-refs consumers / runtime / CI / catalog / mutation specs / SOP 全 0 line 動;shared main / CLAUDE.md M / 3 支 stash / 保留 worktrees / remote 全程 0 動。
> **驗證(worktree wt-p2p2-defer-9-lessons-history 內、fix tip `9cee1741` 上實測、非 preflight)**:git diff 243f12c..9cee174 --stat 1 檔 +3/-0(folded);typecheck (`npx tsc --noEmit`) 綠;lint (`npm run lint`) 綠;`npm run check:doc-size` progress.md 15.6 KB / 20 KB(78%)、LESSONS.md 24.2 KB / 60 KB(40%);`npm run check:todos` 11 個 PR 完成宣稱、11 個 merged、0 失效;`npm run check:doc-refs` 616 refs、0 失效;`npm run check:claims --base=origin/main` 3 新增行、0 命中;`npm run check:mutation-specs` 12 spec 130 條探針對得上、無 drift;`npm run check:catalog` CATALOG_OK 32 controls;無 code 改動、npm test 未跑(governance docs only)。
> **審查**:Codex plan review 5 rev(r1-r5、逐輪校正 D2 inventory 分類 / D8 4 段 gate 時序 / Impact radius / 各處 line pin);Codex Step 4 commit-object review 對 Phase 1 tip `feccfcc` **APPROVE**(獨立 clean clone、frozen base/tip、6 項逐條 clean:ancestry / diff scope 1 檔 +3/-0 / blockquote 位置 / wording 對齊 r1 APPROVED / 禁區未觸及)+ 對 Step 5 fix tip `9cee174` **APPROVE + 進 Step 5 round 2**(F1/F2/F4 消除、F3/F5 未夾帶、historic bullet byte-for-byte 保留)。Step 4.5 CSO 標準車道人工判定 CSO_NOT_REQUIRED。Step 4.6 未觸發。Step 5 adversarial round 1 **0 CRITICAL / 5 INFORMATIONAL**(F1 conf 6 anchor 只覆末段 / F2 conf 5 中文歧義 / F3 conf 4「pull request 編號 49」與 (#N) 格式偏差 / F4 conf 3「末段」fragile anchor / F5 conf 2 MIGRATION 對稱 see-also);supervisor 分類:**F1/F2 FIX**(F4 隨 F1)、**F3 KEEP**(denylist-safe 冗餘敘述刻意保留)、**F5 KEEP**(MIGRATION current-accurate 無需對稱);round 2 rereview **0 actionable**、F1/F2/F4 全消除、F3/F5 未夾帶、historic bullet byte-for-byte 保留、新句與 `scripts/lib/delivery-refs.ts` 現行契約 + `docs/MIGRATION.md` 附錄 A.1 一致。
> **⭐ 教訓**:①**「不重寫歷史敘述、只加版本界線」是 governance docs 校正歷史文件的最小 surgical pattern**——歷史事件 chronology / review 收斂邏輯保留(讀者理解 pattern 演變來龍去脈);版本界線句 verbatim 明列 stale operations + 指向 current SSOT + 換交付線需 MIGRATION runbook。②**Adversarial anchor 檢查**:F1 抓「blockquote anchor 只覆末段」= 讀者從 bullet 中段照做 stale = 誤跟;修法 anchor 擴到「三處同步(含 DELIVERY_REFS)與 script 四條來源皆為批 6 當時實作」——boundary span 對齊 stale operations span。③**中文 fallback 語意動賓結構**:F2 抓「不使用 X 或 Y fallback」二義;verb-first「不會 fallback 到 [X 或 Y]」讓 X/Y 明確共享同一動詞範圍。④**「pull request 編號 N」verbose vs 「(#N)」格式紀律**:兩 SOP 意圖各成立、supervisor 拍板 KEEP verbose——blockquote 完整敘述避 quote-out-of-context 誤讀、格式紀律 bullet 針對簡潔 self-PR 引用;不必統一。⑤**D2 唯讀 inventory 分類**(current-accurate / migration-history / stale current-guidance 三分)是 governance docs cross-check 的最小成本 pattern——避免把正確的 migration 說明誤當漂移擴 scope。⑥**Plan-review 5 round 收斂 = review-round 遞迴的成本**:r1 抓 3 大類、r2/r3 抓分類 wording、r4/r5 抓 line pin 殘留;下次改進 = plan 首稿即用「耐久錨點 + inventory 分類 wording」pattern。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A. P2#2 defer 剩 2 條(⑤ tag DoS conf 6 / ⑦ harnessConfigJson 重複 conf 6);B. A3 Step 5 defer 剩 19 條 INFO conf ≤7;C. A2 Step 5 defer 17 條 INFO conf ≤6;D. A1.1 defer 23 條 conf ≤7 doc governance;E. 單條:grep.column NUL 錯位(conf 8、0.5-1h)/ mutate.ts SIGTERM 不還原(conf 8、1h、P3);F. Milestone B1(新開)。
> **check:claims 逐條處置**:0 新命中(base=origin/main、governance docs 修無絕對化宣稱句加入 blockquote wording)。
> 📊 成本:CC ~2h / 跨模型 review 10 rounds(plan review r1-r5 5 rounds + Step 4 commit-object + Step 4 rereview + Step 5 adversarial round 1 + supervisor 分類 + Step 5 round 2 rereview)/ P1 0 個 / P2 0 個 / Step5 獨立發現 5 個(0 CRITICAL / 5 INFORMATIONAL、F1/F2/F4 修 / F3/F5 KEEP)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、governance docs 單一 blockquote 修);Codex gpt-5.6-terra medium(w6:p4)plan review r1-r5 + Step 4 x2 + Step 5 x2 approve;baseline `243f12c4dce693be4df23a67d6ddf6912259ba1b`;來源分佈:既有缺陷 1(LESSONS.md 段末四條來源以 current-guidance 口吻寫、與 P2#2 移除後現行契約矛盾、defer ⑨ 條目登錄時已存在)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan review r1-r5(4 次修訂、r5 APPROVE)+ D2 inventory 分類 + D8 4 段 gate 時序 + Step 5 6 步 checklist / 2 ✅ Codex r5 APPROVE + GO Step 3 / 3 ✅ fresh worktree(wt-p2p2-defer-9-lessons-history)+ D2 inventory 分類(MIGRATION/OVERVIEW KEEP、LESSONS 修)+ Phase 1 atomic 1 檔 commit(`feccfcc`)+ Step 5 F1/F2/F4 fix commit(`9cee174`)/ 4 ✅ Codex Step 4 對 `feccfcc` APPROVE + 對 fix tip `9cee174` APPROVE / 4.5 ✅ CSO 標準車道人工 CSO_NOT_REQUIRED / 4.6 ✅ 未觸發 / 5 ✅ adversarial round 1(F1/F2/F4 修、F3/F5 KEEP)+ round 2 rereview(0 actionable) / Phase 2 加 ⑧ + archive ⑦ 至 progress-2026-09 + TODOS ⑨ ✅ + PR 引用位待 Step 6 補號 + entry-count conservation:base archive 23 + current 1 = pre 24;新增 ⑧ 後 total 25;archive ⑦ 至 archive 後 archive 24 + current 1 = post 25、每 entry 恰 1 次 / 6-7 待執行(Owner sprint-loop 授權)

> 更早的 entries:2026-09-05 ⑦ P2#2 defer ③、2026-09-05 ⑥ P3 delivery-refs 移除集合 ①+②、2026-09-05 ⑤ P2#3 defer ⑮、2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
