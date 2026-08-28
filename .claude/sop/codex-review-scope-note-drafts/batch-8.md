# Review scope — 批 8 harness-backsync TODOS P3 (Phase A + B + round 1-2 fix)

## 本 PR 明確排除

- 同 D0-D7 defer 清單（見 plan file）
- MARKER_SELF_PR 涵蓋 commit-message scan（round 1 拍板不改代碼、對齊 R6 P2-4 既定政策）
- buildDeliveryRefs export refactor（D3 沿用不 export）
- workflow Source-term scan 加 event filter（defer TODOS P3）
- 「本 repo 已 merge」用詞改用「本次放行」——round 2 已改「allowedPrs: N 個 PR 號」

## 本 PR 拆刀策略

批 8 = 收乾批 7 兩條 P3（Phase A+B），加 round 1+2 兩輪 fix。所有 fix 都是 test 覆蓋強化 + 敘述收窄 + 診斷輸出格式改進，無新機制。

五個 atomic commits：Phase A（1536fa7）/ Phase B（4855117）/ round 1 fix（63cdb44）/ round 2 fix（c7d947a）/ round 3 fix（6e746bb，加 B-e4 history-blob 覆蓋）。

## 本 PR scope 內請找

- **round 3 fix 是否引入新表面**：B-e4 新 fixture（add self-ref 檔 → 刪掉 → HEAD tree 乾淨）的邊界正確性；scope note 檔案化是否有 hidden regression
- **B-e4 是否真守到第 2 段**：mutation Z 已驗（history CA mode → strict 讓 6 條紅、B-e4 是其中「HEAD 乾淨獨立守」）；有無其他 mutation 讓 B-e4 假通過
- **loadAllowedPrs 新介面 rare edge**：round 3 已 checked no finding；再驗
- **B-e2/B-e3 兩層斷言**：round 3 已 checked no finding；再驗
- **round 3 前 7 scope**：round 3 全 checked no finding，這輪是否有回歸

## Round 收乾判準

批 7 教訓：5 輪後主動評估收乾。目前 round 3 只 1 P2，findings 已收斂。若 round 4 findings ≤ 1 且屬「該做更多」型，defer TODOS P3 而非本 sprint 修。
