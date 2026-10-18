# Harness 開發流程

本 harness 用來管 AI 協作開發的流程與關卡。本檔只放流程用語,實作細節看 `.claude/sop/plan-mode-checklist.md`。

## 車道

**車道**:
一次改動依風險分到的流程等級。決定要不要寫計畫檔、review 跑幾道、幾輪。
_Avoid_: 模式、等級、lane(中文文件內)

**快速車道**:
不碰安全面、且改動小(最多 3 個檔或 100 行)的改動。不寫計畫檔、不審計畫,只跑 1 輪 review。
_Avoid_: 例外流程、trivial 流程

**標準車道**:
不碰安全面、但超出快速車道大小的改動。寫計畫檔,跑 1 道 review。
_Avoid_: 完整 SOP、一般流程

**高風險車道**:
碰到安全面的改動。加跑安全審、破壞性探針與第 2 道 review。
_Avoid_: CSO 車道、嚴格模式

**安全面**:
金流、權限、個資、資產轉移、audit trail、CI 設定、資料庫結構。
_Avoid_: 敏感區、安全邊界(指同一件事時)

## Review

**一道 review**:
一個審查者(Codex 或 Claude)對同一份改動的整段審查,可包含多輪。
_Avoid_: 一關、一層

**一輪**:
審查者看一次、回報一次 finding。一道 review 有輪數上限。
_Avoid_: round(中文文件內)、pass

**增量審查**:
第 2 輪起只審上一輪送審之後新增的改動,不重審整支分支。
_Avoid_: delta review、重審

**已處理清單**:
送審時附上的前幾輪 finding 與處置結果,讓審查者不重提同一個問題。
_Avoid_: ledger、finding 紀錄

**嚴重問題**:
Codex 標 P1 或 Claude 標 CRITICAL 的 finding。輪數用完也一定要修完才能合併。
_Avoid_: blocker、必修項

**殘留問題**:
輪數用完時還沒修的非嚴重 finding。只在進度紀錄寫一行,不自動進 TODOS、不自動開 sprint。
_Avoid_: defer、延後項目
