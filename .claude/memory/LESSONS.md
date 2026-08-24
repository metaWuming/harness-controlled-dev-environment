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

