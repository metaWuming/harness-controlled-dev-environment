# SOP 依車道分級、限制 review 輪數

2026-10-18 起,改動依風險分成快速 / 標準 / 高風險三條車道(定義見 `GLOSSARY.md`)。第 2 道 review、破壞性探針、計畫核准只留給高風險車道。每道 review 有輪數上限(快速 1、標準 2、高風險 3 加 1 次全範圍最終審),第 2 輪起只做增量審查並附已處理清單。輪數用完時,嚴重問題一定修完才合併,其餘只記成殘留問題,不自動開 sprint。

**為什麼**:2026-08 到 09 月約 50 個 sprint 平均每個約 3 小時,多數只改措辭卻跑 5–15 輪 review;Step 5 的發現多為 INFORMATIONAL 且多半被 skip 或 defer,defer 又變成新 sprint,形成自我增生的循環。原本的規則是「有資料前不要動流程」(Step 5 條目),這批 progress 紀錄就是那份資料。

**Considered Options**:
- 輕度(只縮文件):省 token,不省時間,循環照舊。
- 重度(連機器關卡一起拿掉):最快,但失去 CI 對安全面的保護。
- 換成 mattpocock/skills:只有提示詞層,沒有機器關卡。改為借用其中的 grill-with-docs / to-tickets / retro。

**Consequences**:機器關卡(CI、gitleaks、保護分支、git hooks)不變。只審增量可能漏掉新舊改動互相影響的問題,高風險車道用最後 1 次全範圍審查補。下游專案暫不同步,模板用過 1–2 個 sprint 後再另開任務。
