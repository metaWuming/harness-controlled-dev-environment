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

> 規則正本在 `.claude/sop/plan-mode-checklist.md`「Progress entry」段。entry 進 feature branch 最後一個
> commit,跟 code 同一個 PR。只寫合併前就知道的事(不寫 PR 號、squash SHA、CI 結果)。
> 驗證某 sprint 是否已進主線:`git fetch origin` 後
> `git log -S '<完整 entry heading>' origin/<delivery-branch> -- .claude/memory/progress.md`。
>
> 標準 / 高風險車道沒有 Codex、改用 Claude 審查時,審查行之前另起一行,行首寫
> `> 降級 Claude:<原因>`(規則見 SOP 同段)。
>
> ⚠️ **未完成 sprint**(暫停、卡外部、交棒)寫 partial entry 並標「⚠️ partial / paused」,
> 流程見 `.claude/sop/context-management.md`。sprint 恢復後在同 branch 收尾時,**就地改寫**那條
> partial entry,不另加一條。

```markdown
📅 YYYY-MM-DD ⓝ — **一句話標題**

> **車道**:<快速|標準|高風險>(判定理由一句)
> **做了什麼**:N 檔,一句話
> **審查**:Codex round N(或 Claude code-review round N),0 P1;殘留問題:無 / ①… ②…
> 📊 成本:review N rounds / P1 X 個 / P2 X 個
> **下一步**(hint 非 truth):…
```

---

<!-- entry 從這裡開始,新的在最上面 -->

📅 2026-10-22 ㊴ — **CI setup-node 加 check-latest(Node.js 10-21 安全更新)**

> **車道**:高風險(CI 設定 `.github/**`),Owner 2026-10-22 對此改動明確授權降級 Claude /code-review 1 輪(不跑 Codex)
> **做了什麼**:2 處 setup-node 加 `check-latest: true`,CI 每次抓最新 22.x 修補版(22.23.4 修 4 個 High CVE)
> **審查**:降級 Claude /code-review round 1(low,Owner 2026-10-22 授權降級,不跑 Codex),0 P1 / 0 CRITICAL;殘留問題:無。本機跑讀 workflow 的測試全過
> 降級 Claude /code-review:Owner 2026-10-22 對此改動授權,不跑 Codex
> 📊 成本:review 1 round / P1 0 個 / P2 0 個
> **下一步**(hint 非 truth):合併後看 CI log 的 Node 版本 ≥ 22.23.4

📅 2026-10-19 ㊳ — **LESSONS:新增 #114 / #115 踩到的 4 個工具坑**

> **車道**:快速(只動 LESSONS + progress,LESSONS 淨增 80 行;不碰安全面。模板 repo 路徑表刻意為空,以自問判定;㉚ 歸檔屬 bookkeeping,不計入大小)
> **做了什麼**:1 檔 + 本 entry。LESSONS 加 4 條:mutate 參數含 `{n,m}` 被 shell 展開、背景跑 vitest 沒關 stdin 卡住、改 SOP 例外 / 路由句引入新 CRITICAL、mutate `--cmd` 測試檔名寫錯讓探針假存活;progress ㉚ 歸檔到 progress-2026-10.md
> **審查**:Claude code-review round 1,0 P1;4 條描述不準的 finding 已照改,不另跑一輪;殘留問題:無
> 📊 成本:review 1 rounds / P1 0 個 / P2 0 個
> **下一步**(hint 非 truth):無

---

📅 2026-10-19 ㊲ — **actions/setup-node 升 v7.1.0(取代 dependabot #112),並補 workflow SHA-pin 測試**

> **車道**:高風險(CI 設定)
> **做了什麼**:3 檔。ci.yml、branch-protection.yml 的 setup-node 升到 949feb2(已核對官方 tag v7.1.0、在上游 main);新增 tests/workflow-actions-sha-pin.test.ts——原本 ci.yml 拆掉 SHA-pin 整套測試仍綠(探針存活)
> **審查**:Codex round 3,0 P1(R1 2 P2、R2 1 P2 已修);第 2 道 adversarial 3 輪,0 CRITICAL(INFO 修 5);最後全範圍 Codex 2 P1(YAML 跳脫繞過)已修,增量複審 0 P1。殘留問題:① docker:// 不驗 digest ② 不驗 SHA 來源 ③ composite action 不掃 ④ YAML alias / flow mapping / 跨行值 / 單獨 \r 誤擋或漏檢 ⑤ 新測試沒有探針規格與目錄條目 ⑥ branch-protection.yml 是排程 workflow,合併後才實際跑到
> **高風險**:命中域 = CI 設定;探針 7 條全 exit 0(綁 c745062);SHA 來源以 GitHub API 核對 tag
> 📊 成本:review 8 rounds / P1 2 個 / P2 3 個
> **下一步**(hint 非 truth):合併後手動觸發一次 branch-protection workflow;審查說明先寫威脅模型,可避免審查追混淆寫法

---

📅 2026-10-19 ㊱ — **check-branch-protection 測試補上 mutation 探針 P12 / P13 存活缺口**

> **車道**:標準(大小屬快速,依交辦指定走 Codex 審;只動測試與探針 label、不放寬守門。模板 repo 路徑表刻意為空,以自問判定未碰高風險面)
> **做了什麼**:2 檔。fake gh 只在收到 `--include` 時印 status line + headers(對齊真 gh),移除 flag 會讓 10 個 case 轉紅(P13);新增 case 15d「200 但 body 空」,原版走 parse throw catch、突變版 `JSON.parse(body) || {}` 會落進 assertion path(P12);P12 label 改指 15d。存活原因:壞 JSON 在原版和突變版都丟同一個 SyntaxError,15c 分不出差別
> **審查**:Codex round 1,0 P1;殘留問題:無
> **驗證**:合併 #115 後,`scripts/mutations/branch-protection.json` 全 spec 27 條全抓到、exit 0(綁 b68fcab;合併前 24 條全抓到,綁 d21bf4c)。typecheck / lint 綠;全套 vitest 綠(首跑 2 個 check-doc-refs 測試在高負載下逾時,單獨重跑 73/73 綠)
> 📊 成本:review 1 round / P1 0 個 / P2 0 個
> **下一步**(hint 非 truth):check-doc-refs G5 測試在全套負載下偶發逾時,另開任務處理

---

📅 2026-10-19 ㉟ — **branch-protection workflow:actions SHA-pin 並升 v7(取代 dependabot #112)**

> **緣起**:Owner 指示處理 dependabot #112(`actions/setup-node` v4 → v7)。核實:#112 CI 紅在 Mutation Spec Drift Check——spec P20a 的 find 與 case 20 斷言都寫死 `setup-node@v4`,bot 改版本號就漂移;另外 README / OVERVIEW 宣稱 actions 一律 SHA-pin,但 branch-protection.yml 仍用可變 tag。Owner 選「另開 PR 取代」。
> **改動**(7 檔 + 本 entry):
>   - `.github/workflows/branch-protection.yml`:checkout → v7.0.1、setup-node → v7.0.0,改 SHA-pin(與 ci.yml 同 SHA)
>   - `tests/check-branch-protection.e2e.test.ts`:case 20 改驗 40 碼 SHA;新增「job 內每一個 `uses:` 都要 SHA-pin」
>   - `scripts/mutations/branch-protection.json`:P20a find 去掉版本號;新增 P20c / P20d(拆掉 SHA-pin)、P20e(多加可變 tag action)
>   - `docs/ADOPTION.md`、`scripts/control-catalog.json` + render `docs/CONTROL-CATALOG.md`:全量 probe 數 167 → 170
> **審查**:
>   > **Codex round 1**(gpt-6.1-sol／high,`codex review --base origin/main -c model -c review_model -c model_reasoning_effort`,baseline `57c93dc`):no actionable findings
>   > **Step 4.5**:模板 repo、表空為設計(`check:cso` fail-closed REQUIRED、無命中域);人工判定——此 job 的 env 帶 admin-read PAT,換 action 等於換能碰到 PAT 的第三方程式碼 → 人工視同 CSO_REQUIRED、走高風險車道,命中域 = 「branch-protection.yml 持 PAT 的 job 跑哪些第三方 action」。security-reviewer:COMPLETE_CLEAN(`git ls-remote` 核對兩個 SHA = 官方 tag;v7 的 persist-credentials 只存 contents:read 的 GITHUB_TOKEN、不碰 PAT;cache 寫入屬 main scope)
>   > **Step 5 worktree 獨立審**(adversarial-reviewer,detached worktree @ `57c93dc91bd77c8d8afc2c0509eee1695276ff10`):0 CRITICAL / 8 INFO。修 3 條(probe 數 167 → 170、斷言「每一個 uses: 都 SHA-pin」+ P20e、probe 排序);不修:兩檔 SHA 無交叉斷言(conf 3)、TODOS.md:207 為 #85 歷史交付紀錄、本 entry 待寫(即本條);揭露:**dependabot 升 workflow 的 PR 仍會卡 CTRL-CI-018**(`isDependabotManifestOnlyPr` 只豁免 package.json / lockfile,㉚ 候選 ② 已預告)——放寬豁免屬安全取捨,交 Owner 決定,不在本 PR;本 workflow 只在排程跑,v7 的實際執行要等合併後第一次 UTC 00:00 run
>   > **Codex round 2**(gpt-6.1-sol／high,`--base 57c93dc`,含 Step 5 修正):no actionable findings,收斂
>   > **mutation 探針**(`scripts/mutate.ts --spec scripts/mutations/branch-protection.json --cmd 'npx vitest run tests/check-branch-protection.e2e.test.ts tests/branch-protection.test.ts'`,綁 SHA `9621c777beeea689023195a9d2926257362e3c32`):命中域 14 條(打 branch-protection.yml 的 P14a–P20e,另抽成只含這 14 條的 spec 單獨跑)exit 0、全部抓到;全 spec 27 條中 25 條抓到,**P12 / P13 存活**——兩條都打 `scripts/check-branch-protection.ts`,本 PR 沒動該檔也沒動對應測試,屬 main 既有覆蓋缺口,列下一棒候選、不在本 PR 補。第一次跑時 `--cmd` 把 `tests/branch-protection.test.ts` 寫錯檔名,vitest 靜默略過不存在的檔 → 5 條打 lib 的探針假存活;改正後重跑
> **驗證**:tsc / eslint 綠;全套 vitest 39 files / 1422 passed / 4 skipped;check:mutation-specs(170 條樣本對得上)/ check:catalog 綠
> **⭐ 教訓**:① 只跑相關測試時,`--cmd` 裡的測試檔名寫錯不會報錯(vitest 把它當過濾字串),探針會假存活——下指令前先 `ls` 確認檔名
> **⏭️ 下一棒候選**(hint 非 truth):⓪ 補 P12 / P13 存活的測試缺口(JSON malformed 走 assertion path、移除 `gh api --include`);① Owner 決定 dependabot github-actions PR 是否也要 CTRL-CI-018 豁免(現況:每次都要人工補 entry 或另開 PR);② 合併後看 branch-protection.yml 第一次排程 run 是否綠;③ #112 在 main 升到 v7 後應由 dependabot 自動關閉,沒關就手動關
> **check:claims**:`--base=origin/main` 命中 4 處,留 A 4 條:CONTROL-CATALOG.md:52 與 control-catalog.json:998 的「唯一」是既有句子(本 PR 只改 probe 數);測試與 P20e label 的「每一個」——測試真的逐一檢查 job block 內所有 `uses:`
> 📊 成本:CC ~45min / 跨模型 review 2 rounds / 0 P1 / 0 P2 / Step5 獨立發現 8 INFO(修 3)
> 📐 量測:Codex round 1..2 gpt-6.1-sol／high;baseline `57c93dc`;來源分佈 既有缺陷 2(TODOS 歷史、SHA 無交叉斷言)・漏改 consumer 1(probe 數文件)・baseline 後引入 0,其餘 5 為揭露 / 強化建議

---

📅 2026-10-18 ㉞ — **SOP 精簡成三車道,並試點 mattpocock skills(grill-with-docs / to-tickets)**

> **車道**:高風險(CI gate 放寬屬守門腳本放寬;模板 repo 路徑表刻意為空,以自問判定)
> **做了什麼**:約 40 檔。SOP 606→185 行、CLAUDE.md 276→99 行;CI gate 接受快速車道;OVERVIEW / EFFORT / scope note 封存到 docs/archive/;TODOS 已結案條目搬到 TODOS-done.md;新增 GLOSSARY.md 與 ADR 0001
> **審查**:Codex round 2,0 P1(R1 的 2 P1 + 2 P2 已修);第 2 道 adversarial-reviewer 3 輪(CRITICAL 0 / 1 / 1,都已修);最後全範圍 Codex 0 P1;安全審 1 MEDIUM 已修。殘留問題:① gate 失敗訊息「單行修」與 SOP「單行 rename」用詞不一 ② CTRL-SOP-005 與 DEGRADATION 的 /review 降級寫法不同 ③ decision-request-template 殘留 Step 1-2 / 3-6 舊編號 ④ 自訂禁區沒同步 TRIVIAL_FORBIDDEN_PATTERNS 時 [trivial] 可過 ⑤ 自然寫法「0 CRITICAL」會被 gate 擋(照範本可過)⑥ 歷史檔引用漂移 ⑦ weekly-health docstring 舊格式 ⑧ ADOPTION「167 probes」舊敘述 ⑨ README「cross-model」措辭
> **高風險**:命中域 = 誰能通過 CI 關卡;mutation 探針 6 條全 exit 0(綁 2252eca;歷史改寫前為 6acfb70,樹相同);security-reviewer COMPLETE_WITH_FINDINGS(1 MEDIUM 已修)
> **CI 修正**:Dependency audit 因新公布的 source-map-js 漏洞(GHSA-68fv-2mgg-jv7q high,vitest→vite→postcss 傳遞依賴)轉紅 → `npm audit fix` 升 1.2.1 → 1.2.2,只動 lockfile;全套 vitest 綠、探針在新 HEAD 重跑
> 📊 成本:review 7 rounds / P1 4 個 / P2 3 個
> **下一步**(hint 非 truth):本次踩到的 4 個工具坑另開快速車道 PR 寫進 LESSONS;下游專案同步另開任務

---

📅 2026-09-30 ㉝ — **port Team W Sprint CM2:Codex review model 預設改 gpt-6.1-sol、effort 一律 high(需 Codex CLI ≥ 0.159.1)**

> **緣起**:Owner 2026-09-30 指示 Step 4 Codex review 全域改新一代 gpt-6.1-sol、effort high,並確認 Team W 引擎與本母 repo 一致。實測 Codex CLI 0.158.0 以 ChatGPT 帳號登入時新 model 回「not supported」,升級 0.159.2 後正常(官方 changelog 記載 0.159.1 起支援)。
> **改動**(4 檔 + 本 entry):`scripts/check-codex-env.ts` 預設清單只放行 gpt-6.1-sol(說明與錯誤訊息同步);`tests/check-codex-env.test.ts` 改新 model,前一代改列不放行;
> SOP Step 4「Codex model 選擇」段補 effort high 與 CLI 版本、各呼叫路徑帶 `model_reasoning_effort="high"`;scope note 範本 effort medium → high。
> **審查**:**Codex round 1**(gpt-6.1-sol／high,`codex review --base origin/main -c model -c review_model -c model_reasoning_effort`):no actionable findings,收斂。Step 4.5:只動檢查清單與文件,人工判定 CSO_NOT_REQUIRED。Step 5 sanity skip:清單換值 + 對應測試、Codex 已收斂。
> **CI 修正**:Dependency audit 因新公布的 brace-expansion 漏洞(GHSA-q2hr-2g5m-vwhr 等 high,eslint 傳遞依賴)轉紅 → `npm audit fix` 升 5.0.9 → 5.0.12,只動 lockfile;Codex round 1 審的是修正前的 diff,lockfile 未另送審。
> **驗證**:check-codex-env 測試 21 passed;typecheck / lint 綠;npm audit 0 vulnerabilities。
> **⏭️ 下一棒候選**(hint 非 truth):無。
> 📊 成本:CC ~20min / 跨模型 review 1 round / 0 P1 / 0 P2

---

📅 2026-09-25 ㉜ — **pre-push：EXIT trap 不再把成功的 push 改成失敗（下游專案回饋）**

> **緣起**:下游專案在同步本模板時踩到:`set -e` 下 `cleanup_trusted_config` 的 `&&` 串在沒建立 trusted_config 時回 1,EXIT trap 把 `exit 0` 改成 1——沒裝 gitleaks＋`SKIP_GITLEAKS_CHECK=1`、或只刪除 ref 的 push 一律靜默失敗。本機重現 exit=1。
> **改動**(5 檔 + 本 entry):`scripts/git-hooks/pre-push` 函式結尾 `return 0`、`rm` 失敗留警告;新 `tests/pre-push-exit-trap.test.ts`(刪除一般分支 → 0;對照:刪除 main → 1,防有人改成 `exit 0` 變放行);目錄 CTRL-HOOK-003 測試欄與 SKIP 敘述更正;QUICKSTART 未裝 gitleaks 那列更正。
> **審查**:**Codex round 4**(gpt-6-sol／high):R1 2P2(測試依賴 gitleaks 位置、註解漏 `set -e`)→ R2 1P2(測試繼承 mirror 開關)→ R3 0 → Fresh 後 R4 1P2 散文(QUICKSTART),收斂。Fresh 1 輪 1 CRITICAL(缺本 entry)＋7 INFO(對照測試、rm 警告、目錄已修;pre-commit 同形、BASH_ENV、CHANGELOG 接受)。
> **驗證**:新測試修前紅、修後綠;check:catalog 綠。
> 📊 成本:CC ~1h / Codex 4 rounds（2P2 → 1P2 → 0 → 1P2 散文，收斂） / 0 P1 / 4 P2

---

📅 2026-09-23 ㉛ — **LESSONS:新增 CI gate 要先確認 bot 開的 PR 過得了**

> **緣起**:㉚(#106)教訓 ⑮ 只寫在 progress entry,Owner 指示補進 LESSONS.md。
> **改動**(1 檔 + 本 entry):`.claude/memory/LESSONS.md` 新增 2026-09-23 條目——情境(#95 gate 擋 #103 #104)、根因(只列人/AI 繞過路徑,沒列會開 PR 的 bot)、可操作避免法(列 actor 清單、bot 豁免用認證身分 + 檔案範圍、補跑被跳過的測試)。
> **審查**:LESSONS 的 SOP / 守門規則段屬治理文件,依 SOP 不走 docs-only 車道。**Codex round 1**(gpt-6-sol):no actionable findings,收斂。Step 4.5:無程式 / 設定改動,人工判定 CSO_NOT_REQUIRED。Step 5 sanity skip:單檔散文、無 code 消費、Codex 已收斂。
> **驗證**:check:doc-size / check:doc-refs / check:progress-codex 綠。
> **⭐ 發現**:`LESSONS.md` 不在 check-progress-codex-review 的 DOCS 白名單,所以只改 LESSONS 的 PR 也必須附 entry。和 SOP「LESSONS 規則段屬治理」一致,本次不改。
> **⏭️ 下一棒候選**(hint 非 truth):#103 #104 已留言 `@dependabot rebase`,等 CI 綠後由 Owner 合併。
> 📊 成本:CC ~15min / 跨模型 review 1 round / 0 P1 / 0 P2

---

<!-- ㉚ CTRL-CI-018 dependabot 豁免 已於 ㊳(2026-10-19,LESSONS 4 個工具坑)進 archive(依 20 KB 額度慣例) -->
---

<!-- ㉙ port Team W Sprint CM 已於 ㉟(2026-10-19,branch-protection actions SHA-pin)進 archive(依 20 KB 額度慣例) -->
---

<!-- ㉘ Sprint I 已於 port Team W Sprint CM2(2026-09-30 ㉝)進 archive(依 20 KB 額度慣例) -->

---

<!-- ㉗ Sprint H 已於 CTRL-CI-018 dependabot 豁免(2026-09-23 ㉚)進 archive(依 20 KB 額度慣例) -->
---

<!-- ㉖ port Team W Sprint A 已於 Sprint I(2026-09-18 ㉘)進 archive(依 20 KB 額度慣例) -->

---

<!-- ㉓ CLAUDE.md refactor 已於 port Team W Sprint CM(2026-09-23 ㉙)進 archive(依 20 KB 額度慣例) -->
---

<!-- ㉒ port SOP-tune v2 已於本 sprint(loadHarnessConfigOrFail wrapper)進 archive(依 20 KB 額度慣例) -->
<!-- ⑳ governance sprint CI-016 已於 port Team W Sprint CM(2026-09-23 ㉙)進 archive(依 20 KB 額度慣例) -->

> 更早的 entries 見 [progress-archive/progress-2026-10.md](progress-archive/progress-2026-10.md)、[progress-archive/progress-2026-09.md](progress-archive/progress-2026-09.md)
