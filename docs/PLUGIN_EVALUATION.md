---
title: PLUGIN_EVALUATION — take5/hi5 做成 Claude Code plugin 的評估
type: assessment
---

# take5 / hi5 → Claude Code Plugin 化評估

> 結論先講:**值得做,但不是現在**。兩個 skill 已高度通用化,plugin 化的邊際收益
> 目前主要是「分發便利」,等模板有第二個以上的外部使用者再做。本檔只評估,不實作。

## 現況

`take5`(暫停封存)與 `hi5`(換 session 交棒)目前是使用者層級的 Claude Code skills
(`~/.claude/skills/{take5,hi5}/SKILL.md`),**不在本模板內**。
它們是 `.claude/sop/context-management.md` 兩個動作的 skill 實作;
沒有它們時照 `docs/DEGRADATION.md` 的手動降級執行。

## 通用性盤點(2026-07-04 讀原始 SKILL.md)

| 面向 | take5 | hi5 |
|---|---|---|
| 路徑硬編 | ✅ 無(全部 `pwd` / `git rev-parse` 動態推導,明文守則) | ✅ 無(同) |
| 專案語意殘留 | ✅ 無(commit 訊息範例是中性的) | 🟡 少量:開局 prompt 讀檔清單含特定檔名(`Coding_Guide_2026.md`、`_context/about-me.md`)、守則舉例含來源專案第三方服務名、使用者名散見 |
| 語言 | 繁中(明文「使用者母語優先,專案 CLAUDE.md 可覆寫」) | 繁中(同) |
| 對 harness 的耦合 | 低:寫 `.claude/memory/progress.md`,與本模板記憶層慣例天然對齊 | 低:寫 `_handoffs/HANDOFF.md`;模板未預建 `_handoffs/`,skill 會自建 |

## Plugin 化的收益 / 成本

**收益**:
1. **分發**:模板使用者一鍵裝 plugin 即得兩個指令,不用手動 copy skill 檔
2. **版本管理**:plugin 有版號,skill 檔散裝無從追蹤誰用舊版
3. **與模板配套**:context-management SOP 引用的動作有官方實作,降級路徑變成 fallback 而非常態

**成本 / 風險**:
1. plugin 打包、發佈、維護的固定成本(marketplace 上架或 git 安裝來源維護)
2. hi5 需先做一輪去識別化(上表 🟡 項)
3. 兩個 skill 的行為仍在演進(來源專案持續打磨),過早凍成 plugin = 又一個會腐爛的分發面
4. skill 檔本身就能用 `--plugin-dir` / 手動 copy 分發,plugin 只是體驗差異

## 建議路線

- **現在(模板 v0.x)**:不做。DEGRADATION.md 的手動降級 + skill 檔手動 copy 已足夠
- **觸發條件(做的時機)**:模板有 ≥2 個外部使用者要求,或 take5/hi5 行為穩定
  超過一季沒改版
- **做的時候**:①先把 hi5 的來源專案殘留去識別化②兩個 skill 打包成單一 plugin
  (`context-handoff` 之類,含兩個 command)③在模板 README 加安裝一行
- **明確不做**:`sync-main` 不入 plugin 也不入模板——它綁「父 repo raw gitlink 追子 repo main」
  的特定結構,無通用價值

## 決策紀錄

- 2026-07-04:初評(本檔)。結論=延後,觸發條件如上。[Owner 可否決:要現在做就開新 sprint]
