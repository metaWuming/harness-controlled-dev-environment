---
title: DEGRADATION — 外部依賴降級路徑
type: guide
---

# 外部依賴降級路徑

> 本 harness 的 SOP(`.claude/sop/plan-mode-checklist.md`)引用三個外部工具。
> 它們**都是 optional**:提升訊號密度,但缺席時流程骨架不變,照下表降級執行。
>
> ⚠️ **書面降級,未實測**:下表的降級路徑是設計對照,不是在無工具環境跑過的實測結論。
> 第一次在缺工具環境跑完整 sprint 時,把實際落差記進 LESSONS.md。

## 對照表

| 外部工具 | 在 SOP 的角色 | 沒有時的降級 | 降級後損失什麼 |
|---|---|---|---|
| **Codex CLI**(GPT 系 review) | Step 4 跨模型 review:對本地 diff 迭代到 0 findings | Claude Code 內建 `/code-review high`(fresh-context 獨立審查) | **跨模型多樣性**。經驗值:兩個不同 model 找到的問題幾乎不重疊(cross-model agreement ≈ 0),單模型 review 會漏掉另一系模型才看得到的盲點 |
| **gstack `/cso`**(Chief Security Officer mode) | Step 4.5 條件式安全關:金流/個資/權限/資產轉移面專責安全審 | Claude Code 內建 `security-review` skill;或自派 subagent 用固定安全 checklist(租戶隔離 / IDOR / 權限繞過 / PII 外洩 / 注入 / audit trail)審 diff | 專責模式的訊號密度與慣性(內建 skill 較通用,提示詞打磨程度不同) |
| **gstack `/review`** | Step 5 第二道 review(Claude adversarial + Codex challenge 組合) | Claude Code 內建 `/code-review` + 派**一個** `.claude/agents/adversarial-reviewer.md` 對 diff 獨立審(**從 diff 出發,不是去驗證前一輪的結論**——那會複製盲點) | 組合式多 pass 的覆蓋面 |
| **gstack `/design-review`**(截圖 / 瀏覽器 / 模擬器工具) | Step 4.6 視覺關:把改動的畫面真的跑起來看,對照 design token 抓 finding 並直接修 | 無 gstack 時退回手動:瀏覽器 / 模擬器 / 預覽環境截圖比對;完全無工具時**不要用讀碼推論外觀充數**——明確記錄「視覺關未執行」進 progress entry,並在 PR 描述標注需人工目視 | 視覺回歸完全失守。**這是全表唯一「降級後等於沒做」的項目**:官方明講視覺任務靠工具比靠思考有效,沒工具就是沒做 |
| **gbrain**(語意記憶檢索) | Step 1 起手記憶對抗檢查:`find_contradictions` 抓「新決策與過去拍板衝突」 | 純 git 核實(git log / blame / 讀 progress.md·LESSONS.md·TODOS.md 原文),並在 plan 內揭露「未做語意層檢查」 | 語意層矛盾偵測(文字層靠人眼;跨月久遠的決策衝突較易漏) |
| **take5 / hi5 skills**(收尾存檔 / 交棒) | `.claude/sop/context-management.md` 的兩個動作 | 手動:收尾存檔 = 照 `progress.md` 模板寫 entry + commit;交棒 = 手寫 `_handoffs/HANDOFF.md`(環境快照 / 已完成 / 暫停點 / 決策脈絡 / 待決事項)+ 給新 session 的開局 prompt | 流程一致性靠自律(skill 會強制走完 checklist) |

## 不變的骨架(無論工具在不在)

1. **先本地審乾淨再 push**(review 對本地 diff,不需 PR 存在)
2. **至少兩道獨立 review**(理想跨模型;退而求其次也要 fresh-context 兩 pass)
3. **安全敏感面觸發專責安全視角**(機器判定 `check-cso-trigger` 是下限)
4. **CI 是最終 gate 不是第一道**(keep quality left)
5. **收尾寫 progress entry**(記憶層是 harness 的一部分,不是可選裝飾)
6. **thinking 保持開啟**——這條不是工具依賴,是模型設定。省成本走 effort
   (見 `docs/EFFORT.md`),不要靠關 thinking。關掉會讓工具呼叫洩漏成純文字並
   污染後續 turn,在本流程這種工具密集場景代價最高

## gstack 定位聲明

gstack 是第三方 skill 套件,**本模板不包含其任何檔案、不提供安裝教學**
(license 未確認前不 redistribute)。SOP 內的引用一律附本檔的降級路徑,
確保模板單獨成立。
