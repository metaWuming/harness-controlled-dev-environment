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

📅 2026-09-09 ⑳ — **governance sprint:CI-016 SSOT durable evidence boundary(range f3291648..d56cbe4)**

> **改動 d56cbe4**:5 檔 wording 對齊 durable evidence boundary(scripts/control-catalog.json CTRL-CI-016 notes / docs/ADOPTION.md §5.2 / scripts/run-mutation-smoke.ts header / .github/workflows/ci.yml smoke step comment / docs/CONTROL-CATALOG.md rendered)。改法將 remote-state stale assertion 拆為 evidence boundary:遠端 enforcement 需 gh api live probe 現場確認;template config `githubGovernanceRequired:false` 表達 adopter requirement default 語意;schedule A-D audit 以 `BRANCH_PROTECTION_TOKEN` + schedule workflow 成功為前提;per-PR verifier 屬 out-of-scope。
> **Step 4 flow P2 finding**:supervisor 於 detached review clone 發現 check:claims 命中需在 progress.md 留人工處置史;本 entry(⑳-b commit)即該留史。
> **check:claims 逐條處置**(pre-merge、PR body 對齊同兩項 disposition、兩處貼、不轉抄):
> - `scripts/control-catalog.json:997` KEEP — CI-016 notes 內被標示為「不成立」的舊防線措辭之校正引文,非 current enforcement 斷言。
> - `docs/CONTROL-CATALOG.md:52` KEEP — catalog:render 產物、對應 catalog.json 同引文、非新斷言。
> **claims 工具語意**:命中為待人工處置 flow signal、非 product / CI failure(tool 命中時 exit code 非 0 為預期行為);PR body 對照本 entry 貼同兩項 disposition。
> **驗證**:typecheck / lint 綠;catalog:render 34 controls 35414 bytes;check:catalog CATALOG_OK;check:doc-refs 854 refs 0 fail;check:mutation-specs 14 spec 167 probes drift zero-diff;vitest focused 3 files 100 passed 0 skip。

📅 2026-09-09 ⑲ — **Sprint 21 C3 milestone:CTRL-CI-016 Mutation Kill Smoke Check(CI 加獨立 gate、對 pinned 6 條 smoke probe 真 apply mutation via mutate.ts + assert killed、accidental-regression signal 非 malicious-PR security boundary、三份 mutation evidence 分工)**

> **緣起 & scope**:Sprint 20 C2 delivery(PR #86 squash tip)後、Owner staged roadmap 最後 milestone C3;Owner 一句話 objective 起手「CTRL-CI-013 mutation-spec drift 升 hard-automated」→ Codex Phase 0 evidence intake 發現 CTRL-CI-013 早已 hard-automated(PR #47 引入)、objective 已由現況完成 → Owner AskUserQuestion 重拍板方案 A「mutation-kill smoke subset 進 CI」= 真升級 machine-verifiable 一步。Scope:pinned 6 條 smoke probe(每 spec index 0、fingerprint 對 immutable f51483d1 SHA-256 verify)+ 新 runner `scripts/run-mutation-smoke.ts`(硬編碼 SMOKE_PROBES map + 7 步 algorithm)+ 極簡 manifest `scripts/mutation-smoke-manifest.json`(cardinality 6 / no duplicates / set-equality / $schema pin)+ CI step 新 CTRL-CI-016(一對一 ciStep + timeout-minutes: 5)+ ADOPTION §5.2/§5.3 runbook。Frozen base `f51483d18a4f4cba6da4682ef75a8cd05448466e`(Sprint 20 squash tip via local bundle atomic quarantine `refs/temp/sprint21-base`;shared main 233858f + CLAUDE.md M + stash + 18 agent-* worktree + stale local origin/main 2307a44 全 preserved 不動)。
> **改動**:**Phase 1 = 8 檔 +1098/-0**(commit A code+tests+catalog 7 檔 +1059:`scripts/mutation-smoke-manifest.json` NEW / `scripts/run-mutation-smoke.ts` NEW / `.github/workflows/ci.yml` 擴 CI step / `package.json` 擴 script / `scripts/control-catalog.json` 新 CTRL-CI-016 entry / `docs/CONTROL-CATALOG.md` catalog:render 重生 / `tests/run-mutation-smoke.test.ts` NEW 31 test;commit B docs 1 檔 +39:`docs/ADOPTION.md` §5.2 mutation kill smoke + §5.3 三份 evidence 分工 NEW);**commit C bookkeeping**(progress ⑲ + TODOS Sprint 21 delivery + F3 defer + archive Sprint ⑰)。runtime harness-config / A6.claude/codex / CLAUDE.md / AGENTS.md / CTRL-CI-013 zero-diff。
> **審查**:Codex plan review r1-r6(承 Phase 0 objective 重拍板 + 5 revisions;r2 P1 discovery seam + shell injection + spec count + catalog one-to-one ciStep + r3 fingerprint scope 完整 entry + concrete value pin + r5 P1 cardinality/set-equality → r6 APPROVE + GO Step 3);Step 4 commit-object review r1-r3 iterate(r1 3 P1:test 未真呼叫 runner / SIGKILL 跳 restore / executable evidence 6 條真 kill → r2 加 injectable RunnerDeps 9 branch coverage + SIGTERM detached process group + 本地 6 probe run evidence → r3 加 real e2e wiring test + skipIf tree dirty → APPROVE);Step 4.5 CSO fresh classification = CSO_NOT_REQUIRED(governance-only、diff 未動 CSO 五域、catalog notes 誠實標 accidental-regression signal 非 security boundary);Step 5 adversarial-reviewer 7 findings(F1 CRITICAL wording-honesty ADOPTION §5.2 anchor 不存在 / F2 e2e wiring vs parallel vitest fork race conf 6 / F3 SIGTERM/SIGKILL escalation 路徑無測試 conf 7 / F4 fingerprint canonical replacer array order conf 5 / F5 CTRL-CI-016 implementation deps 未列 conf 4 / F6 $schema pin 無 conf 5 / F7 5/6 probe local 不驗 conf 5)→ F1 修 §5.2 補 + F2/F7 拿掉 test 內 real e2e(依 CI step 承 P1-3 evidence)+ F4 加 canonical byte SHA pin test + F5 catalog implementation 加 mutate.ts + 6 spec + F6 $schema exact-string check + F3 defer 進 TODOS(mock hang command scope);Codex frozen full-range delta review APPROVE(f51483d..aac8d7f、8 檔 +1098/-0、7 findings 全收乾 / defer 未見 P0/P1 回退)。
> **驗證**:typecheck / lint / test 34 files 1216 pass 3 skip(baseline 1185 + Sprint 21 增量 31)/ check:adoption template mode 4 exception T3/T4/T5/T10 + info T7 / check:catalog 34 controls(33 + CTRL-CI-016)/ check:doc-refs 836 refs 0 fail(§5.2 + §5.3 anchor 對得上)/ check:doc-size progress 12 KB after archive Sprint ⑰ + LESSONS 24.2 KB / check:mutation-specs 6 spec / 167 probes zero-diff / git diff --check clean。**反向探針**:本地實跑 npm run mutation:smoke 全 6 probe killed exit 0(runtime 70s per-probe + 2 control = ~130s、遠低 5 min timeout);injectable deps tests 覆蓋 schema/dirty/pre-control/all-killed/survived/indeterminate/post-control/HEAD-changed/post-tree-dirty 9 branch。CI 狀態去 GitHub PR page 看。
> **⭐ 教訓**:①**Phase 0 evidence-first 拒 objective reframe**(Codex 抓現況已滿足 objective、拒 blindly implement;Owner 重拍板 real objective = 真升級 machine-verifiable、避 no-op sprint);②**Fingerprint scope 必需 pin 完整 entry**(plan r4 P1:label-only fingerprint 允許 file/find/replace 改仍過 → 改 canonical JSON of {file, find, label, replace} 完整 SHA-256);③**Concrete fingerprint value 需 pre-computed pin 進 plan**(plan r4 P1:placeholder 到 Step 3 前無法 review verify → 對 immutable f51483d1 pre-compute 6 值直接寫進 plan、reviewer 可核對);④**Manifest schema 必需 cardinality + set-equality**(plan r5 P1:allow empty/subset → 加 length=6 + no duplicates + set-equality vs SMOKE_PROBES keys 三條硬性);⑤**Shell injection via manifest**(plan r2 P1-2:任意 --cmd 字串傳 shell → runner 硬編碼 TEST_SUITE_ALLOWLIST + spawn argv-safe + shell:false);⑥**SIGTERM detached process group**(Step 4 P1-2:SIGKILL 跳過 mutate.ts restore + npx leader 送 signal 未及子群 → detached: true + process.kill(-pid, sig) 對整個 group + SIGTERM 60s + SIGKILL 5s grace);⑦**Test 覆蓋要真跑 runner path**(Step 4 P1-1:mock 全 injectable deps 不夠、加 real e2e wiring;Step 5 F2 race → 拿掉 test 內 real e2e、依 CI step 承 evidence + 檔頭 comment 記錄 tradeoff);⑧**誠實邊界三處 SSOT + 被引用 anchor 需存在**(Step 5 F1 CRITICAL:catalog notes 說「三處 SSOT 對齊 docs/ADOPTION.md §5.2」但實際段落不存在、triangulated honesty 空掉 → commit B 補 §5.2 承 §5.1 慣例、承 Sprint 20 pattern:catalog/docs/CI comment 三處 SSOT wording 一致);⑨**Adversarial finding fix vs defer 分**(承 Sprint 20 pattern:F1-F2/F4-F6/F7 pre-merge 收乾、F3 timeout escalation test 需 mock hang command 獨立 scope、defer 進 TODOS non-actionable-until-regression);⑩**三份 mutation evidence 分工**(drift CTRL-CI-013 / kill smoke CTRL-CI-016 / full manual Step 4.5)語意清楚、docs §5.3 一段 pin。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):Owner staged roadmap A1.1→A2→A3→B1→B2→C1→C2→**C3** 全 milestone 交付、repo 進 maintenance mode 為候選;Sprint 21 F3 timeout escalation test coverage defer 集合(TODOS 「External evidence watchlist」上方 F3 defer 段、reopen 條件:CI 上實觸發 timeout diagnostic 顯示 escalation 沒收乾);P3 D-② watchlist(承 Sprint 16 唯一 reopen 條件)。
> **check:claims 逐條處置**(base=`f51483d18a4f4cba6da4682ef75a8cd05448466e`、實測待 push 前跑):Sprint 21 誠實邊界主軸為 accidental-regression signal、diff 內 `security boundary` 皆為**否定形式**(如「非 malicious-PR security boundary」)以澄清邊界;預期 KEEP;D9 anti-overclaim 全程守。
> 📊 成本:CC ~4h / 跨模型 review = plan r1-r6(5 revisions、Phase 0 objective reframe)+ Step 4 r1-r3(3 P1 iterate:mock coverage / SIGKILL / executable evidence)+ Step 5 adversarial 1 round(F1 CRITICAL + 6 informational)+ frozen full-range delta 1 round / P1 累 = 15(plan r2-r5 8 P1 + Step 4 r1-r3 3 P1 + Step 5 F1 CRITICAL、其餘 F2-F7 為 informational)、P2 累 = 4(plan r2-r3 兼消化)/ Step5 獨立發現 7 findings(F1 CRITICAL + 6 informational)。
> 📐 量測(供 `docs/EFFORT.md` sweep):每輪 effort:plan medium-high(objective reframe 拉高)、Phase 1 code high(fingerprint SHA-256 + detached process group + injectable deps 精細度高)、Step 4/5 review high(adversarial CI security-adjacent);baseline SHA `f51483d18a4f4cba6da4682ef75a8cd05448466e`;來源分佈:staged roadmap milestone(Owner 拍板;Phase 0 evidence-driven objective reframe;非既有缺陷、非漏改 consumer、非 baseline 後引入);Sprint 21 是 Owner staged roadmap 最後 milestone(A1.1→A2→A3→B1→B2→C1→C2→C3 全 delivered)。

> 更早的 entries 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md)
