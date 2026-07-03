# scripts/git-hooks/code-pattern.sh — 「code 檔案」pattern SSOT
#
# pre-push 與 pre-commit 共用同一份 CODE_PATTERN(手抄兩份=漂移地雷)。
# 本檔只定義變數、無副作用,由各 hook `source` 引入。
#
# 白名單設計:
# - core code: .ts/.tsx/.mts/.cts/.js/.mjs/.cjs/.jsx
# - schema / shell / SQL: .prisma/.sql/.sh
# - styles(Tailwind v4 用 CSS-first config): .css/.scss
# - CI/infra YAML: .yml/.yaml
# - infra config 檔 + Makefile: package*.json / vercel.json / tsconfig.json /
#   next.config.* / Dockerfile / Makefile(按你的 stack 增刪)
# - .env* 防禦:雖然 .gitignore 已排除,但若有人誤改 .gitignore
#   或加 .env.example 之外的 env 進 commit,push 應該 trigger
# - hooks 自身也算 code(改 hook = 改守門邏輯,不可繞過 review)
# shellcheck disable=SC2034  # 由 source 方消費
CODE_PATTERN='\.(ts|tsx|mts|cts|jsx|js|mjs|cjs|prisma|sql|sh|css|scss|yml|yaml)$|(^|/)(package\.json|package-lock\.json|vercel\.json|tsconfig\.json|next\.config\..*|prisma\.config\.ts|vitest\.config\.ts|eslint\.config\..*|postcss\.config\..*|Dockerfile|Makefile)$|(^|/)\.env(\..*)?$|(^|/)scripts/git-hooks/.*$|(^|/)scripts/setup-hooks\.sh$'
