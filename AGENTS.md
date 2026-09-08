<!--
  AGENTS.md — Codex 對本 repo 的 thin adapter(Sprint 17 B1 引入、Sprint 18 B2 加 override boundary)

  設計原則:
  - 這份檔 **不重述** CLAUDE.md 的規則。canonical policy = @CLAUDE.md(下方單獨一行,
    Codex 靠這行把 CLAUDE.md 掛進 context)。
  - 只寫「Codex 這一側必需、且無法由 canonical policy 繼承」的最少 overlay。
  - 檢查合約:scripts/check-adoption-readiness.ts A6.codex.*(file / link / overlay-fill / overlay.parser)+ T10 template skeleton。
-->

@CLAUDE.md

**Precedence(overlay 契約、adopter 必讀)**:

1. CLAUDE.md canonical policy wins over all AGENTS.md overlay content.
2. Within AGENTS.md only:Project-specific Codex overlay overrides Template-shared Codex defaults.
3. Project-specific Codex overlay cannot override CLAUDE.md canonical policy.

## Template-shared Codex defaults

- 遇到 @CLAUDE.md 提到 Claude-specific 的呼叫方式時(例如某個 `/xxx` slash command、某個 skill 名稱、或「開 subagent」的委派動作),先用此 Codex runtime 目前已提供的等價 skill / tool / collaboration capability 完成;該等價能力在此環境實際不可用時,才改走手動步驟或單 agent 執行的 fallback。不預設 Codex 一定有或一定沒有某項能力。
- 其他一切依 canonical policy(@CLAUDE.md)。本檔如與 @CLAUDE.md 衝突,以 @CLAUDE.md 為準。

## Project-specific Codex overlay

<!-- 填:此段供下游專案填自己的 Codex-specific override(例:專案 skill 名、design token 讀法、專屬工具說明)。
若無需要:清空本 section 或刪除本 heading 到下個 heading 之間全部(含此註解)。
Boundary 為下個 `## ` heading。 -->
