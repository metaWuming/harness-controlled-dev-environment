<!--
  AGENTS.md — Codex 對本 repo 的 thin adapter(Sprint 17 B1 引入)

  設計原則:
  - 這份檔 **不重述** CLAUDE.md 的規則。canonical policy = @CLAUDE.md(下方單獨一行,
    Codex 靠這行把 CLAUDE.md 掛進 context)。
  - 只寫「Codex 這一側必需、且無法由 canonical policy 繼承」的最少 overlay。
  - 檢查合約:scripts/check-adoption-readiness.ts A6.codex.*
    (file = git tracked;link = 必須有整行 `@CLAUDE.md`,散文提及不算)。
-->

@CLAUDE.md

## Codex-only overlay

- 遇到 @CLAUDE.md 提到 Claude-specific 的呼叫方式時(例如某個 `/xxx` slash command、某個 skill 名稱、或「開 subagent」的委派動作),先用此 Codex runtime 目前已提供的等價 skill / tool / collaboration capability 完成;該等價能力在此環境實際不可用時,才改走手動步驟或單 agent 執行的 fallback。不預設 Codex 一定有或一定沒有某項能力。
- 其他一切依 canonical policy(@CLAUDE.md)。本檔如與 @CLAUDE.md 衝突,以 @CLAUDE.md 為準。
