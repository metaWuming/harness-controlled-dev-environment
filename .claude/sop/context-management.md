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
| 任務進行中、context 明顯將盡(**已被 compact 過一輪且又逼近**) | **交棒**——比硬撐到 auto-compact 丟細節好 |
| 任務進行中、單次 auto-compact 後仍可續 | 讓 harness 處理,**但先落地三件事**(見下) |
| 任務卡在等外部(CI/法務/Owner 決策)且短期不回來 | **收尾存檔**(狀態進 repo,誰接都行) |

## ⚠️ 大視窗時代的重新校準

本表最初寫於視窗小得多的年代,判準偏保守。現行模型的視窗已到**百萬 token 級,
而且是預設值不是選配**,官方也明講**指令遵循、工具呼叫、推理品質在整個視窗內保持一致**
——不再有「後半段開始退化」這回事。三點要跟著改:

1. **「回應變慢」不再是 context 將盡的訊號。** 回應速度現在主要受**實際生效的 effort
   設定**影響(＝ session 層級的單一值,`.claude/settings.json` / `/config`;**不是** SOP
   各步的 `🎚️` 記號——那是「審查深度提示」,沒有機制在執行它,見
   `plan-mode-checklist.md` 檔頭)。把回應速度當 context 餘量的代理指標會誤判。
   **唯一可靠的訊號是「已經被 compact 過」**——上表已據此收斂。
2. **交棒門檻應該往後拉。** 過去「聊很久了、保險起見先交棒」的直覺,現在多半是
   **過早交棒**:交棒本身有成本(寫 HANDOFF、新 session 重新建立脈絡、
   接手者要重新 git 核實),在視窗還很寬時付這個成本不划算。
3. **但「落地三件事」的紀律不變。** 視窗大不代表對話內容是永久的——
   compact 一樣會發生,檔案一樣是唯一不會被壓掉的東西。

> 📌 **這條校準本身也要被校準。** 模型換代時回來重讀本節,確認前提還成立。

## Context reset / compact 前必落地三件事

壓縮會丟對話細節——這三樣必須先寫進**檔案**(檔案不會被壓掉):

1. **進度**:progress.md 加(或更新)當前 entry——做到哪、下一步第一件事
2. **交棒脈絡**:若任務未完 → HANDOFF.md 或至少 plan file 內補「目前狀態」段
3. **plan file 路徑**:確認 `~/.claude/plans/<name>.md` 反映最新決策(批准後的偏移要回寫)

## 反模式

- ❌ context 將盡還開新的大型探索(fan-out agent)——先交棒
- ❌ 把「壓縮後的摘要記憶」當 ground truth——**hint 非 truth**,接手 session 起手一律 git 核實
- ❌ 為了省 context 跳過 progress doc——省下的 token 會用十倍代價在下個 session 重考古
- ❌ **為了省 context 而 fan-out**:派 subagent 是有成本的,不是免費的 context 節流閥。
  幾個工具呼叫就能自己做完的事直接做(委派規則見 `CLAUDE.md` 原則 5.5)
- ❌ **憑「感覺聊很久了」就交棒**:見上方大視窗校準第 2 點,過早交棒是淨損失
