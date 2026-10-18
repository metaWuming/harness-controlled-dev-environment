---
title: TODOS
type: note
---

# TODOS

技術債、延後工作、未來迭代項目的中央追蹤表。
每項由哪個 review 產生、優先級、預估工時都要記清楚。

**格式:**
- 🔴 P1: 上線前必做,或會影響既有功能
- 🟡 P2: 上線後 1-3 個月內應處理
- 🟢 P3: 長期 / 有時間再做
- ⚪ IDEA: 未採用但想記下以備將來檢視

**Marker 治理公約**(由 `scripts/check-todos-markers.ts` CI gate 執行):
本檔任何**完成宣稱**(`✅` / 完工 / 已晉升)**必須引用交付 PR 號**(`(#N)` 或 `PR #N`)——
CI 會驗該 PR 有 merge 證據,防打錯號 / 投機性標 ✅。
`[🟡 partial]` / `[❌ pending]` 條目若已有交付 PR merged,要嘛翻 ✅、要嘛補阻塞詞
(⏳ / 卡 / 待外部 / 待拍板)說明為何仍未完。等 Owner 決策的條目,阻塞詞用**待拍板**
(決策請求格式見 `.claude/sop/decision-request-template.md`)。
⚠️ 阻塞詞是**子字串比對**:不要在條目裡寫否定句(如在阻塞詞前加「不再」「已不」)——
照樣會被當阻塞、壓掉 stale advisory。阻塞解除時,直接刪掉阻塞詞、或翻 ✅。
**完成狀態的 SSOT 是本檔與 `TODOS-done.md`(已結案封存)**,記憶層勿抄寫當權威。

---

## P1(上線前必做)

<!-- 範例格式:

### 🔴 <標題>
- **來源**:哪個 review / 健檢 / 教訓產生
- **內容**:要做什麼、為什麼
- **工時**:估算
-->

## P2

## P3

> 已結案條目見 `TODOS-done.md`(2026-10-18 搬移)。

## 觀察中(外部證據,2026-10-18 從 TODOS-done.md 移回)

- **Canonical item**:P3 D-② SIGTERM race(原條目在 `TODOS-done.md`,已加 strikethrough + terminal marker、INSUFFICIENT-EVIDENCE-KEEP-FROZEN current-evidence terminal;canonical 由 A3 defer ⑱ Sprint 14 + A1.1 defer S5 Sprint 16 兩 CLOSED-AS-DEDUPLICATED 引用)
- **唯一 reopen condition**:**P3 D-② SIGTERM 的新 Linux CI deterministic failing regression**(不泛稱 external event、不宣稱永不再開)
- **其他 INSUFFICIENT-EVIDENCE terminal items**(A1.1 non-enumerated 13 + A2 ⑰、evidence 散失):**不帶本段預留的 reopen 條件**;未來若出現新缺陷、走一般 evidence intake

## IDEA

_(無、批 10 收乾)_

---

> **批 10(#35)收乾:P1 = 0 條 / P2 = 0 條 / P3 pending = 0 條**。
> 批 5-10 累積 P3 交付 8 條(批 5 三 / 批 8 兩 / 批 9 兩 / 批 10 三)、
> 現無 backlog。下一棒若需新工作:從 Owner 指示、健康檢查、或新 sprint
> defer 產出的 finding 開新 P3 條目。
