#!/usr/bin/env bash
#
# scripts/setup-hooks.sh — opt-in setup for git hooks(pre-commit + commit-msg + pre-push)
#
# 把 git config core.hooksPath 指向 scripts/git-hooks/,一次啟用該目錄內所有 hook:
#   - pre-commit:保護分支(develop/main)程式碼 commit 守衛
#   - commit-msg:commit 訊息的去識別化前置檢查(deny-terms.txt 不在時自動 no-op)
#   - pre-push:本機 gitleaks 秘密掃描 + 保護分支 code push 確認
# 若使用者已經設了其他 hook manager(husky / lefthook
# / 其他 path),拒絕覆蓋以免破壞既有工作流。
#
# 用法:`npm run setup-hooks`(對應 package.json scripts)

set -e

TARGET="scripts/git-hooks"

# 1. 偵測 core.hooksPath 是否已設為其他 path
current=$(git config --get core.hooksPath 2>/dev/null || true)
if [ -n "$current" ] && [ "$current" != "$TARGET" ]; then
  echo "⚠️  git config core.hooksPath 已設為:$current"
  echo "    (可能是 husky 5+ / lefthook 1.x / 其他 hook manager 的配置)"
  echo ""
  echo "    本專案的 pre-push hook 在 $TARGET/"
  echo "    若要切到本專案 hook,先解除既有設定:"
  echo "        git config --unset core.hooksPath"
  echo "    然後再跑一次 \`npm run setup-hooks\`。"
  echo ""
  echo "    若要保留既有 hook manager,把本專案 hook 整合進去(複製"
  echo "    scripts/git-hooks/pre-push 邏輯到既有 hooks 流程)。"
  exit 1
fi

# 2. 已 setup 過(rerun)→ 直接 no-op 成功,不重做 legacy 偵測
#    (rerun idempotency,避免把自己的 hook 當 legacy)
if [ "$current" = "$TARGET" ]; then
  echo "✓ git hooks 已指向 $TARGET/"
  exit 0
fi

# 3. 偵測 .git/hooks/ 內既有 hook(legacy husky 4.x / lefthook v0 / 手動 hook)
#    若 core.hooksPath 還沒設但 .git/hooks/ 有可執行 hook,覆蓋會讓 git 忽略它們。
#    用 literal `.git/hooks`(透過 --git-common-dir,跨 worktree safe)而非
#    --git-path hooks(會被 core.hooksPath 影響)
git_common_dir=$(git rev-parse --git-common-dir 2>/dev/null || echo .git)
hook_dir="$git_common_dir/hooks"
if [ -d "$hook_dir" ]; then
  # 找 hook_dir 內非 .sample 結尾的可執行檔
  found=$(find "$hook_dir" -maxdepth 1 -type f -perm -u+x ! -name '*.sample' 2>/dev/null | head -3 || true)
  if [ -n "$found" ]; then
    echo "⚠️  $hook_dir/ 內已有可執行 hook(可能是 husky 4.x / lefthook v0 或手動 hook):"
    echo "$found" | sed 's|^|        |'
    echo ""
    echo "    本專案改 core.hooksPath 後,git 會忽略上面的 hook。"
    echo "    若它們不再需要,刪除後再跑 \`npm run setup-hooks\`。"
    echo "    若要保留,先把它們的邏輯複製到 scripts/git-hooks/ 再跑。"
    exit 1
  fi
fi

git config core.hooksPath "$TARGET"
echo "✓ git hooks 已指向 $TARGET/"
