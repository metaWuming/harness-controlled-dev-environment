# shellcheck shell=bash
# scripts/git-hooks/code-pattern.sh — 「什麼算 code / 什麼是 PR-only 文件」的 SSOT
#
# pre-push 與 pre-commit 共用本檔(手抄兩份=漂移地雷)。
# 本檔只定義變數、無副作用,由各 hook `source` 引入。
#
# 🔴 default-deny(取代舊白名單設計)。舊版是白名單「列出哪些副檔名算 code」,
# 實測會把這些當「文件」放行直推保護分支:
#   `bunfig.toml` / `.npmrc` / `.yarnrc.yml`(preload / registry 改指向攻擊者)、
#   `.gitleaks.toml`(把秘密掃描整個關掉,然後把密鑰貼進 `.md` 也照樣綠)、
#   `.gitignore`(放寬後 `check-ignore` 跳過面跟著放寬)、
#   `.github/CODEOWNERS`(決定誰必須 approve)、
#   `public/` 底下的 `.svg` / `.html`(同源 stored XSS)、
#   `package-lock.json` 等其他 lockfile。
# 白名單永遠追不完 → 反過來:**只有純說明文字(.md / 指定資料夾內的 .html)算文件,
# 其餘一律算 code。**
#
# 為什麼區分 code 與文件:文件類(progress / LESSONS / TODOS / *.html runbook)
# 不需要 code review 那種強度的把關。**但 PR-only 的策略／安全／spec 文件例外**,
# 見下方 PROTECTED_DOCS。
#
# 🔴 保護分支的 doc-only 直推在多數 GitHub ruleset 設定下形同空轉(server 端仍會擋
# required status check)。本 hook 這條分支保留是**縱深**——本機這層不該假設遠端
# 一定守得住。日常路徑一律是 feature 分支 + PR,文件也一樣。
#
# 🔴 `.html` 只放行 `docs/` 底下:若全域放行 `.html`,像 `public/evil.html` 這種
# 同源可讀 session 的檔就會零阻力進主分支。狹窄放行避免這條攻擊面。
#
# shellcheck disable=SC2034  # 由 source 方消費
NON_CODE_PATTERN='\.md$|^docs/[^/]*\.html$'

# PR-only 禁區文件:雖是 .md,但屬 CLAUDE.md「禁區清單」＋ SOP「一律跑完整流程」
# 的治理 / 安全 / spec 文件 → 在保護分支上直接 commit 或直推一樣要擋。
#
# 預設值涵蓋**模板本身實際附帶或最常見**的治理／spec 檔:
#   - `CLAUDE.md`(模板附帶的 AI 協作行為守則、屬治理正本)
#   - `.claude/sop/`(模板附帶的 SOP 目錄)
#   - `SPEC.md` / `ARCHITECTURE.md` / `GOVERNANCE.md`(root 級策略文件通用範例)
#   - `docs/architecture/`(ADR 目錄,code 之後要照抄的 spec)
# 常見增補(依專案情況):
#   - `AGENTS.md` / `DESIGN.md` 等治理文件(root)
#   - `docs/SECURITY.md` / `docs/THREAT_MODEL.md` / `docs/BRANCH_PROTECTION.md`
#
# 🔴 修 Codex R1 P1:上一版 PROTECTED_DOCS 未涵蓋模板現有的 `CLAUDE.md`
#    與 `.claude/sop/`,使這些治理文件會被當作一般 `.md` 放行。
#    補上模板實際附帶的治理文件路徑。
#
# ⚠️ Pattern **case-sensitive**:`^CLAUDE\.md$` 不 match `claude.md`;
#    `^\.claude/sop/` 不 match `.claude/SOP/`。macOS 案例不敏感 FS 上,git
#    rename 會列出 canonical path 的 delete 端仍會被 match(`--no-renames`
#    效果),但**新建**大小寫變體的檔案 (如 `.claude/SOP/new.md`) 會漏抓。
#    正式使用時建議 canonical 路徑一致。
#
# ⚠️ 兩支 hook 都要套用(舊版只有 pre-commit 有,pre-push 完全沒套 → 在 feature
#    分支 commit 完再 `git push origin feature:develop` 就被判 docs-only 無聲直推)。
#
# shellcheck disable=SC2034
PROTECTED_DOCS='^CLAUDE\.md$|^\.claude/sop/|^(SPEC|ARCHITECTURE|GOVERNANCE)\.md$|^docs/architecture/'
