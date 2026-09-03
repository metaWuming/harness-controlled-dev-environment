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

## 🤝 hi5 交棒紀錄 — 2026-09-03 13:08
- 交棒時 commit:`454c3325e2dbc1f8882a045caaadc52c76bf0611`(main;PR #53 squash;工作樹乾淨、無 WIP)
- 交接檔:`_handoffs/HANDOFF.md`(本機檔、`.gitignore` 忽略)
- 暫停點:下一 sprint 已由 Codex supervisor 拍板 = P2#3 defer ⑤(mutation-spec discovery)、Step 1 plan mode、read-only 蒐證尚未啟動;Owner「plan approve = go」持續授權

📅 2026-09-03 ⑥ — **A3 defer ⑩:CTRL-CI-014 protectedBranches drift gate(strict fail-closed、無 PR-controlled bypass)**

> **緣起**:TODOS A3 defer 集合 ⑩(conf 6):`protectedBranches` 集合擴大無 gate 警示、promotion 豁免健全性依賴人審 + branch protection(GOV-005 advisory)。Owner + supervisor 2026-09-03 拍板本 sprint 挑此**單條**(不併其餘 20 條)。frozen base `7c32fd6b81a4f45b08b6b7ce20cb35082ad33b0b`(main post-⑤ defer ③ 收條)。plan 5 rev(rev2 P1-1 刪 PR-controlled marker/opt-out、P1-2 trust-boundary mb 兩側讀 + 既有 parser、P1-3 CI 跑所有 pull_request 不縮窄;rev3 P1-A CI --base=immutable base.sha、P1-B if 唯一 event 條件;rev4 P1 YAML structural test 非 grep;rev5 純同步收剩)。
> **改動**:**8 檔 / 9 commits**(rev5 5 functional + Phase 4 補 DP-M6 killer + round 1 P1 SHA 驗 fix + Step 5 F2/F3 收 + Phase 6 bookkeeping)。新 `scripts/lib/protectedbranches-drift.ts`(diffProtectedBranches 純函式 + 12 unit) + `scripts/check-protectedbranches-drift.ts`(strict CLI、IMMUTABLE_SHA_RE = /^[0-9a-f]{40}$/ 拒 branch ref/短 SHA、mb = merge-base 兩側 `git show <mb>:...` + `git show HEAD:...`、既有 parseHarnessConfig 驗、added > 0 永遠 exit 2 無 marker、任一 fail exit 2) + 13 e2e 真 git fixture case(相同/擴大/縮小/重排/mb 側缺 config/HEAD 缺/JSON 壞/mb fail/argv 錯/大小寫 parse-failure/--base=HEAD/origin/short SHA) + 4 structural test(依 step name 定位 YAML list-item、驗直接子層 `if` 逐字 = `github.event_name == 'pull_request'`、`run` 含 `${{ github.event.pull_request.base.sha }}`)。`.github/workflows/ci.yml` 加新 step「Protected Branches Drift Check」(唯一 pull_request event、immutable base.sha、checkout 頂層 fetch-depth: 0 已保證 mb object);`scripts/control-catalog.json` 加 CTRL-CI-014 hard-automated + 6 檔 implementation + notes 明列 trust-boundary(CTRL-GOV-005 advisory **保留不動** rev5 P2-1);`scripts/mutations/protectedbranches-drift.json` 8 mutant(DP-M1~M8:added 判空、diff 對稱、CI condition、mb fail、parse 吞、caller-wiring、mb 側讀 HEAD tree、SHA 驗退回 nonempty);invoked-as-main.e2e CONSUMERS 加 check-protectedbranches-drift(DP-M6 killer);docs/ADOPTION 記 CTRL-CI-014 + fail-closed 契約 + rollback = full revert;TODOS A3 ⑩ ✅ + 「方向(其餘)」strikethrough 舊 warn 說法。**同 sprint 附帶 defer ③ 收條**(490b122 + 7c32fd6 兩 direct-to-main commit,補記):sprint 3/4 抽 lib 已消滅頂層 fileURLToPath throw、11 caller exit(2) 為 fail-closed 設計、非 bug;路 A 收條、TODOS ✅、無 code 改動。
> **驗證(`d4e9c61` 實測)**:typecheck / lint / **31 檔 998 passed + 2 skipped**;check:catalog 32 controls / 18 steps 綠;check:mutation-specs 11 spec 120 探針樣本對齊;mutate --spec protectedbranches-drift.json → **8/8 killed** 綁 `d4e9c619e725d5d6da0fad696d0881b2751208ba`;check:doc-size progress 5.1 KB / 20 KB(歸檔後)。
> **審查**:Codex Step 4 r1 **1 P1 行為級**(CLI parseArgs 只拒空 --base、不驗 immutable 40-char SHA;`--base=HEAD` merge-base(HEAD,HEAD)=HEAD 讓已擴大集合誤判 exit 0 fail-open)+ **1 P2 散文級**(TODOS ⑩ 舊「方向...印 warn」與新 strict 交付段矛盾)→ 修 IMMUTABLE_SHA_RE + 3 e2e case(HEAD/origin/main/短 SHA)+ DP-M8 mutant + 舊方向 strikethrough → **r2 APPROVE 0 unresolved** 綁 a73ea4a。Step 5 標準審 **5 INFORMATIONAL 0 CRITICAL**:F1 conf 9(README 7→8)、F2 conf 8(e2e #10 巧合通過、實走 HEAD parse-failure 而非 diff 語意)、F3 conf 8(DP-M1 label 誇大 killer 「#10 kill」);修 F1/F2/F3(README 同步、#10 rename + 註解澄清 + stderr「parse 失敗」斷言鎖路徑、unit 加 #11 #12 補 diff 字面 case-sensitive、DP-M1 label 對齊真實);skip F4 conf 5(schema bump 期靜默擋)、F5 conf 3(SHA-256 forward-compat)。Step 5 worktree 審 r1 **1 INFORMATIONAL**(同標準審 F2 conf 9 更嚴描述)→ r2 **APPROVE 0 findings** 綁 d4e9c61。
> **⭐ 教訓**:①**「巧合通過」的 e2e 是靜默漂移**——case #10 setup `["main", "Main"]` 意圖驗 diff Set 字面敏感,但實際走 HEAD parseHarnessConfig 的 assertStringArray case-fold 拒 throw、exit 2 + stderr 含「"Main"」恰好通過原斷言。診斷歸因錯、mutation label 誇大。**修法**:test 要**斷言路徑**(如 stderr 含「parse 失敗」明確鎖 parse-failure catch);Set 語意的真覆蓋走 unit 層直呼純函式(避開 parseHarnessConfig)。②**CLI trust-boundary 不能只靠 CI 端守**——CI YAML structural lock 已鎖 immutable base.sha,但 CLI parseArgs 若只拒空,本地誤呼叫或未來 CI 退化到 branch ref 仍會撞。`--base=HEAD` 是最經典的 trust-boundary fail-open。修法:CLI 端加 IMMUTABLE_SHA_RE = /^[0-9a-f]{40}$/ 硬鎖、雙層守。③**strict fail-closed 拒絕所有 PR-controlled bypass**——rev1 我提 PR body marker、opt-out flag、body-file,rev2 supervisor 全刪(PR 作者可控 = 自我 bypass 破壞 hard/fail-closed 契約);合法擴大 escape hatch 只能是 Owner/admin 組織治理層 override + full revert PR。這條**pattern-level 原則**適用未來所有 governance gate。
> **⏭️ 下一棒候選**(hint 非 truth):A. A3 defer 其餘 20 條(⑬⑭⑮ 一起收 0.5h、其餘逐條 0.5h);B. P2#3 defer ④-⑮(12 條 conf ≤8);C. A2 defer 集合(17 條 INFORMATIONAL);D. Milestone B1;E. P2#2 defer 集合(9 條);F. PR A1.1 defer 集合(23 條)。
> **check:claims 逐條處置**:0 新命中(本 sprint 無新宣稱句加入 lib 檔頭 / docs 主張)。
> 📊 成本:CC ~5h / plan 5 rev(rev1→5)/ Codex Step 4 2 輪(r1 P1 SHA + P2 散文、r2 APPROVE)/ Step 5 標準審 1 輪 + worktree 審 2 輪(r1 1 INFO、r2 APPROVE 0)/ mutate 3 輪(初 7、round 1 加 M8、Step 5 fix 綁 d4e9c61)/ P1 1 個(CLI SHA 驗)/ P2 4 個(TODOS 散文 + F1/F2/F3)/ Step5 獨立發現 6(0 CRITICAL、5 INFO 修 3 skip 2 + worktree 1 同款)
> 📐 量測:claude-opus-4-7[1m] effort xhigh(主 session)+ adversarial-reviewer 標準審 + isolation:worktree x2 輪;Codex gpt-5.6-terra medium(w2:p8);baseline `7c32fd6b81a4f45b08b6b7ce20cb35082ad33b0b`;來源分佈:既有缺陷 1(CLI SHA 驗只拒空)・漏改 consumer 1(TODOS ⑩ 舊方向未同步)・baseline 後引入 4(round 1 P1 修引入 SHA 驗 + 3 e2e case、F2/F3 修引入 unit #11 #12)
> **7 步 checklist**:1 ✅ plan 5 rev + Codex APPROVE / 2 ✅ Owner「plan approve = go」/ 3 ✅ Phase 1-5 atomic commits + Phase 4 補 DP-M6 killer / 4 ✅ Codex r1 P1+P2 修 + r2 APPROVE / 4.5 ✅ 人工判高風險車道(動 governance gate + CI step + config trust-boundary),探針 8/8 綁 `d4e9c619e725d5d6da0fad696d0881b2751208ba`(含 DP-M2 trust-boundary、DP-M3 CI condition、DP-M8 SHA 驗 killer)/ 4.6 ✅ 未觸發 / 5 ✅ 標準審 修 F1/F2/F3 + worktree r1 1 INFO 修 → r2 APPROVE 0 findings / 6-7 待執行(Owner 已授權 CI 綠自動 merge)

> 更早的 entries:2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
