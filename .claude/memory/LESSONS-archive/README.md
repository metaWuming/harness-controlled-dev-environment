---
title: LESSONS Archive — 季 retro 封存區
type: index
---

# LESSONS Archive

> 本目錄存放從 [`LESSONS.md`](../LESSONS.md) 主檔 archive 出來的教訓。
> 主檔保留**仍 active(尚未自動化或仍有教學價值)**的教訓;archive 區存放
> **已自動化(CI / hook / wrapper / config 已 codify)**或**已過時(技術替換、scope drift)**
> 的教訓,完整 trace 保留。

## 為何要做 retro

LESSONS.md 是 AI session 開局必讀的「踩過的雷」清單。隨時間累積會膨脹:
- 新 session 讀取成本 ↑
- 「仍 active vs 已自動化」混在一起,讀者難分辨
- 重要 active 教訓被淹沒

**Retro 不是丟掉教訓,是把「已 codify 進機制」的教訓 archive 留 trace,
讓主檔聚焦在「仍需人類記憶」的教訓**。

## 觸發條件

每 3 個月(**或每 10 條新教訓**)跑一次 retro:同類合併、已自動化的 archive、
refactor memory 防膨脹。**OR 觸發**:任一條件達標即可。

## Archive 結構

```
LESSONS-archive/
├── README.md              ← 你在這裡(總索引 + 各季 retro summary)
├── YYYY-Q[1-4].md         ← 各季 archive 教訓(按曆季組織,每季獨立檔)
└── ...
```

## 進入 archive 的判準

每條 LESSONS 進 archive 必滿足**至少一項**:

1. **已自動化**(主檔 footnote 已標明 automation reference)— 例:CI gate / git hook /
   wrapper script / config flag 已落地,人類不需再記
2. **已過時**(教訓所指 surface area 已從 codebase 消失)
3. **同類合併**(多條同主題教訓被一條更完整教訓 absorb)— 保留最完整那條,archive 子集

不符以上判準的教訓**保留在主檔**(即使日期較舊)。

**Evergreen meta 教訓特例**:基本 SOP 紀律、認知偏誤類、跨 sprint 普世警示
(例:「開發 SOP 不能跳步驟」、「Cross-model agreement ≠ correctness」)**保留在主檔**,
即使可能已半年沒重犯。這類教訓的價值在於「持續提醒」而非「特定 surface 自動化」。

## Archive footnote 規範

每條 archive entry 開頭必含 callout box:

```markdown
> 📦 **Archived**: YYYY-MM-DD(retro 場次)
> **Automation reference**: <一句話描述> — [commit SHA](…) / [file:line](…)
> **判準**: <自動化 / 已過時 / 同類合併>
```

Commit SHA 比 file path 更穩定(file 可能被 rename / refactor,commit SHA 不變)。

## SOP — 怎麼做 retro

**Step 0 — Sprint 完工時順手 pre-mark archive candidate**:
Sprint PR merge 後,順手 grep LESSONS.md 看本 sprint 是否 codify 了哪條教訓 → 若有,
在那條 entry footnote 加「✅ 已自動化」marker(**不立刻 archive**,等季 retro 一起做)。

1. **盤點**:列 LESSONS.md 所有 dated entries + 主題類別分布(`grep -nE "^## \[20" .claude/memory/LESSONS.md`)
2. **Audit 每條**:對照三項判準,標 archive 候選 + 保留候選。Evergreen meta 教訓保留主檔
3. **跟 Owner confirm** archive scope(保留 veto 權)
4. **建 YYYY-Q[1-4].md**:從主檔搬 entries 過去,加 archive footnote callout
5. **主檔 refactor**:移除 archive entries content,保留 stub heading + callout
   (讓 `grep "## \[YYYY-MM-DD\]"` 仍找得到 entry 存在)
6. **寫 retro summary**:本 README 內加 entry,含觀察 + follow-up
7. **走 PR + review**:對齊既有 sprint pattern

## Harness 文件層一致性(隨季 retro 一併做)

**不開新 ceremony** — 每季 retro 時,除了 LESSONS archive,一併做:

**A. 跨文件「檔案引用」失效(機器,自動)**
- 跑 `npx tsx scripts/check-doc-refs.ts`(平時 CI 也跑)
- 它驗 harness 文件的 `@import` / markdown 連結 / 純路徑提及是否指向真實存在的檔案
- exit 1 列出失效引用 → 逐條 triage:檔案搬移/改名 → 改引用;已刪除(被取代)→
  更新或加「已由 X 取代」註記
- ⚠️ 抓到 violation 先親驗 root cause,別照單全收(checker 也可能有 bug)

**B. 語意漂移 / 矛盾(人工)**
- 抽查文件交叉引用的章節編號是否仍對應
- 檢查 guides 與 sensors 是否同步、有無互相矛盾的說法
