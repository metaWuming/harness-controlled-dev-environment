#!/usr/bin/env bash
#
# scripts/check-hooks.sh — 「本機 git hooks 真的活著嗎」liveness 斷言
#
# 可控開發環境 Layer 3。為什麼需要這支：
#   git hooks 是 opt-in（`core.hooksPath` 需要每台機器自己設一次），而 git 對
#   「hooksPath 指向不存在的目錄」**不會報錯** → 一次不小心的搬檔、更名，本機守門
#   就能靜默失效很久，沒有任何徵兆。當你在意的規則正好是「動 X 之前擋一下」，靜默
#   放行等於沒有守門。
#
#   這支就是「守門機制要定期實證它還活著」這條紀律的機器化。
#
# 檢查四件事：
#   1. `core.hooksPath` 有設，且解析後等於本 repo 的 `scripts/git-hooks`
#   2. `pre-commit` / `pre-push` 檔案存在
#   3. 兩支都有可執行位元（git 不會執行沒有 +x 的 hook，而且**不會抱怨**）
#   4. `code-pattern.sh`（SSOT）存在、可被 source，且兩個 pattern 變數方向沒反
#
# 注意：這支只驗「hook 會被 git 呼叫」＋「SSOT 兩個 pattern 的方向」，不驗 hook
# 分支邏輯是否正確——後者靠 `tests/` 底下的守門測試與拋棄式 clone 裡的實跑。
#
# Usage:  npm run check:hooks        # 或 bash scripts/check-hooks.sh
# Exit:   0 = 活著 / 1 = 沒在跑（訊息會講怎麼修）

set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$REPO_ROOT" ]; then
  echo "✗ 不在 git repo 裡，無法檢查 hooks" >&2
  exit 1
fi

EXPECTED_ABS="$REPO_ROOT/scripts/git-hooks"
CONFIGURED="$(git config core.hooksPath 2>/dev/null || true)"

fail() {
  {
    echo ""
    echo "✗ 本機 git hooks 沒在跑：$1"
    echo ""
    echo "   修法：bash scripts/setup-hooks.sh"
    echo "   （git 對「hooksPath 指向不存在的目錄」不會報錯——本模板已把這個靜默失效模式機器化）"
  } >&2
  exit 1
}

[ -n "$CONFIGURED" ] || fail "core.hooksPath 沒設"

# 相對路徑相對於 repo root 解析；絕對路徑直接比對。
case "$CONFIGURED" in
  /*) RESOLVED="$CONFIGURED" ;;
  *) RESOLVED="$REPO_ROOT/$CONFIGURED" ;;
esac
# 去掉可能的尾斜線再比
RESOLVED="${RESOLVED%/}"

[ "$RESOLVED" = "$EXPECTED_ABS" ] || fail "core.hooksPath = '${CONFIGURED}'（解析成 ${RESOLVED}），應該是 ${EXPECTED_ABS}"
[ -d "$RESOLVED" ] || fail "core.hooksPath 指向的目錄不存在：$RESOLVED"

for hook in pre-commit pre-push; do
  [ -f "$RESOLVED/$hook" ] || fail "缺少 $hook"
  [ -x "$RESOLVED/$hook" ] || fail "$hook 沒有可執行位元（git 會靜默不執行它）：chmod +x $RESOLVED/$hook"
done
[ -f "$RESOLVED/code-pattern.sh" ] || fail "缺少 code-pattern.sh（pre-commit / pre-push 共用的 SSOT）"

# 🔴 真的 source 並斷言兩個變數非空：本檔頭原本就寫「code-pattern.sh 存在且**可被 source**」，
#    但只做 `[ -f ]` 等於沒驗到重點——「變數被改名／打錯字」正是會讓兩支 hook 靜默放行的
#    那個失效模式。
#
# 🔴 Codex R1 P1（這一輪抓到的）：在主 shell 直接 `.` source 有一個更陰險的失效模式
#    ——若 `code-pattern.sh` 因誤貼、被人動過而含 `exit 0`（或 `return`），整支
#    check-hooks.sh 會**立刻退出**、後面的變數存在檢查與冒煙測試全部 skip，
#    但 exit code 仍是 0。命令會宣稱「hooks 活著」，而 SSOT 其實已經死了。
#    （pre-commit / pre-push 也是同一 bug class、需另外收——見批 1 遺留。）
#    修法：在**子 shell** source，以 sentinel 標示「有跑完 source 且變數存在」，
#    父 shell parse。子 shell 提前退出時看不到 sentinel、fail-closed。
#
# shellcheck source=/dev/null
pattern_output=$(
  bash -c "
    set +u
    . '$RESOLVED/code-pattern.sh' 2>/dev/null || exit 91
    printf '__SSOT_SENTINEL_OK__\n%s\n%s\n' \"\$NON_CODE_PATTERN\" \"\$PROTECTED_DOCS\"
  " 2>/dev/null
)
subshell_ec=$?
if [ $subshell_ec -eq 91 ]; then
  fail "code-pattern.sh 無法 source（語法錯誤？）"
fi
# 沒看到 sentinel = 子 shell 沒跑到 printf（可能因為 `exit`/`return` 提早退出）
if ! printf '%s' "$pattern_output" | head -n 1 | grep -q '^__SSOT_SENTINEL_OK__$'; then
  fail "code-pattern.sh 提早退出（sentinel 沒印出——可能被人誤貼了 exit / return 語句）"
fi
NON_CODE_PATTERN=$(printf '%s' "$pattern_output" | sed -n '2p')
PROTECTED_DOCS=$(printf '%s' "$pattern_output" | sed -n '3p')
[ -n "$NON_CODE_PATTERN" ] || fail "code-pattern.sh 沒有定義 NON_CODE_PATTERN（兩支 hook 會靜默放行 code）"
[ -n "$PROTECTED_DOCS" ] || fail "code-pattern.sh 沒有定義 PROTECTED_DOCS（PR-only 文件會被放行）"
# 冒煙測試：拿樣本驗 pattern 的方向沒有反過來
echo "src/x.ts" | grep -qEv "$NON_CODE_PATTERN" || fail "NON_CODE_PATTERN 把 .ts 判成文件（方向反了）"
echo "docs/x.md" | grep -qE "$NON_CODE_PATTERN" || fail "NON_CODE_PATTERN 把 .md 判成 code（方向反了）"
echo "CLAUDE.md" | grep -qE "$PROTECTED_DOCS" || fail "PROTECTED_DOCS 對不到 CLAUDE.md"

echo "✅ git hooks 活著：core.hooksPath → ${CONFIGURED}（pre-commit + pre-push 存在且可執行；SSOT 兩個 pattern 已載入並通過冒煙測試）"
