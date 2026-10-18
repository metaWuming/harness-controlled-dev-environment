# Review scope — 批 9 harness-backsync TODOS P3 (Phase A + B)

## 本 PR 明確排除

- 同 D0-D6 defer 清單（見 plan file）
- workflow yml e2e test harness（D3 defer）
- 追溯搬 batch-8.md 到 archive（D4:政策生效於未來 sprint）
- MARKER_SELF_PR 涵蓋 commit-message scan（批 8 拍板既定政策）
- 「本 repo 只允許 squash merge」宣稱（批 8 Step 5 F3 教訓已納 LESSONS）

## 本 PR 拆刀策略

批 9 = 收乾批 8 (#33) Step 5 defer 進 TODOS P3 的兩條 finding。所有改動都是行為級 fix + 契約對稱 + 診斷用詞精確化 + policy 補寫,無新機制引入。

多個 atomic commits（`git log main..HEAD` 可看）:Phase A（workflow yml `if:` gate 對齊 delivery-branch 白名單）+ Phase B（loadAllowedPrs `< 1e9` + selfPrCount 語意改「env 通道 acknowledge」+ template.md 加 archival 政策）。

⚠️ scope note 刻意不列 commit SHA 清單——批 8 round 4/5 self-referential 死循環教訓。

## 本 PR scope 內請找(round 1 fix 後)

- **round 1 fix 是否引入新表面**:
  - F1(TODOS Markers Check env 加 `,origin/develop`):是否讓 push:develop event 有語意漂移(TODOS Markers Check 對 develop-only PR 的 merge 判定)
  - F2(loadAllowedPrs docstring 加「僅診斷」contract):敘述是否夠明確擋未來 consumer 誤用
  - F3(註解改 `;` 對齊實碼):是否還有其他註解點也漂
  - F4(archival 挪到 CLAUDE.md):Part 4.6 段內加的說明是否位置合理、被導入者留意
- **F1 是否應該補一條 e2e case**:「develop-only PR」情境目前只有敘述、無實際 test 守;是否 defer TODOS P3
- **round 1 前 codex 0 SHIP** vs **Step 5 6 finding**:是否有 mutation 讓兩軸都測不到的假通過
- **F5(!prs.has 死程式碼)已 skip**:是否值得下 sprint 撿(defer TODOS P3 或直接刪)
