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
#
# 🔴 Codex R2 P1（R1 fix 引入的新表面）:R1 版用 `\n` 分隔輸出、父端用 sed 拿第 2/3 行
#    ——**若 pattern 本身含換行**(bash 允許 `$'\.md$\n...'`)輸出會變 4 行,父端仍拿
#    第 2/3 → NON_CODE_PATTERN 只讀到 pattern 的第一半、PROTECTED_DOCS 讀到第二半、
#    真正的 PROTECTED_DOCS 漂到第 4 行被丟掉。三個 smoke test 全過、命令 exit 0,
#    但 SSOT 已經死了。修法:每個變數 **base64 encode 成單行 ASCII**,再用固定 `\n`
#    分隔——輸出**永遠 3 行**(sentinel + 2 個 base64 blob),欄位對齊不會被
#    pattern 內容干擾;base64 blob 不含換行也不含 shell meta。
#
#    (⚠️ 曾試過用 NUL 分隔 `awk RS="\0"`——macOS 內建 BSD awk 只讀第一段就停,
#    行為不可攜,棄用。base64 是可攜的 lingua franca。)
#
# 🔴 Codex R3 P1(R2 base64 fix 又引入的新表面):
#    ⑴ GNU coreutils `base64` **預設每 76 字元換行**——健康 PROTECTED_DOCS 的 base64
#       已達 112 字元、在 Ubuntu CI 上會被拆成兩行、父端 sed 拿第 3 行只讀到後半,
#       decode fail、健康路徑也 fail-closed。修法:encode 後 `tr -d '\r\n'` 剝掉
#       換行(BSD 不換行、GNU 換 76,tr 兩邊都安全)。
#    ⑵ `base64 -D` 是 BSD 選項、GNU 用 `-d`——**兩邊都認 `-d`**(BSD 支援 `-d` 或
#       `--decode`),統一改 `-d`。
# 🔴 Fresh review P2(這一輪抓到):$RESOLVED 內插進雙引號 heredoc 時,
#    含 `'` 或 shell metachar 的 repo 路徑會破單引號配對 → 語法錯誤或 command
#    injection(malicious 路徑 `/tmp/x';echo pwn;#` 這種)。改用 positional
#    parameter 把路徑當**資料**傳進 subshell(用單引號固定 script body、
#    透過 `-- "$RESOLVED"` 把路徑放進 $1),shell 不會對 `$1` 值內容做解析。
pattern_output=$(
  bash -c '
    set +u
    . "$1/code-pattern.sh" 2>/dev/null || exit 91
    printf "__SSOT_SENTINEL_OK__\n%s\n%s\n%s\n" "$(printf "%s" "$NON_CODE_PATTERN" | base64 | tr -d "\r\n")" "$(printf "%s" "$PROTECTED_DOCS" | base64 | tr -d "\r\n")" "$(printf "%s" "$TOOL_ARTIFACT_PATTERN" | base64 | tr -d "\r\n")"
  ' -- "$RESOLVED" 2>/dev/null
)
subshell_ec=$?
if [ $subshell_ec -eq 91 ]; then
  fail "code-pattern.sh 無法 source（語法錯誤？）"
fi

# 逐行讀:第 1 行 sentinel、第 2/3 行 base64 encoded 變數
pattern_sentinel=$(printf '%s\n' "$pattern_output" | sed -n '1p')
pattern_var1_b64=$(printf '%s\n' "$pattern_output" | sed -n '2p')
pattern_var2_b64=$(printf '%s\n' "$pattern_output" | sed -n '3p')
pattern_var3_b64=$(printf '%s\n' "$pattern_output" | sed -n '4p')

if [ "$pattern_sentinel" != "__SSOT_SENTINEL_OK__" ]; then
  fail "code-pattern.sh 提早退出（sentinel 沒印出——可能被人誤貼了 exit / return 語句）"
fi
# base64 -d 還原;空 blob 或無效 base64 → 變數空 → 下一個 [ -n ] fail-closed
NON_CODE_PATTERN=$(printf '%s' "$pattern_var1_b64" | base64 -d 2>/dev/null)
PROTECTED_DOCS=$(printf '%s' "$pattern_var2_b64" | base64 -d 2>/dev/null)
[ -n "$NON_CODE_PATTERN" ] || fail "code-pattern.sh 沒有定義 NON_CODE_PATTERN（兩支 hook 會靜默放行 code）"
[ -n "$PROTECTED_DOCS" ] || fail "code-pattern.sh 沒有定義 PROTECTED_DOCS（PR-only 文件會被放行）"

# 🔴 額外 defense:計算「所有非空行」的數量,若超過 3 行 → 有人在 code-pattern.sh
#    偷加了 echo/printf 副作用（會弄亂父端 sed 位置解讀）→ fail-closed。
#    (變數為空的情境已在上面 [ -n ] 擋掉,不會走到這裡。)
pattern_nonempty_lines=$(printf '%s\n' "$pattern_output" | grep -c '.' || true)
if [ "$pattern_nonempty_lines" -gt 4 ]; then
  fail "code-pattern.sh 輸出行數異常（$pattern_nonempty_lines 行非空——source 時是否偷做了 echo/printf？）"
fi
# 冒煙測試：拿樣本驗 pattern 的方向沒有反過來
echo "src/x.ts" | grep -qEv "$NON_CODE_PATTERN" || fail "NON_CODE_PATTERN 把 .ts 判成文件（方向反了）"
echo "docs/x.md" | grep -qE "$NON_CODE_PATTERN" || fail "NON_CODE_PATTERN 把 .md 判成 code（方向反了）"
echo "CLAUDE.md" | grep -qE "$PROTECTED_DOCS" || fail "PROTECTED_DOCS 對不到 CLAUDE.md"
# 第三個 SSOT:本機工具產物(pre-commit 任何分支都擋)。放在既有冒煙測試之後,錯訊順序不變。
TOOL_ARTIFACT_PATTERN=$(printf '%s' "$pattern_var3_b64" | base64 -d 2>/dev/null)
[ -n "$TOOL_ARTIFACT_PATTERN" ] || fail "code-pattern.sh 沒有定義 TOOL_ARTIFACT_PATTERN（\`git add -A\` 誤加工具產物的守門會靜默失效）"
echo ".codegraph/index.db" | grep -qE "$TOOL_ARTIFACT_PATTERN" || fail "TOOL_ARTIFACT_PATTERN 對不到 .codegraph/（方向反了）"
echo "src/x.ts" | grep -qEv "$TOOL_ARTIFACT_PATTERN" || fail "TOOL_ARTIFACT_PATTERN 把 src/x.ts 判成工具產物（方向反了）"

echo "✅ git hooks 活著：core.hooksPath → ${CONFIGURED}（pre-commit + pre-push 存在且可執行；SSOT 三個 pattern 已載入並通過冒煙測試）"
