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

📅 2026-09-02 ① — **PR A2:Template／Adopted mode 宣告 + Adoption Readiness Gate(`check:adoption`)**

> **緣起**:優化方案 §6。A1.1 證明 runtime 判別式(`isTemplateRepo()`)判反、是斷路器、fail-open;G2/G4 仍把模板作者簿記套在採用者 `npm test`(TODOS P2#1)。supervisor 拍板:mode 是**單一 config 內的顯式靜態宣告、fail-closed 解析,禁止偵測 / heuristic / env override**。起手 git 核實 frozen base = `0c2e5e9de2a928c6be89f0bfd1e126d32aa1dbc1`,全程在乾淨 worktree `feat/a2-adoption-readiness`,dirty main worktree 未讀未動。plan 走 3 輪 supervisor review(rev 2:adapter 逐條斷言 / Part 4 精確內容 / A5 集合相等 / G2G4 行為級證據;rev 3:字面分支名文法)。
> **改動**:**20 檔、9 個非 bookkeeping commits**(`git diff --name-only base..9658af7 | wc -l` = 20;`git rev-list --count base..9658af7` = 11,其中 `9f79894`、`be7e30e` 經 `check-bookkeeping-commit` 判為 bookkeeping,11 − 2 = 9)。新 `scripts/harness.config.json`(schemaVersion 1、出廠 template)+ `scripts/lib/harness-config.ts`(無 fallback、無正規化;未知欄位 / schema / mode / 空陣列 / 重複含 case-fold / delivery ⊄ protected / 未知 adapter 一律 throw;`literalBranchNameViolation` 拒 glob / ref-prefix / 空白 / 引號 / 管線 / 控制字元)。新 `scripts/check-adoption-readiness.ts`:template T1–T9(逐條印 `template exception`、首行不含 READY)/ adopted A1–A8(projectId、Part 4 四段精確規則交叉比對 package.json 與 tracked 檔、五域 pattern XOR N/A、destructive placeholder、四來源分支集合精確相等且來源 token 也過文法、逐 adapter 斷言、CI 行、CODEOWNERS);exit 0 / 2。`cso-trigger.config.ts` 加 `CSO_NOT_APPLICABLE`;`check-cso-trigger.ts` 不改。新 `scripts/lib/template-governance.ts`:原 G2/G4 搬成純函式、只在 template 由 T9/T8 執行,vitest 刪 G2/G4。`check-cso-trigger.test.ts` 路徑表鎖改 always-on 依宣告 mode 分支。CI 加 `Adoption Readiness Check`。CLAUDE.md Part 4 註解改成可機驗格式說明(仍是骨架);ADOPTION §0 / §2 / §3 / §5 / §6 / §11。**out of scope**:baseline 不併入 config、hooks 行為、`if:` event 過濾、A3 catalog、P2#2 / P2#3 / P3。
> **驗證**:typecheck / lint / 19 檔 **756 passed + 2 skipped = 758**(base 16 檔 / 577;2 skipped = 鎖測試的 adopted 分支,屬設計)/ doc-refs / doc-size / todos / no-source-terms / `check:adoption`(本 repo 自證:TEMPLATE_MODE、3 exception、exit 0)全綠。**mutation 16 條全數被抓**,`npx tsx scripts/mutate.ts --spec scripts/mutations/adoption-readiness.json`(`--cmd` 縮到四支相關測試檔)exit 0,綁 `b52701ac0445c56e66ebff3e2dc5fcae5bc7a24f`。第 1 輪 M10(ADOPTED_CHECKS 拿掉 A7)**存活**——adopted 側沒有任何測試在 ci.yml 缺 check:adoption 行時斷言 A7;補單元 + e2e 負對照後第 2 輪 16/16。
> **安全關**:`check:cso` 表空 fail-closed = 模板例外;人工判定新增守門碼 + 改 CI + 改 CLAUDE.md → **高風險車道**(探針 exit 0 已綁 SHA;Step 5 worktree 審待 Codex commit-only review 之後)。視覺關未觸發。
> **審查**:**Codex commit-only 2 輪**:r1 0 P1 + 1 P2(entry 檔數「11」是推論值,實測 18)→ 修 → r2 0/0 收斂(Codex 另獨立重跑 full suite 與 16 條探針)。**Step 5 worktree 獨立審 3 輪**(每輪全新拋棄式 clone、review-tip 40 字元核對、reviewer 皆實跑 fixture / 變異):r1 tip `be7e30e…` **0 C + 13 I**(修 I1 檔頭舊說法 / I2 A6.claude.link 可被 HTML 註解糊弄 / I4 `Firebase` 命中 `rebase`;10 條 defer)→ r2 tip `aeb65e5…` **0 C + 5 I**(F1:r1 加的 `\b` 讓 `squashed` / `merge commits` 假紅——**修法自己長出的面**;修 F1 / F2 ff 寫法 / F4 措辭 / F5 OVERVIEW 舊說法;F3 defer)→ r3 tip `9658af7…` **0 C + 6 I**(全 conf ≤6:4.6 關鍵字檢查對否定句 / URL / 時態變體的邊角)→ **停:4.6 是關鍵字存在檢查、不是語意解析,再修只會換一組邊角;6 條 defer**。cross-model agreement:Codex 抓簿記數字、Step 5 抓守門邊角,零重疊。
> **⭐ 教訓**:⓪**寫 entry 時三次寫了沒實測的數字**(「821 tests」實測 758;「11 檔」實測 18;「10 commits」是加 commit 前量的,Codex 兩輪各抓一次)——每個數字要在**最後一支 commit 之後**重量、把指令與輸出值一起寫進 entry。①**探針又一次打臉推論**——我「確定」A7 有測試守,其實只在 template 側(T6)有;M10 存活是唯一的證據來源。②**G2/G4 這類「模板作者簿記」正確歸宿是 checker 的 template 分支,不是 vitest**——搬過去後採用者不再被模板簿記擋,而模板自己每次 CI 照樣跑。③**來源側 token 也要過同一份文法**——rev 2 把 glob 分離成 info 看似無害,`main*` typo 會被當 info 吞掉;白名單 + fail 才是對的。
> **defer 清單**:Step 5 三輪共 17 條 INFORMATIONAL(conf ≤6)登 TODOS P3「A2 Step 5 defer 集合」。
> **⏭️ 下一棒候選**(hint 非 truth):A. PR A3(Control Catalog,收 ADR 已知限制 1-3 + `if:` event 過濾 conformance + 兩條 A1 defer);B. TODOS P2#2(`DELIVERY_REFS=HEAD`)/ P2#3(mutation spec 漂移 CI 守門);C. P3 三條。
> **check:claims 逐條處置**:命中 14 處(README 1 / ADOPTION 2 / checker 3 / loader 1 / tests 7),**全部留 A**:「唯一允許的 glob」= 白名單恰一項;「唯一機器判準」= 設計上只有 check:adoption 出具;always-on = 測試無條件執行、skip 由宣告值決定;`never` 是 TS 型別;其餘為測試名稱 / fixture 文字 / 既有 README 行。
> 📊 成本:CC ~6h / plan supervisor 3 輪 + Codex 2 輪 + Step 5 3 輪 + mutate 4 輪 / P1 0 個 / P2 1 個 / Step5 獨立發現 24 個(0 CRITICAL、修 7、defer 17)
> 📐 量測:主迴圈 claude-fable-5-1 effort low;Codex gpt-5.6-terra medium;Step 5 為 Claude 對抗性 subagent;baseline SHA `0c2e5e9de2a928c6be89f0bfd1e126d32aa1dbc1`;來源分佈:既有缺陷 0・漏改 consumer 3(cso 檔頭、OVERVIEW、TODOS 正文)・baseline 後引入 22(其中 r2 F1 是 r1 修法引入)
> **7 步 checklist**:1 ✅(rev 3)/ 2 ✅ supervisor 核准 / 3 ✅ 8 commits 每 phase 全綠 / 4 ✅ Codex r1-r2 收斂 / 4.5 ✅ 探針 16/16 每輪重跑、最終綁 `9658af70f4f6f6687846d1ed0325b6685179c5b8` / 4.6 ✅ 未觸發 / 5 ✅ 三輪收斂(review-tip 最終 `9658af7…`)/ 6-7 待執行

> 更早的 entries:2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
