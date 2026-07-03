#!/usr/bin/env bash
# 去識別化常駐 gate — 掃「來源專案識別詞」殘留
#
# 三段掃描,任何命中 → exit 1(印出命中行):
#   1) working tree(git 追蹤檔)
#   2) git 全史 blob(含已刪檔案的歷史內容)
#   3) git 全史 commit 訊息(含作者列)
#
# denylist:scripts/deny-terms.txt(每行一條 extended regex;# 與空行忽略)。
# 排除:deny-terms.txt 自身(它必然含這些詞)、package-lock.json(雜湊噪音)。
#
# 用法:bash scripts/check-no-source-terms.sh(CI 與本機皆可;需在 repo 內執行)

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

DENY_SRC="scripts/deny-terms.txt"
if [[ ! -f "$DENY_SRC" ]]; then
  echo "❌ 找不到 $DENY_SRC" >&2
  exit 1
fi

# 去掉註解與空行(空 pattern 會 match 所有行,必須濾掉)
PATTERNS="$(mktemp)"
trap 'rm -f "$PATTERNS"' EXIT
grep -vE '^\s*(#|$)' "$DENY_SRC" > "$PATTERNS"

if [[ ! -s "$PATTERNS" ]]; then
  echo "⚠️ denylist 為空,無事可掃(如不需要本 gate,連同 CI step 一併移除)"
  exit 0
fi

# 豁免說明:
# - deny-terms.txt:denylist 本身必然含這些詞
# - package-lock.json:雜湊噪音
# - check-todos-markers.{ts,test.ts}:該工具的本職是解析「PR #N」引用格式,
#   docstring 與測試 fixture 必然含「PR 井號+數字」這類語法範例(編號皆虛構)——
#   屬功能性內容非來源專案殘留。其餘 pattern(專案名等)仍應在此兩檔為 0,
#   若要對它們全量掃,把下兩行豁免暫時移除再跑一次即可。
EXCLUDES=(':!scripts/deny-terms.txt' ':!package-lock.json'
  ':!scripts/check-todos-markers.ts' ':!tests/check-todos-markers.test.ts')
FAIL=0

echo "── [1/3] working tree 掃描 ──"
if git grep -nIiE -f "$PATTERNS" -- . "${EXCLUDES[@]}"; then
  echo "❌ working tree 含來源專案識別詞(上列)" >&2
  FAIL=1
else
  echo "✅ working tree 乾淨"
fi

echo "── [2/3] git 全史 blob 掃描 ──"
HIST_HIT=0
while read -r rev; do
  if git grep -nIiE -f "$PATTERNS" "$rev" -- . "${EXCLUDES[@]}" 2>/dev/null; then
    HIST_HIT=1
  fi
done < <(git rev-list --all)
if [[ "$HIST_HIT" -eq 1 ]]; then
  echo "❌ git 歷史 blob 含來源專案識別詞(上列;需 rebase / filter-repo 清除)" >&2
  FAIL=1
else
  echo "✅ git 歷史 blob 乾淨"
fi

echo "── [3/3] commit 訊息 + 作者掃描 ──"
if git log --all --format='%H %an <%ae> %s %b' | grep -niIE -f "$PATTERNS"; then
  echo "❌ commit 訊息/作者含來源專案識別詞(上列)" >&2
  FAIL=1
else
  echo "✅ commit 訊息乾淨"
fi

if [[ "$FAIL" -eq 1 ]]; then
  exit 1
fi
echo "✅ 去識別化掃描全數通過"
