---
title: Progress Archive — progress.md 歸檔區
type: index
---

# Progress Archive

> `progress.md` 每 sprint 加一條 entry,會持續膨脹。本目錄存放歸檔出來的舊 entry,
> 主檔只保留最近的 entries,控制新 session 的讀取成本。

## 歸檔慣例

- **主檔保留**:最近 ~10 條 entry(夠接手 session 掌握脈絡)
- **紅線**:主檔超過 ~1500 行就該歸檔(讀取成本開始傷害開局速度)
- **歸檔方式**:把最舊的 entries 整段搬到本目錄 `progress-YYYY-MM.md`(以搬移當月命名),
  主檔尾部留一行指標:`> 更早的 entries 見 progress-archive/progress-YYYY-MM.md`
- **不可變**:歸檔後的檔案視為唯讀歷史,不回頭編輯

## 防呆

- 歸檔後主檔 entry 數不可為 0(至少留最近一條)
- 歸檔前後 entry 總數要對得上(搬移不是刪除,原則 7:失敗要大聲說)
- 若你把此慣例機器化(歸檔腳本),記得在 weekly health check 加「archive parser 自檢」——
  格式一漂移當週就有訊號,而不是等檔案默默漲破紅線
