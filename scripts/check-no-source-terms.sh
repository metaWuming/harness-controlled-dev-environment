#!/usr/bin/env bash
# 去識別化常駐 gate — 掃「來源專案識別詞」殘留
#
# 三段掃描,任何命中或掃描器自身錯誤 → exit 1(印出原因):
#   1) working tree(git 追蹤檔)
#   2) git 全史 blob(含已刪檔案的歷史內容)
#   3) git 全史 commit 訊息(含作者列)
#
# denylist:scripts/deny-terms.txt(每行一條 extended regex;# 與空行忽略)。
#
# 豁免設計(Codex review 修正:不做全檔豁免,改縮減 pattern 集):
#   - deny-terms.txt 自身、package-lock.json:完全排除(前者必然含詞、後者雜湊噪音)
#   - check-todos-markers.{ts,test.ts}:該工具本職是解析「PR 井號+數字」引用格式,
#     docstring/fixture 必然含該語法(編號皆虛構)→ 這兩檔改用「去掉 PR/pull 語法條目
#     的縮減 pattern 集」掃描 —— 其餘識別詞(專案名等)在這兩檔仍會被抓,無盲區。
#
# 錯誤處理(Codex review 修正):grep 的 exit code 顯式分流 —— 0=命中(FAIL)、
# 1=乾淨、其他=掃描器錯誤(壞 regex 等,FAIL 而非靜默當乾淨)。
#
# 用法:bash scripts/check-no-source-terms.sh(CI 與本機皆可;需在 repo 內執行)

set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

DENY_SRC="scripts/deny-terms.txt"
if [[ ! -f "$DENY_SRC" ]]; then
  echo "❌ 找不到 $DENY_SRC" >&2
  exit 1
fi

# 去掉註解與空行(空 pattern 會 match 所有行,必須濾掉);
# grep 無選中行時 exit 1 → || true 讓「denylist 全註解/全空」走下方的合法空清單路徑
PATTERNS="$(mktemp)"
PATTERNS_NO_PR_SYNTAX="$(mktemp)"
trap 'rm -f "$PATTERNS" "$PATTERNS_NO_PR_SYNTAX"' EXIT
grep -vE '^[[:space:]]*(#|$)' "$DENY_SRC" > "$PATTERNS" || true

if [[ ! -s "$PATTERNS" ]]; then
  echo "⚠️ denylist 為空,無事可掃(如不需要本 gate,連同 CI step 一併移除)"
  exit 0
fi

# 縮減 pattern 集:去掉「PR 井號+數字」「pull/數字」語法條目,給兩個 PR 解析工具檔用
grep -viE 'PR #|pull/' "$PATTERNS" > "$PATTERNS_NO_PR_SYNTAX" || true

FULL_EXCLUDES=(':!scripts/deny-terms.txt' ':!package-lock.json'
  ':!scripts/check-todos-markers.ts' ':!tests/check-todos-markers.test.ts')
SYNTAX_EXEMPT_FILES=('scripts/check-todos-markers.ts' 'tests/check-todos-markers.test.ts')

FAIL=0

# git grep 包裝:0=命中(印出,FAIL)、1=乾淨、其他=錯誤(FAIL)。回傳值:0 乾淨、1 有問題
scan_grep() {
  local label="$1"
  shift
  local rc=0
  git grep "$@" || rc=$?
  case "$rc" in
    0)
      echo "❌ ${label}:含來源專案識別詞(上列)" >&2
      return 1
      ;;
    1) return 0 ;;
    *)
      echo "❌ ${label}:掃描器錯誤(git grep exit ${rc},檢查 deny-terms.txt regex)" >&2
      return 1
      ;;
  esac
}

echo "── [1/3] working tree 掃描 ──"
scan_grep 'working tree(全 pattern)' -nIiE -f "$PATTERNS" -- . "${FULL_EXCLUDES[@]}" || FAIL=1
if [[ -s "$PATTERNS_NO_PR_SYNTAX" ]]; then
  scan_grep 'working tree(PR 解析工具檔,縮減 pattern)' -nIiE -f "$PATTERNS_NO_PR_SYNTAX" -- "${SYNTAX_EXEMPT_FILES[@]}" || FAIL=1
fi
[[ "$FAIL" -eq 0 ]] && echo "✅ working tree 乾淨"

echo "── [2/3] git 全史 blob 掃描 ──"
HIST_FAIL=0
while read -r rev; do
  scan_grep "史 ${rev:0:8}(全 pattern)" -nIiE -f "$PATTERNS" "$rev" -- . "${FULL_EXCLUDES[@]}" || HIST_FAIL=1
  if [[ -s "$PATTERNS_NO_PR_SYNTAX" ]]; then
    # 只掃「該 rev 確實存在」的工具檔(早期 commit 尚無這兩檔,直接餵 pathspec 會被
    # git grep 當錯誤;先 cat-file -e 過濾)
    EXISTING=()
    for f in "${SYNTAX_EXEMPT_FILES[@]}"; do
      git cat-file -e "$rev:$f" 2>/dev/null && EXISTING+=("$f")
    done
    if [[ ${#EXISTING[@]} -gt 0 ]]; then
      scan_grep "史 ${rev:0:8}(工具檔縮減 pattern)" -nIiE -f "$PATTERNS_NO_PR_SYNTAX" "$rev" -- "${EXISTING[@]}" || HIST_FAIL=1
    fi
  fi
done < <(git rev-list --all)
if [[ "$HIST_FAIL" -eq 1 ]]; then
  echo "❌ git 歷史 blob 含來源專案識別詞或掃描錯誤(需 rebase / filter-repo 清除)" >&2
  FAIL=1
else
  echo "✅ git 歷史 blob 乾淨"
fi

echo "── [3/3] commit 訊息 + 作者掃描 ──"
MSG_RC=0
git log --all --format='%H %an <%ae> %s %b' | grep -niIE -f "$PATTERNS" || MSG_RC=$?
case "$MSG_RC" in
  0)
    echo "❌ commit 訊息/作者含來源專案識別詞(上列)" >&2
    FAIL=1
    ;;
  1) echo "✅ commit 訊息乾淨" ;;
  *)
    echo "❌ commit 訊息掃描器錯誤(grep exit ${MSG_RC})" >&2
    FAIL=1
    ;;
esac

if [[ "$FAIL" -eq 1 ]]; then
  exit 1
fi
echo "✅ 去識別化掃描全數通過"
