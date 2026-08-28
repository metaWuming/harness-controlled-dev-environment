# Review scope — 批 8 harness-backsync TODOS P3 (Phase A + B + round 1-2 fix)

## 本 PR 明確排除

- 同 D0-D7 defer 清單（見 plan file）
- MARKER_SELF_PR 涵蓋 commit-message scan（round 1 拍板不改代碼、對齊 R6 P2-4 既定政策）
- buildDeliveryRefs export refactor（D3 沿用不 export）
- workflow Source-term scan 加 event filter（defer TODOS P3）
- 「本 repo 已 merge」用詞改用「本次放行」——round 2 已改「allowedPrs: N 個 PR 號」

## 本 PR 拆刀策略

批 8 = 收乾批 7 兩條 P3（Phase A+B），加 round 1+2 兩輪 fix。所有 fix 都是 test 覆蓋強化 + 敘述收窄 + 診斷輸出格式改進，無新機制。

四個 atomic commits：Phase A（1536fa7）/ Phase B（4855117）/ round 1 fix（63cdb44）/ round 2 fix（c7d947a）。

## 本 PR scope 內請找

- **round 2 fix 是否引入新表面**：loadAllowedPrs 改回 object 介面、A-e2 fixture 加尾隨空白、B-e3 加 1.5、SSOT 敘述收窄
- **loadAllowedPrs 新介面**：selfPrCount 只在 !prs.has(selfPr) 條件下設 1，若 delivery ref 已有此 PR#（rare edge：sprint 內 self-PR # 剛好也是既有 merged PR）行為是否正確
- **診斷輸出「delivery 已 merge M + self-PR K」**：M + K 是否恆等於 allowedPrs.size，若不等會誤導
- **B-e2/B-e3 兩層斷言**（「allowedPrs: 0 個 PR 號」+「self-PR 0」）：是否有 mutation 讓其中一個斷言綠但另一個紅仍不合理
- **workflow yml 收窄後的註解**：是否足以讓 CI 導入者讀懂該 env 用途、還是太簡略
- **A-e2 fixture 前尾都有空白**：是否還有守不到的 whitespace 場景（tab、newline in env value）
- **round 1 P1 拍板的 canonical squash 前提**：是否需要在 SOP 或 CLAUDE.md 明列本 repo 只允許 squash merge、否則未來若 repo 開放 rebase merge，MARKER_SELF_PR 覆蓋範圍宣稱會失效
