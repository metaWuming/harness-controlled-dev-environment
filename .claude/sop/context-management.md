---
title: 上下文管理 SOP — 收尾存檔 / 交棒 / 壓縮判準
type: sop
related: CLAUDE.md Part 2 / .claude/sop/plan-mode-checklist.md
---

# 上下文管理 SOP

> 長對話的 context 是有限資源。本檔把「何時收尾存檔、何時交棒、何時放給自動壓縮」
> 的判準明文化。
>
> 〔工具註記〕「收尾存檔」與「交棒」若有對應 skill(如 take5 / hi5)可直接用;
> 沒有時手動執行:收尾存檔 = 照 `.claude/memory/progress.md` 模板寫 entry + commit;
> 交棒 = 寫 `_handoffs/HANDOFF.md`(現況/下一步/地雷)+ 給新 session 的開局 prompt。

## 一句話分工

| 動作 | 情境 | 產物 |
|---|---|---|
| **收尾存檔** | 任務**完整收尾**或**乾淨暫停**(sprint 結束、下班) | progress.md entry + commit + 記憶更新 |
| **交棒** | context **快用爆但任務未完** → 換 session 接力 | HANDOFF.md + 新 session 開局 prompt |
| **auto-compact** | harness 自動摘要(不需動作) | 摘要 + 剩餘 context 續跑 |

## 判準表(先看任務邊界,再看 context 餘量)

| 任務狀態 × context 餘量 | 動作 |
|---|---|
| sprint 已完整收尾(PR merged + doc 更新) | **收尾存檔**(或 sprint SOP Step 7 已涵蓋即不必另跑) |
| 任務進行中、context 還很充裕 | 繼續做,不要為壓縮而壓縮 |
| 任務進行中、context 明顯將盡(回應變慢/已被 compact 過一輪且又逼近) | **交棒**——比硬撐到 auto-compact 丟細節好 |
| 任務進行中、單次 auto-compact 後仍可續 | 讓 harness 處理,**但先落地三件事**(見下) |
| 任務卡在等外部(CI/法務/Owner 決策)且短期不回來 | **收尾存檔**(狀態進 repo,誰接都行) |

## Context reset / compact 前必落地三件事

壓縮會丟對話細節——這三樣必須先寫進**檔案**(檔案不會被壓掉):

1. **進度**:progress.md 加(或更新)當前 entry——做到哪、下一步第一件事
2. **交棒脈絡**:若任務未完 → HANDOFF.md 或至少 plan file 內補「目前狀態」段
3. **plan file 路徑**:確認 `~/.claude/plans/<name>.md` 反映最新決策(批准後的偏移要回寫)

## 反模式

- ❌ context 將盡還開新的大型探索(fan-out agent)——先交棒
- ❌ 把「壓縮後的摘要記憶」當 ground truth——**hint 非 truth**,接手 session 起手一律 git 核實
- ❌ 為了省 context 跳過 progress doc——省下的 token 會用十倍代價在下個 session 重考古
