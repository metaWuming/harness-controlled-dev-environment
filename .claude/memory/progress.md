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

📅 2026-08-29 ① — **PR A1:主線通過自身 source-term gate(baseline cutover + downstream fork 相容 + patch-scan 加固)**

> **緣起**:Codex 產出的優化方案(版控外的規劃文件)拆出的第一個 PR;設計正本已落地為 repo-local ADR `docs/architecture/source-term-history-baseline.md`「決策」。主線 `check:no-source-terms` 紅:`scripts/check-doc-refs.ts:241` 註解與 6 個歷史 commit 的 blob 都含來源專案識別詞、不能重寫公開歷史卻要讓 gate 綠。起手 git 核實:HEAD = origin/main = plan 內 baseline 641065... 完全對齊、baseline 是 HEAD 祖先(等值)、`.codegraph/` + `.gbrain-source` 兩 untracked 保留不刪不 add。
> **改動**:5 檔 —— `scripts/check-doc-refs.ts`(單行註解去識別化,來源專案識別詞 → 中性敘述「下游採用者專案」);`scripts/source-term-baseline.json`(新、schemaVersion=1、`template:641065...` prefix + `_comment` 說明治理);`scripts/check-no-source-terms.ts`(+新純函式 `parseBaselineConfig` / `validateBaseline` / `extractAddedLinesFromPatch` / `scanRevDiff` / `scanBaselineToHeadDiffs`,`BaselineDecision` 三態 ok/template-fallback/fail;`scanGitHistoryBlobs` baseline 給 → per-commit diff scan、null → tree scan 舊行為 / D3-D4 相容;main 三態分派、印 history scan range);`tests/check-no-source-terms.test.ts`(+18 條:P1a-P1i / P1x / P1y / P1z / P1z2 / P1yy / P1zz / P1zz3-9 + `extractAddedLinesFromPatch` 6 條單元);`.github/workflows/ci.yml`(檔頭 + Source-term step 註解:gitleaks 全史 vs source-term baseline cutover 兩條獨立政策)。**out of scope**:PR A2 之後全部項目、不重寫 main history、不刪 denylist、不加全域 allowlist、不改 commit-msg hook、不刪 untracked。
> **審查**:**Codex CLI 6 rounds、9 條 findings 全修**(R1 P1 template pinning + P2 unchanged blob tree-scan 誤報 / R2 P1 template-fallback 永久 skip + P1 patch parser 沒 strip / R3 P2 combined merge-diff + P2 test 隔離 + P3 敘述漂移 / R4 P2 shallow clone 誤降級 / R5 P1 rename dance + P1 .gitattributes -diff / R6 P1 NUL byte binary 短路 + P2 merge grandfathered 誤紅);**R7 剩一條 P2 false positive**(long-lived pre-baseline branch merge 誤紅 cleanup PR),**Owner 拍板 A defer 給 A3**(control catalog 治理層)——理由:非 release blocker、非漏抓、A1 scope 只做 self-verification 不做 baseline governance 機器化。**安全關 4.5** `check:cso` fail-closed(表空)→ 模板 repo 例外人工判定**不進高風險車道**(本 PR 不動 auth/migration/守門碼修改語意、只加去識別化 gate 的 baseline 支援)。**視覺關 4.6** 未觸發(無 UI 檔)。**Step 5** adversarial-reviewer fresh 審(非驗 codex 結論、從 diff 出發):0 CRITICAL / 6 INFORMATIONAL,conf ≥ 6 一條(治理旁路)defer 給 A3、conf 4 一條(grep `-n` 假 line number)+ conf 3 一條(scanCommitMessages 沒 mirror `-a`)順手修、conf ≤ 3 其餘 3 條 skip。cross-model agreement ≈ 0(codex 抓 patch-scan 邊角、adversarial 抓治理層與品質)再度驗證。
> **驗證**:typecheck / lint / test 16 檔 484 passed / check:no-source-terms 主線綠 / check:doc-refs 237 引用 0 失效 / check:doc-size / check:hooks / check:todos / mutation probe 1 條(拿掉 `validateBaseline` ancestor 檢查 → P1e 立刻轉紅 → 手動 kill 成功後還原)。
> **⭐ 教訓**:①**「tree scan → diff scan」語意轉換打開整個新攻擊面家族**——patch format 的 rename detection / -diff attribute / NUL byte / combined merge / --first-parent / shallow / 檔頭 vs hunk 分界 逐輪被抓,6 輪修完仍有 R7 邊角。這說明**選 diff-based 就要承擔全部 diff-format 攻擊面**;A3 之後可考慮「baseline..HEAD tree scan + 對 baseline tree 求差集」的混合模式(見上方 defer 說明)。②**Codex CLI `--base` 是「跨輪固定」不是「每輪往前推」**(round 1 base=origin/main、round 3 base 用了 round 2 fix 完的 SHA → codex 說 diff empty)——SOP Step 4「送第一輪之前先固定 baseline」的 baseline 只用來分類 finding 來源、每輪 review 送審對象都是 origin/main..HEAD 整支 branch。check:claims 的 base 才是「上一輪送審 HEAD」推進。③**commit-msg hook 是 defense-in-depth 的最後底線**——第一次改 commit message 時把來源專名原樣寫進訊息、hook 立即擋、逼我改中性描述;這正是模板 hook 的 dogfood。④**Feature branch 內部 reset --soft 是允許 SOP**(memory `feedback_branch_squash`)——原 Phase 1 test commit 在前、blob-scan 語意讓「未動的 check-doc-refs 版本」被抓,reset --soft origin/main 後把 Phase 3 fix(來源專名去識別化)排最前解決;後來 R1 P2 修完(改 diff-scan)後這個順序約束消失,但已 reorder 就不再翻。
> **⏭️ 下一棒候選**(hint 非 truth):A. PR A2(Template/Adopted mode + Adoption Readiness Gate);B. PR A3(Control Catalog——順帶收乾 R7 baseline 治理旁路 + long-branch merge 誤紅 corner case);C. weekly health check 累積本 sprint 6-round cost metadata(supports docs/EFFORT.md sweep)。
> **check:claims 逐條處置**:命中總計 5 處全留 A —— round 4 diff 1 處(`.codegraph/.gitignore` 外部工具檔文字「never」);round 5-6 diff 各 0/1(同上外部工具);Step 5 adversarial 之後 diff 3 處(check-no-source-terms.ts:1004「只有全史掃才抓得到」= 洗白場景其他三段皆不抓中間 blob、集合可列;`.gitignore` 兩處外部工具檔)。0 降級 B。
> 📊 成本:CC ~4h / Codex review 6 rounds + defer R7 / P1 6 個 / P2 6 個 / Step5 獨立發現 6 個(0 CRITICAL、5 收 3 修 2 skip / 1 defer 給 A3)/ 累計 15 findings 內 9 修 + 3 順手 + 3 skip + 1 defer。
> 📐 量測:主迴圈 claude-opus-4-7 預設 effort / Codex r1-r7 non-interactive medium / adversarial-reviewer default / baseline SHA:`3f3616e`(Step 4 送第一輪前 HEAD;origin/main + Phase 1-4 的最後一 commit)/ 來源分佈:初始 patch 內既有缺陷 2(R1 P1 template pinning + R1 P2 tree-scan 誤報,直接 diff scan 換架構帶進來的家族第一批)・初始 patch 漏改的外部 consumer 0(commit-msg hook 是獨立 code path、不受本 PR 影響)・baseline 後新增/修改引入 7(R2-R6 全部 7 條 P1/P2 都是「R1 P2 修法引入 diff-scan 之後」的 patch-format 攻擊面 + Step 5 adversarial 6 條 informational 中 3 條處置)。
> **7 步 checklist 狀態**:1 ✅(plan file `~/.claude/plans/pr-a1-main-self-verification.md`;含 impact radius / 正反契約 / mutation / 相容性 / rollback / D1-D7 sensible defaults)/ 2 ✅(D1-D7 全 sensible default、無真實 trade-off、直接進 3)/ 3 ✅(Phase 0-4 + reorder 後 3 個 fix source-term/config-checker/test commits + R1-R6 fix commits + Step 5 順手修 = 12 commits;每 phase gate 綠)/ 4 ✅(6 rounds 修 9、R7 defer 給 A3、Owner 拍板 A)/ 4.5 ✅(fail-closed 模板例外 + 人工不進高風險車道)/ 4.6 ✅(未觸發)/ 5 ✅(adversarial fresh 收 3 修 1 defer 2 skip)/ 6-7 待執行

📅 2026-08-28 ⑥ — **批 12:health-history 首週產出兩檔進 git + archive 批 9(順手)**

> **緣起**:Owner 讀批 11 收工報告後說「順手把 health-history 進 git」。批 8-10 sprint 期間跑過的 `npm run health:weekly` 首週 snapshot(2026-W35.md + .json)一直 untracked、本 sprint 收乾。順帶 archive 批 9 到 progress-archive(progress.md 上 sprint 已 96.5%、必須先 archive 才能加本 entry 不超上限)。
> **改動**:5 檔 —— `.claude/memory/health-history/2026-W35.{md,json}` 新加進 git;`.claude/memory/progress.md` 拿掉批 9 全文 + 加本 entry;`.claude/memory/progress-archive/progress-2026-08.md` append 批 9 全文(pattern 對齊批 8/9 sprint 的 archive 動作)。
> **審查**:pure-bookkeeping sprint(Owner「順手」= minimal path)——跳 Step 4 codex / Step 5 adversarial(無 code、無新機制、無守門變化)。**安全關 4.5** `check:cso` fail-closed(表空)→ 純 memory 層檔案 → 模板 repo 例外**不進高風險車道**。**視覺關 4.6** 未觸發。⚠️ **check:bookkeeping HEAD~1** 對 Phase A commit 判 non-bookkeeping(health-history/ 不在 EXACT_ALLOW / ARCHIVE_DIRS)——屬預期、advisory-only 現況不擋 CI(批 5 已定 hard-gate 觀察窗);累積 3-5 sprint 誤報數據後再決定是否擴 allowlist 收 `.claude/memory/health-history/*.{md,json}`。
> **驗證**:typecheck / lint / dogfood 綠;check:doc-refs 綠(全 memory 層無跨檔引用改變);check:doc-size 應綠(archive 批 9 讓 progress.md 從 96.5% 大幅下降)。
> **⭐ 教訓**:①**「順手」sprint 也要走 sprint 紀律**——Owner 說順手 ≠ 跳 progress entry / bookkeeping、只是跳 Step 4/5 review 輪。若跳 entry、未來 audit 這批 health-history 首檔怎麼進 git、只能靠 git blame 猜(不可靠)。②**progress.md 額度警戒**(96.5% → 這 sprint 觸發 archive)——早該在批 10 或批 11 之一 archive,拖到批 12 才順手做。教訓:每 sprint 收尾 check:doc-size 若 >90% 立即順手 archive、不留給下棒。
> **⏭️ 下一棒候選**(hint 非 truth):A. 擴 check-bookkeeping allowlist 收 `.claude/memory/health-history/*`(等 3-5 sprint 誤報數據累積後、避免過早 optimize);B. 跑第 2 週 health:weekly 產 W36 對照 baseline(累積 3-5 週看趨勢);C. TODOS 目前 pending = 0、若無新 Owner 指示、進入 fresh cycle 等健康指標 or 新踩坑觸發。
> **check:claims 逐條處置**:0 處(check:claims dogfood 對本 sprint diff 綠)。
> 📊 成本:CC ~15 min / Codex 0 rounds / Step5 0 輪 / P1 0 個 / P2 0 個 / 累計 0 findings。
> 📐 量測:主迴圈 claude-opus-4-7 預設 effort / bookkeeping-only 無 code baseline。
> **7 步 checklist 狀態**:1 ✅(對話拍板)/ 2 ✅(Owner「順手」拍板)/ 3 ✅(2 phase atomic commits:Phase A health-history + Phase B archive+entry)/ 4 ⏭️ skip(bookkeeping-only)/ 4.5 ✅ / 4.6 ✅(未觸發)/ 5 ⏭️ skip(bookkeeping-only)/ 6-7 待執行

📅 2026-08-28 ⑤ — **批 11:加 docs/OVERVIEW.md 深度總覽 + README pointer**

> **緣起**:Owner 讀完批 10 收工報告後、看到 outputs/ 產出的深度說明文件(md + 離線 HTML 版含 5 張 inline SVG 流程圖),提議「這份可以擺 GitHub 讓考慮用的 user 有更完整理解」。我建議選項 A(把 md 挪進 docs/OVERVIEW.md、去掉日期、加 SSOT 錨定、README 加 pointer),Owner 拍板 go A。
> **改動**:2 檔 +927 —— `docs/OVERVIEW.md`(從 outputs/ 蒸餾、去日期、加 SSOT 錨定檔頭「若與 CLAUDE.md / SOP checklist 有出入以那兩份為準」、markdown link 改 docs/ 相對路徑);`README.md` 英中兩處「What is this / 這是什麼」段末加 pointer block 指向 OVERVIEW(措辭「評估要不要導入本模板的讀者建議先讀這份」)。**out of scope**(留給下棒 sprint):`.claude/memory/health-history/` 首週產出兩檔仍 untracked,屬 memory 層自然產物、下次 sprint 一起收乾。
> **審查**:docs-only 情境、走簡化 SOP —— 跳 Step 4 codex review(明確 pattern、無新機制)、跳 Step 5 adversarial(Owner 明說「批 10 全部結束」政策延續、conf ≥ 4 一律修 conf ≤ 3 skip、doc-only 屬 skip 帶)。全 gate 綠即進 Step 6。**安全關 4.5** `check:cso` fail-closed(表空)→ 純新增 doc + README 段落、無 auth/金流/個資/權限/資產轉移 → 模板 repo 例外**不進高風險車道**。**視覺關 4.6** 未觸發(無 UI 改動)。
> **驗證**:typecheck / lint / check:doc-refs 239 引用 0 失效(新增 63 條全對得上、check-doc-refs 用 repo-root 相對解析所以 backtick 文字引用 `docs/xxx` 從 docs/OVERVIEW.md 位置仍 resolve 對)/ check:no-source-terms / check:doc-size progress 76% LESSONS 27% / check:todos 4 個 PR 4 個有 merge / check:claims 14 hits 全留 A(見下)。
> **⭐ 教訓**:①**deep doc 定位 = SSOT 摘要不是正本**——避免變成第 4 份 authoritative 文件(CLAUDE.md、SOP checklist、docs/ 個別檔已是 SSOT);OVERVIEW 檔頭明列「若有出入以那兩份為準」+ 定期同步、可能落後最新 sprint 的免責。②**backtick 文字路徑跟 markdown link 語意不同,check-doc-refs 都會抓**——好處是文字引用也能被守門,壞處是 outputs/ 版原文的 `docs/xxx` 全 repo-root 相對格式若碰到 file-relative 解析的 checker 會全爆(本 checker 用 repo-root 所以 work)。③**Owner 拍「不再 defer」政策的自然延伸**是 sprint 大小自我調節——doc-only 該用 docs-only 判準跳 review 輪、不硬套 batch 8-10 那種 conf 判定;Owner 建議、我拍推薦選項 A(不是 B 選項的拆多份)、5 min 完成、體現 sprint 大小應 fit 內容不是 fit SOP。
> **⏭️ 下一棒候選**(hint 非 truth):A. `.claude/memory/health-history/` 首週產出兩檔進 git(小 sprint、順手);B. 跑 `npm run health:weekly` 產第 2 週對照 baseline(累積 3-5 週後看趨勢);C. 若批 11 之後有導入實績、收「導入者 30 分鐘完成」實測數據補強 QUICKSTART。
> **check:claims 逐條處置**:命中 14 處全留 A —— L45「每一次」/ L77「唯一」/ L82「永遠不」/ L130「絕不」/ L222「永遠不 / 幾乎不」/ L379「唯一」/ L526 三處「只有 / 唯一 / 各自都足夠」+ L774「只有」/ 其他 3 條同批 —— 全屬引 SSOT 錨定既有敘述(CLAUDE.md 核心哲學、DEGRADATION.md 明列事實、check:claims 自身量詞範例引用)、非新宣稱、批 5 已處置過同批 pattern(README 那次)。0 降級 B。
> 📊 成本:CC ~0.5h / Codex 0 rounds(docs-only skip)/ Step5 0 輪(同) / P1 0 個 / P2 0 個 / Step5 獨立發現 0 個 / 累計 0 findings。
> 📐 量測:主迴圈 claude-opus-4-7 預設 effort / doc-only 無 code review baseline / 來源分佈 N/A(純新增 doc、非既有面改動)。
> **7 步 checklist 狀態**:1 ✅(plan 直接用對話拍板)/ 2 ✅(Owner「go A」拍板選項)/ 3 ✅(單 phase 一 commit)/ 4 ⏭️ skip(docs-only)/ 4.5 ✅(不進高風險車道)/ 4.6 ✅(未觸發)/ 5 ⏭️ skip(docs-only)/ 6-7 待執行

> 更早的 entries(2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
