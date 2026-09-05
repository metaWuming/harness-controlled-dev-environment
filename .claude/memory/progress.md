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

📅 2026-09-06 ① — **P2#2 defer ⑤:移除 validateRef short-name canonicality check(避免 tag origin/main 觸發 fail-closed DoS、reason-code taxonomy 收窄移除 base.noncanonical)**

> **緣起**:TODOS.md「P2#2 Step 5 defer 集合」⑤ 條目(conf 6):「tag 同名 `origin/main` 讓兩 gate 對所有 PR exit 2(fail-closed 型 DoS、非繞過)」。#68 P2#2 defer ⑨ squash 後、Codex supervisor w6:p4 gpt-5.6-terra 拍板本 sprint = A-⑤ 單條、標準車道(availability/fail-closed 誤拒、非安全繞過)、review effort 全程 high(碰 delivery-ref canonicality + fail-closed 邊界);frozen full base `29ed7cd6b087ec79f5bfedb914755d4a517dc65d`(origin/main tip = #68 squash);shared local main 仍在 233858f + CLAUDE.md M(全程 lock)。**Live repro 已核實**(Step 1 起手前 tmp repo):建 tag `origin/main` → `git rev-parse --symbolic-full-name origin/main` → ambiguous error、完整 ref lookup 不受影響、症狀屬實。plan review r1-r5(5 rounds、4 次 revision、r5 APPROVE)(r1 supervisor STOP-AND-REPORT ④ 明列「base.noncanonical 完整 ref lookup 後不可達、需擴 scope 同步處理 5 面向」;r2-r5 逐輪校正 D2 inventory / D8 gate 時序 / API 精確度 / fakeGit 一併刪 / assertion 收緊、r5 APPROVE + GO Step 3)。
> **改動**:**Phase 1 atomic + Step 4 P1 fix + Step 5 round 1/2/3 fix + Step 5 round 4 claims wording fix、5 檔基礎 + 累積 10 檔 folded**(Phase 1 final tip `f27aa5949d035cbe316132b7e1df5154c75567b1`、round 3 pre-claims tip `91fb197eab41425aa389d68fdcdb71d99dcba6bd`、full-range +95/-52):
> - Phase 1(`6c64259`、+57/-40、5 檔):scripts/lib/delivery-refs.ts(ReasonCode union 移除 base.noncanonical + validateRef canonicality check block 全刪 + docstring 順序改「形狀→存在→宣告」+ formatRejections wording 去「正規」)/ tests/delivery-refs.test.ts(檔頭註解 + noncanonical unit case 移除 + fakeGit canon state + --symbolic-full-name handler 一併刪 + 加真 Git shared-resolver regression case:tmp repo + 合法 harness.config + tag `origin/main` → `resolveDeliveryRefsFromRepo(root)` `.ok === true` + `.refs === ['refs/remotes/origin/main']` + 空 rejections)/ tests/check-no-source-terms.test.ts(base.noncanonical e2e 移除 + 加真 Git tag 行為級 regression:`code === 0` + `out.toContain("✅ 去識別化掃描全數通過")` + `out.not.toContain("[base.")`) / tests/check-todos-markers.test.ts(加真 Git tag 行為級 regression:`code === 0` + `out.toContain('✅ 0 個失效完成宣稱')` + `out.not.toContain('[base.')`) / scripts/mutations/delivery-refs.json(DR-M2 canonicality mutant entry 整條移除 + DR-M8 label 去 base.noncanonical、其他 mutant find/replace 零異動)
> - Step 4 P1 fix(`d0cde5a`、+1/-0):check-todos regression 補正向成功訊號 assertion
> - Step 5 round 1 fix(`393b3c3`、+31/-6、5 檔):6 wording drift(F1 MIGRATION 2 處 + F2 CHANGELOG + F3 mutations/README 雙重漂 8→7 + F4 check-todos-markers docstring + F5 test title 「形狀→存在→正規→宣告」→「形狀→存在→宣告」)+ F7 tests/delivery-refs.test.ts 加 local-branch shadow sibling regression case(build off 相同 tmp() + CONFIG fixture、`git branch origin/main` + assert `{ ok: true, refs: [MAIN], rejections: [] }`)
> - Step 5 round 2 fix(`82bc7b0`、+5/-5、4 檔):5 same-class drift 殘留(3 test titles「指向正規、可解、」→「指向可解、」+ 2 ci.yml comments L51/L165「正規、可解」→「可解」;CI 禁區突破僅限這 2 處 comment 文字、workflow logic + steps + if: + env: 全 0 line 動);package-lock.json `git restore --source=HEAD` 復原、不進 diff
> - Step 5 round 3 fix(`91fb197`、+1/-1):base.unresolvable test title「形狀正規、名稱已宣告」→「形狀合法、名稱已宣告」(round 2 補漏)
> - Step 5 round 4 claims wording fix(`f27aa59`、+1/-1):scripts/mutations/README.md L85「拒絕不靜默」→「拒絕都回報」(避 check:claims 對「絕不」pattern 命中 pre-existing 描述性 wording;Phase 2 doc-size gate 過程中 claims 抓到、KEEP class 但主動改)
>
> **禁區守住**:resolveDeliveryRefs API / 唯一 origin/HEAD / declared whitelist / consumers(check-todos-markers / check-no-source-terms `loadAllowedPrs`)runtime / CI workflow logic + steps + if: (含 A3 defer ① 相關 3 處) / catalog register / env / trust boundary / DR-M1/M3/M4/M5/M6/M7/M9 find/replace / shared main 233858f + CLAUDE.md M / 3 支 stash / 保留 worktrees / remote:全 0 line 動;CI 禁區突破僅限 comment 文字。
> **驗證(fresh worktree wt-p2p2-defer-5-tag-collision;主要 tests / 反向探針在 round 3 pre-claims tip `91fb197` 實測、claims wording fix 與 final claims check 在 Phase 1 final tip `f27aa59` 完成;非 preflight)**:git diff 29ed7cd..91fb197 --stat 10 檔 +95/-52 folded;typecheck / lint 綠;`npx vitest run tests/delivery-refs.test.ts tests/check-no-source-terms.test.ts tests/check-todos-markers.test.ts` **231 pass**(12 + 174 + 45、base counts 對得上);`npm test` 全 suite **31 files / 1026 passed + 3 skipped**(base 29ed7cd 1024 + 2 新 regression);`npm run check:mutation-specs` 12 spec **129 條**探針對得上(base 130 − DR-M2 = 129、無 drift);`npm run check:catalog` CATALOG_OK 32 controls;`npm run check:doc-size` progress 13.9 KB / 20 KB(70%)、LESSONS 24.2 KB / 60 KB(40%);`npm run check:doc-refs` 616 refs / 0 失效;`npm run check:claims --base=origin/main` 綠;`package-lock.json` 未進 diff。**三面向反向探針**(base runtime 恢復 canonicality block + DR-M2:`git checkout 29ed7cd -- scripts/lib/delivery-refs.ts scripts/mutations/delivery-refs.json`):(1) shared-resolver tag case 轉紅、`base.noncanonical` rejection;(2) shared-resolver local-branch case 轉紅、`base.noncanonical` rejection;(3) check-no-source-terms 行為級 case 轉紅 `code=2` + `out` 含 `[base.`;(4) check-todos-markers 行為級 case 轉紅 `code=2` + `out` 含 `[base.`;`git checkout HEAD -- ...` 還原後全綠 → mutation-sensitive、行為級。
> **審查**:Codex plan review r1-r5(5 rounds、4 次 revision、r5 APPROVE)(r1 STOP-AND-REPORT ④ 明列擴 scope 同步 5 面向、r2 3 明列一致性修訂、r3 3 明列 D2 inventory 分類 wording + D8 4 段時序 + Impact radius line pin、r4 檔內 3 處殘留 line pin 除、r5 全除 APPROVE + GO Step 3);Codex Step 4 對 `6c64259` NEEDS-REVISION 1 P1(check-todos assertion 缺成功訊號)→ 修為 `d0cde5a` APPROVE;Codex Step 4 對 `82bc7b0` NEEDS-REVISION 1 P1(round 2 miss base.unresolvable「形狀正規」)→ 修為 `91fb197` APPROVE。Step 4.5 CSO 標準車道人工判定 CSO_NOT_REQUIRED(兩 consumer 全程完整 ref CodeGraph 已核實、reason-code 收窄屬架構清理、無 auth/authorization/payment/PII/audit or production logic 邊界)。Step 4.6 未觸發(無 UI diff)。Step 5 adversarial round 1 **0 CRITICAL / 9 INFORMATIONAL**(F1 conf 8 / F2 conf 8 / F3 conf 9 / F4 conf 8 / F5 conf 9 / F6 conf 4 / F7 conf 5 / F8 verification / F9 conf 2);supervisor 分類:F1-F5 + F7 FIX(6 條)、F6 + F9 KEEP;round 2 adversarial reverify:6 FIX 收斂 + 抓 5 new same-class drift 殘留(3 test titles + 2 ci.yml comments)supervisor 分類 5 全 FIX + 授權 CI 禁區有限突破;round 3 adversarial reverify:0 actionable、6 項 verify 全過(active wording = 0 hits、F6/F9 intact、CI 僅 comment 變更、兩反向探針 kill、package-lock 未進 diff、test counts base 對得上)。
> **⭐ 教訓**:①**「刪除、不替換」修法優於「用完整 ref 替換」**——真 Git 中完整 remote-ref existence check 後 canonicality mismatch 不可達、只是 fail-closed DoS surface;supervisor r1 STOP-AND-REPORT ④ 邏輯明列擴 scope 同步處理 5 面向、避免留死 canonicality lookup;修法保留 base.shape → base.unresolvable → base.undeclared fail-closed 順序 + 收窄 taxonomy。②**D2 唯讀 inventory pattern 必須含概念同義詞 bounded scan**、非只搜 reason-code literal:supervisor round 2 建 `git grep -nE '正規|canonical|noncanonical|normalize|resolve'` 對契約密集區受限裸詞掃描 + 逐筆分類;supervisor r1-r5 建的 pattern (DELIVERY_REFS|四條來源 + base.noncanonical) 遺漏「正規」單獨字面 → round 2 抓 5 處 (3 test titles + 2 CI comments)、round 3 追加抓 1 處 base.unresolvable「形狀正規」;taxonomy 收窄時 inventory pattern 應加碼概念同義詞。③**CI comment 屬 wording drift 同 class MIGRATION/CHANGELOG**、supervisor 授權有限突破禁區(僅限 comment 文字、workflow logic 全鎖)——A3 defer ① CI `if:` 相關禁區與 CI comment 屬不同 scope。④**Test title SSOT 與 assertion 對齊**、雖 tests 不依 title、讀者從 title 讀契約需 wording 精確。⑤**Plan review 5 rev + Step 4 review 2 + Step 5 round 1/2/3 supervisor 分類 = 高 review round 數**、屬 taxonomy 級 refactor 的正常代價、非低估;下 sprint 若碰同級 API taxonomy 改、預期同 review 密度;concept-synonym bounded scan 應加入 taxonomy 收窄 sprint 的 D2 inventory default pattern。⑥**Reverse probe 覆蓋三面向**(shared resolver + 兩 consumer 行為級)確保 mutation-sensitive、非 prose 修法;package-lock.json M 屬 npm install artifact、Step 6 push 前 `git restore --source=HEAD` 復原、shared main 全程不動。
> **⏭️ 下一棒候選**(hint 非 truth、起手 git 核實):A. P2#2 defer 剩 1 條(⑦ harnessConfigJson 重複 conf 6、逐條 0.5h;defer ⑤ 收後可 close 集合);B. A3 Step 5 defer 集合 剩 19 條 INFO conf ≤7;C. A2 Step 5 defer 集合 17 條 INFO conf ≤6;D. A1.1 defer 集合 23 條 conf ≤7 doc governance;E. 單條:grep.column NUL 錯位(conf 8、0.5-1h)/ mutate.ts SIGTERM 不還原(conf 8、1h、P3);F. Milestone B1(新開)。
> **check:claims 逐條處置**:1 命中(base=origin/main):`scripts/lib/delivery-refs.ts:130` formatRejections 診斷 wording「唯一來源是受驗的 origin/HEAD」中「唯一」pattern 命中——**KEEP、pre-existing 契約核心 wording**(「唯一來源」是 delivery-refs 契約 SSOT、非本 sprint 引入的絕對化宣稱、無替代 wording 可表達契約單一來源語意)。0 個 actionable 新絕對化宣稱句。
> 📊 成本:CC ~4h / 跨模型 review 15 rounds(plan review r1-r5 5 rounds + Codex Step 4 commit-object reviews x4 對 6c64259/d0cde5a/82bc7b0/91fb197 + adversarial rounds x4 (round 1 + round 2 rereview + round 3 rereview + verify-with-classify) + supervisor 分類 x2) / Step 4 P1 actionable findings 2 個(非 CRITICAL、屬 Step 4 明列 assertion 缺失 / 舊 wording 遺漏、修為 fix tip 收) / Step5 獨立發現 14 個(round 1 9 個 F1-F9 + round 2 5 個 new same-class + round 3 0 actionable)
> 📐 量測:claude-opus-4-7[1m] effort medium(主 session、taxonomy 級 refactor 5 檔基礎);Codex gpt-5.6-terra high(w6:p4、supervisor 明列 review effort 全程 high)plan review r1-r5 + Step 4 x4 + Step 5 x3 + supervisor 分類 x2 approve;baseline SHA `29ed7cd6b087ec79f5bfedb914755d4a517dc65d`;來源分佈:既有缺陷 2(canonicality check 短名 lookup 於 tag namespace collision 觸發 DoS、defer ⑤ 條目登錄時已存在;base.noncanonical reason code 完整 existence check 後真 Git 不可達、supervisor r1 深挖 STOP-AND-REPORT ④ 邏輯拆解)・漏改 consumer 0・baseline 後引入 0
> **7 步 checklist**:1 ✅ plan review r1-r5(5 rounds、4 次 revision、r5 APPROVE) + Live repro + D2 inventory + D8 4 段 gate 時序 + 三面向 regression assertion 收緊 / 2 ✅ Codex r5 APPROVE + GO Step 3 / 3 ✅ fresh worktree wt-p2p2-defer-5-tag-collision + npm ci + D2 inventory (MIGRATION/OVERVIEW 0 hit、LESSONS 舊 4-source segment 已 P2#2 defer ⑨ closed、本 sprint 不動) + Phase 1 atomic 5 檔 commit `6c64259` + Step 4 P1 fix `d0cde5a` + Step 5 round 1 fix `393b3c3` + Step 5 round 2 fix `82bc7b0` + Step 5 round 3 fix `91fb197` + Step 5 round 4 claims fix `f27aa59` / 4 ✅ Codex Step 4 x4 對 `6c64259`(actionable P1)+ `d0cde5a`(APPROVE)+ `82bc7b0`(actionable P1)+ `91fb197`(APPROVE) / 4.5 ✅ CSO 標準車道人工 CSO_NOT_REQUIRED / 4.6 ✅ 未觸發(無 UI diff、CI comment wording 屬 governance descriptive、非 UI) / 5 ✅ adversarial round 1(9 INFO)+ supervisor 分類 6 FIX + round 2 rereview(5 new drift)+ supervisor 分類 5 FIX + round 3 rereview(0 actionable、6 verify 全過) / Phase 2 加 ① + archive ⑧ 至 progress-2026-09 + TODOS ⑤ ✅ + PR 引用位待 Step 6 補號 + entry-count conservation:base archive 24 + current 1 (⑧) = pre 25;新增 ① 後 total 26;archive ⑧ 至 archive 後 archive 25 + current 1 (①) = post 26、每 entry 恰 1 次 / 6-7 待執行(Owner sprint-loop 授權)


> 更早的 entries:2026-09-05 ⑧ P2#2 defer ⑨、2026-09-05 ⑦ P2#2 defer ③、2026-09-05 ⑥ P3 delivery-refs 移除集合 ①+②、2026-09-05 ⑤ P2#3 defer ⑮、2026-09-05 ④ P2#3 defer ⑭、2026-09-05 ③ P2#3 defer ⑬、2026-09-05 ② P2#3 defer ⑫、2026-09-05 ① P2#3 defer ⑨、2026-09-04 ④ P2#3 defer ④、2026-09-04 ③ P2#3 defer ⑪、2026-09-04 ② P2#3 defer ⑥、2026-09-04 ① P2#3 defer ⑧、2026-09-03 ⑨ P2#3 defer ⑩、2026-09-03 ⑧ P2#3 defer ⑦、2026-09-03 ⑦ P2#3 defer ⑤、2026-09-03 ⑥ A3 defer ⑩、2026-09-03 ① PR A3、2026-09-02 ① PR A2、2026-08-31 ① PR A1.1 見 [progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md);(2026-08-29 ① PR A1 / 2026-08-28 ⑥ 批 12 / 2026-08-28 ⑤ 批 11 / 2026-08-28 ④ 批 10 / 2026-08-28 ③ 批 9 / 2026-08-28 ② 批 8 / 2026-08-28 批 7 / 2026-08-27 ③ 批 6 / 2026-08-27 ② 批 5 / 2026-08-27 ① 風險車道 及之前)見 [progress-archive/progress-2026-08.md](progress-archive/progress-2026-08.md)
