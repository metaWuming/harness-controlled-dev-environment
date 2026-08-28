---
title: LESSONS
type: note
---

# LESSONS.md

> 這份檔案記錄本專案在開發/執行過程中踩過的坑、走錯的方向、做出來才發現不對的決策。
> **新 session 開始時,AI 必須先讀取此檔**,確認不會重複犯同樣的錯。
>
> 寫入新教訓時,AI 必須主動告知使用者「我把這個教訓記到 LESSONS.md 了」,不要靜默更新。

---

## 如何使用這份檔案

### 寫入時機
- 修 bug 修了很久才發現原因 → 記下
- 做出來才發現方向錯了,需要打掉重做 → 記下
- 使用者糾正了一個明顯的誤判 → 記下
- 發現某個工具/套件/API 有非直覺的行為 → 記下
- 同一個錯誤已經犯第二次 → **一定**記下,並標註「重複錯誤」

### 不寫入的情境
- 一次性、不會再遇到的環境問題(例如某天網路斷了)
- 純粹的打字錯誤
- 使用者單純改主意,不是因為判斷錯誤

### 排序原則
- 新的教訓**寫在最上面**(倒序),確保最近的問題最容易被看到
- 重大教訓(造成嚴重後果或重複出現的)可在標題加 ⚠️ 標記

### 教訓的升級階梯(harness 核心精神)
1. 第 1 次踩 → 寫進本檔
2. 第 2 次踩 → 條目標 ⚠️「重複錯誤」
3. 第 3 次踩 / 預期會再踩 → 寫進 RUNBOOK / SOP 對應 section + 本檔 footer 反向連結
4. 第 N 次仍踩 → **機器化**(wrapper script / CI step / git hook / lint rule),
   條目 footnote 標「✅ 已自動化」,等季 retro 移入 `LESSONS-archive/`

---

## 教訓格式範本

複製以下區塊新增教訓:

```markdown
## [YYYY-MM-DD] 一句話標題(讓人一眼看懂是什麼問題)

**情境**
當時在做什麼?在哪個檔案/模組/任務脈絡下發生?

**錯誤/誤判**
具體發生了什麼?做了什麼決定或寫了什麼程式碼?

**為什麼會發生**
根本原因是什麼?是假設錯了、文件沒讀、工具行為非直覺、還是溝通落差?

**之後該怎麼避免**
下次遇到類似情境時,該先檢查什麼、先問什麼、或採取什麼不同的做法?
要可操作,不要寫「要更小心」這種空話。

**相關檔案/連結**(選填)
- `path/to/file.ts`
- 相關 commit、issue、文件連結
```

---

<!-- 教訓從這裡開始,新的在最上面 -->

## [2026-08-27] self-PR # citation 三處撞去識別化 denylist:test fixture / TODOS 補號 / CI push event

**情境**
Harness backsync 批 5 sprint(TODOS P3 三支清理,squashed as #30)在 Step 6 push + CI 時,連續踩到**同一類問題**的三個變體——都是「self-PR # 引用」被去識別化 gate 誤判為「來源專案 PR 引用洩漏」。

**錯誤/誤判**
- (1)**test fixture**:`tests/check-bookkeeping-commit.test.ts` 內寫 fixture 字串直接用「PR 井號+虛構編號」語法(此處刻意用中性描述避免本檔又踩同樣的 gate)→ local commit 綠、但 push 前跑 `check:no-source-terms` 掃 git 全史 blob 命中「PR 井號+數字」denylist、扣紅。fix:rebase 那個 commit + 改 fixture 為「(已交付)」避開 pattern
- (2)**TODOS 補 self-PR**:Step 6 開 PR 拿到本 PR 號後補進 TODOS.md 三個 placeholder 用「PR 井號+號」格式 → commit-msg hook 掃訊息也擋、掃 working tree 也擋。fix:改用「(#N)」格式(check-todos-markers.ts 明說也支援這格式,`#` 開頭+數字不撞 denylist)
- (3)**CI push event 沒傳 MARKER_SELF_PR**:PR CI 兩個 run,pull_request event pass、push event fail。SOP L410 說 `MARKER_SELF_PR` 允許 CI 驗自我引用,但 workflow yml push event 沒對齊 SOP、缺這個 env

**為什麼會發生**
- deny list `scripts/deny-terms.txt` 用**純 regex** 擋 `PR #[0-9]`——這條原本是為了防「來源專案的 PR 引用文字」洩漏,但 regex 沒辦法區分「來源專案 PR」vs「本 repo self-PR」
- 現有豁免只覆蓋 `check-todos-markers.{ts,test.ts}`(縮減 pattern 集豁免),SOP 也只在 CI env `MARKER_SELF_PR` 針對 CI 一處補位——**沒覆蓋:test fixture 用示例 PR 號、TODOS 補 self-PR 引用、CI push event 補位漏**
- 這三處都在**第一次真的走到 Step 6 補 citation** 的 sprint 才被連續踩到——#29 sprint 也沒補 PR 號到 TODOS,所以是首次接觸

**之後該怎麼避免**
- **格式紀律**:所有 TODOS / progress / PR body 內的 **self-PR 引用一律用 `(#N)` 格式**——check-todos-markers 認、denylist 不擋(pattern 是 `PR #[0-9]`、不含裸 `(#`)。已用示範:progress entry `📅 2026-08-27 ②`
- **test fixture 紀律**:寫 test fixture 需要 PR # 引用時,**不寫 `PR #<num>` 字面**——用 `(#<num>)` 或「已交付/完工」代替
- **workflow yml 修法**(已在批 6 交付):`.github/workflows/ci.yml` 的 TODOS Markers Check step 用 `if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch) || github.ref == 'refs/heads/develop'`——**只 skip 非 delivery branch 的 push**(feature/* fix/* chore/* 等),PR event 與 default_branch(main/master/…)/develop push 都仍驗。⚠️ 三輪 review 收斂:round 1 拆掉「完全 skip push event」的黑名單(mainline gate 缺口)、round 2 拆掉「以 feature/* prefix 判非 delivery」的硬碼(對 fix/** chore/** 導入者失效)、round 3 拆掉「main/develop 硬碼名稱」(改 default_branch 動態抓、涵蓋 main/master/trunk)——最終規則是 **delivery branch 白名單、default_branch 動態抓 + develop 補 GitFlow**;導入者若加**固定名的**額外 delivery(如 `release`),**三處**都要同步——(1)`on.push.branches` / `on.pull_request.branches` event filter(在更上層擋觸發)+(2)workflow 內 `if:` 條件(default_branch 動態抓自動涵蓋主線 rename,額外 delivery branch 要手動加)+(3)給 marker check 傳 env `DELIVERY_REFS=<refs>`(逗號分隔,如 `origin/release`——remote-tracking ref 需先 fetch 進 local)——**不是**在 script 內硬碼慣例名(round 6 抓到:legacy master/trunk 分支存在時,無條件 resolve 那些慣例名會讓非 delivery branch 的 `(#N)` 假通過)。⚠️ **glob 不支援**——`release/**` 這種 versioned release branch 要自己延伸 script(rev-parse 不展開 glob;workflow `if:` 也只做字面比較)。script 本身用**四條來源**依序合流:①`origin/HEAD` 動態抓當前 default → ②env `DELIVERY_REFS` → ③fallback origin/develop → ④last-resort 本地 main/develop(仍有 round 6-like 風險但命中率極低,tolerate 作離線 fallback)。三處錯任一 → gate 假紅或 silent skip
- **教訓階梯升級(已於批 7 交付)**:三處撞同一 denylist,達第 4 次前置攔截——已把 self-PR # 檢測從 denylist regex 升級成**上下文感知的 checker**(scripts/check-no-source-terms.ts):兩條 pattern(`PR #[0-9]` / `pull/[0-9]`)命中的 hit 若引用的 PR 號 ∈ 本 repo delivery refs 已 merge 集合則放行,其他 pattern 保持嚴格擋;commit-msg hook 保持嚴格擋不做 context-aware(分層策略)


## [2026-08-27] 外部 review 工具的「額度重置時間」訊息不可信,降級路徑要當常態預案

**情境**
風險車道升級 sprint,Step 4 跨模型 review 跑到 round 8 時 Codex CLI 回
「usage limit,try again at 4:48 PM」。等到 16:48 之後重試,同樣的錯誤照樣出現
(訊息裡的重置時間仍寫 4:48 PM)。

**錯誤/誤判**
把錯誤訊息裡的重置時間當成可靠的排程依據,先排了等待再重試,浪費一段時間。

**為什麼會發生**
額度可能是滾動窗口或多層上限(單日/單週),錯誤訊息只顯示其中一層的時間;
重置時間過了不代表所有層都解鎖。

**之後該怎麼避免**
外部工具額度被擋時:重試一次確認 → 立刻切 `docs/DEGRADATION.md` 的降級路徑繼續走,
不要停等重置時間。降級輪要在 progress entry 明確記「哪一輪是降級、用什麼工具」。
本次同時完成了 DEGRADATION 表「書面降級,未實測」的第一次實測:內建
/code-review high 作為 Codex 缺席的替代,實際可用,且與 Codex 的發現幾乎零重疊。

**相關檔案/連結**
- `docs/DEGRADATION.md`(Codex CLI 列)
- progress.md 2026-08-27 ① entry

## [2026-08-27] 新 SOP 規則寫完,先拿自己的 repo dogfood 一遍再送審

**情境**
同一 sprint,為 Step 4.5 新加「fail-closed 的 CSO_REQUIRED = 先排除障礙、排除前
不得進 Step 5」規則。寫完後在本 repo 實際跑 `npm run check:cso` 走流程。

**錯誤/誤判**
規則沒考慮「模板 repo 本身的路徑表刻意出廠為空」——照字面執行,模板 repo 的每個
sprint 都會在 4.5 永久卡死(障礙無法排除,因為空表是設計)。9 輪 review(含跨模型)
都沒抓到這個自我死鎖。

**為什麼會發生**
規則是對「採用者 repo」的心智模型寫的;review 也都在讀文字、沒有人把規則對
「模板 repo 自己」實際執行一次。可執行性缺陷要靠執行才浮現。

**之後該怎麼避免**
凡是新增「必須滿足 X 才能繼續」的 gate 條款:送審前,把條款對本 repo 當下狀態
實際走一遍(跑該跑的命令、照字面判定),看會不會卡死或空集合通過。
這比多一輪文字 review 便宜,抓的是另一類缺陷。

**相關檔案/連結**
- `.claude/sop/plan-mode-checklist.md` Step 4.5(模板 repo 例外條款)

## [2026-08-28] 引用 SOP 條款當前提前,先 grep 驗那條款真存在且說的是那個意思

**情境**
批 8 codex round 1 抓到 P1「MARKER_SELF_PR 對 commit-message scan 無效但敘述宣稱過寬」。
round 3 codex pushback「squash-only 前提已明列於 CLAUDE.md Step 6 及 SOP Step 6、
無需再補」,我當場採信這句話、進 round 3 fix commit。批 8 Step 5 adversarial reviewer
獨立 grep 驗證這句 pushback:CLAUDE.md L203「CI 綠 → squash merge」是 SOP Step 6 的
建議動作、不是 repo-wide 硬性政策;CLAUDE.md L265 是給導入者填的 placeholder、例子
甚至寫「feature→develop squash、develop→main merge commit」——與「squash-only」不符。

**錯誤/誤判**
Codex 的「已明列於 X」pushback 沒有實際 grep 驗證就採信。實情是那句「明列」是誤述,
但因為 `parseAllowedPrs` code 對 squash 尾綴 + merge commit 兩種 subject format 都
robust(L124-142),行為沒被誤導。屬「決策 audit trail 小瑕疵」而非行為缺陷。

**為什麼會發生**
Codex 說「已在 X 明列」時、我把它當事實接受。跨模型 review 的價值之一正是「彼此無
證據時的判斷會漂」——這條 pushback 若引到別的 sprint、code 沒 robust 處理兩種 format
就會踩坑。

**之後該怎麼避免**
Codex(或任何 review 工具)以「該假設已在 X 明列/該政策已存在於 Y」為前提時,採信
前先 `grep -n "<那條款>" <那個檔>` 驗一句話。⚠️ 特別警戒的字眼:「已明列」「無需
再補」「既定政策」——這些是「該做更多」型 finding 的常見拒絕理由,但拒絕理由本身
可能是誤述。

**相關檔案/連結**
- `scripts/check-no-source-terms.ts` L124-142(parseAllowedPrs 對兩種 format 都 robust)
- 批 8 Step 5 F3 finding(進本教訓的來源)

## [2026-08-28] Codex 兩輪對同一 pre-existing 問題發抓相反面 = 該做更多型信號、defer 不修

**情境**
批 9 sprint 修批 8 Step 5 defer 進 TODOS P3 的 F1(TODOS Markers Check
env 缺 `,origin/develop` → GitFlow PR 誤擋)。Round 1 我加了 `,origin/develop`。
Codex round 2 說「加了會讓 main-only 專案 abandoned develop 誤放行(round-6
假通過)」→ 我 revert。Codex round 3 說「不加讓 GitFlow-only PR 假紅」→
拉扯相反方向。

**錯誤/誤判**
Round 1 修 F1 沒識別到這是 pre-existing 兩難(main-only 安全 vs GitFlow
涵蓋)。兩輪 codex 從相反方向各抓一次同一 root cause,我需要多輪才意識到。

**為什麼會發生**
Pre-existing 決策(batch 7 R3-4 在 Source-term scan 選了「加 develop」)
本身就在 trade-off 一端;修 TODOS Markers Check 對齊 Source-term 是「複製
既有選擇」,codex 反而抓到那個既有選擇的另一半 downside。

**之後該怎麼避免**
Codex 兩輪(或多輪)對同一 pre-existing 問題發抓**相反面**時,那不是「修得
不夠好」而是「該做更多」型 finding 的變體——policy 兩難、單方向 fix 都會
再被抓另一面。訊號一出現:
1. 停止 fix、把兩面 finding 都寫進 workflow yml 或 code 註解(讓下個讀者
   看到 trade-off、不會再重複這輪 review)
2. defer TODOS P3、由 Owner 決策政策方向(而非跨 review 輪次靠 codex 拉扯)
3. 若同 pre-existing 兩難散落多個 call site(本例:TODOS Markers Check +
   Source-term scan 兩 workflow steps),對齊方向要**跨全部 call site 統一**、
   不要單點動

**相關檔案/連結**
- `.github/workflows/ci.yml`(TODOS Markers Check env + Source-term scan env
  對 `origin/develop` 的相反選擇)
- 批 9 Step 5 codex round 2 P2-1 vs round 3 P2-1(同 root cause 相反面)

## [2026-08-28] GitHub template 的 CLAUDE.md 會被 `Use this template` 複製、放 harness-internal 政策要小心

**情境**
批 9 Step 5 F4 修法把 archival 政策從 scope-note-template.md 挪到
CLAUDE.md Part 4.6 Git 規範段。Step 5 二輪 F-round23-2 抓到:CLAUDE.md
是 GitHub template 檔、`Use this template` 會複製,archival 政策裡的
「batch-N.md」「3-5 sprint」「月檔 append」是本 harness 專用慣例,importer
會直接繼承這些不明所以的 policy。

**錯誤/誤判**
把 harness-internal 治理(batch-N sprint 慣例)放進會分發給 importer 的
CLAUDE.md,原意是「集中在一個檔」,實際是「污染 downstream」。

**為什麼會發生**
harness template 的 CLAUDE.md 有雙重身份:(a) 本 repo 自己的協作守則、
(b) importer 複製過去的起點。修檔時只想到 (a)、忘了 (b)。

**之後該怎麼避免**
往 CLAUDE.md 加內容前先問「這條 importer 用得到嗎?若不用,是否會困擾?」:
- 使用得到(通用工作守則、Git 規範)→ 直接加
- 用不到但無害(可留空 placeholder)→ 加、標「導入者可刪」
- 用不到且會誤導(硬碼 batch-N.md 之類本 harness 專用命名)→ 不寫進 CLAUDE.md,
  改寫在只本 harness 用的檔(例:`.claude/memory/`、或新建一個明確 harness-only
  的檔、不隨 template 複製——命名 `MAINTAINER.md` 或類似 pattern 都可)

若真要放 CLAUDE.md,寫成 placeholder-style + 明「導入者注意:若不採 X 可
整段刪除」尾註(批 9 round 3 的實際修法)。

**相關檔案/連結**
- `CLAUDE.md` Part 4.6 Git 規範段(archival 條目)
- 批 9 Step 5 F4 → round 3 P2-2 → Step 5 二輪 F-round23-2 迭代

## 流程/工具

- 🔴 **[2026-08-24] BACKLOG / TODOS 標「刀 X ✅」的 bookkeeping 必須併進該刀 feature
  branch、跟 progress entry 走同一輪 CI**(來源專案某 sprint 踩過並修完,同語意 port
  進本模板)。

  **root cause**:把 BACKLOG / TODOS update 想成「Step 7 收尾」(合完主線之後),但主線
  是 protected → 直接 push 被擋 → 只能開獨立 PR、多跑一輪 gates (~5 min) + Vercel/deploy
  (~3-5 min) = 對 docs-only 一行改動純浪費。

  **正確做法**:
  - Step 5 寫 progress entry 時,**同一個 commit 或緊接的下一個 commit** 把 BACKLOG /
    TODOS 相關 ✅ 條目也標好,一起 push 進 feature branch。標「Sprint X ✅」是 pre-merge
    可知的資訊,跟 progress entry 同型。
  - PR 號本身也可以 pre-merge 補:Step 6 `gh pr create` 拿到 PR 號後、補一個 commit 填
    TODOS ✅ 的 `PR #___` 引用位再 push。`MARKER_SELF_PR` 允許 CI 驗自我引用
    (`scripts/check-todos-markers.ts` L24-25)。

  **SOP Step 5 對 progress 的紀律要一併套 BACKLOG / TODOS**——三份 memory 檔的
  bookkeeping(含 PR 號 citation)都是 pre-merge 該寫的、不要留給 Step 7。SOP 已同步
  更新(Step 5 bookkeeping 新增 sub-bullet、Step 6 加 PR 號 fill-placeholder stop
  condition、Step 7 TODOS 更新改成「已在 Step 5/6 完成、此步驟不重複」)。

  **相關檔案**
  - `.claude/sop/plan-mode-checklist.md` Step 5-7
  - `scripts/check-todos-markers.ts` L24-25(`MARKER_SELF_PR`)

