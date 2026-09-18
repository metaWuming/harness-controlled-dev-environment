#!/usr/bin/env bash
#
# scripts/pre-push-ci-mirror.sh — pre-push 對齊 CI 檢查機器化
#
# **問題**:過去每次 push 都要等 CI ~15 min 才知道 checker 紅、修完再等一輪。
# 一個 sprint 可能撞 2-3 次 CI-only 失敗,累積 30-45 min 純浪費。
# SOP Step 6 明講「push 前跑完整本地 gate」但只靠人記,常漏。
#
# **修法**:本 script 集中跑 CI workflow 內能在本機跑的 checkers,pre-push
# hook 呼叫,fail-closed。撞到就 CI-mirror 先擋,不讓錯的 commit 離機。
#
# **對應 CI workflow 的 checks**(見 .github/workflows/ci.yml):
#   ✅ Typecheck                   `npx tsc --noEmit`
#   ✅ Lint                        `npx eslint .`
#   ✅ Doc Refs Check              `npx tsx scripts/check-doc-refs.ts`
#   ✅ Doc Size Check              `npx tsx scripts/check-doc-size.ts`
#   ✅ Adoption Readiness          `npm run check:adoption`
#   ✅ Control Catalog             `npm run check:catalog`
#   ✅ Mutation Spec Drift         `npm run check:mutation-specs`
#   ✅ TODOS Markers               `npx tsx scripts/check-todos-markers.ts`
#   ✅ Step 4 Codex Review         `npm run check:progress-codex -- --base origin/<default>`
#   ✅ Source-term scan            `npm run check:no-source-terms`
#   ✅ Test (vitest)               `npx vitest run`
#
# **本 script 不跑**(理由):
#   - Secret scan (gitleaks)     → pre-push hook 檔頭已有(掃這次離機的 range)
#   - Dependency audit           → 需網路 + 慢;CI 專有
#   - Mutation Kill Smoke        → ~10 min,pre-push 過慢;sprint 收尾人工跑
#   - Baseline Governance        → PR event only(base ref 只在 GitHub 有意義)
#   - Protected Branches Drift   → PR event only
#
# **哲學:opt-in,對稱 codex env gate**——
# 對稱 pre-push hook「Codex env 守門」段(ENABLE_CODEX_ENV_CHECK=1)的姿態:
# 本 gate 預設 disabled;需要 `ENABLE_PRE_PUSH_CI_MIRROR=1` 明確 opt-in 才跑。
# 理由:harness template 明文承諾「外部工具全 optional」(docs/OVERVIEW.md);
# 不用完整 CI mirror 的 downstream(可能只用部分 checkers,或有自己的本機 gate)
# 跑 setup-hooks 後 push 不該被此 gate 擋。
# 想啟用的 adopter:`~/.zshrc` 加 `export ENABLE_PRE_PUSH_CI_MIRROR=1`。
#
# **環境變數**:
#   - `ENABLE_PRE_PUSH_CI_MIRROR=1` 明確 opt-in(未設 → 立即 exit 0)
#   - `PRE_PUSH_SKIP_VITEST=1`     opt-in 後急用跳 vitest(fast checks 仍跑)
#   - `PRE_PUSH_BASE_REF=<ref>`    覆蓋 default base(progress-codex 用),
#                                  預設抓 origin/HEAD 對應的 default branch
#
# **緊急逃生**:`git push --no-verify`(整個 hook 都跳)
#
# **退出碼**:
#   0 = 全部 checks 過(或未 opt-in)
#   1 = 至少一個 check 紅(即使還有其他 check,遇紅即停,不並行、不聚合)
#
# **設計選擇**:遇紅即停(fail-fast),不聚合所有 checker 結果——省 wall-clock、
# 也對稱 CI 本身 step 序列(CI 也遇紅就停下一 step)。

set -u

if [ "${ENABLE_PRE_PUSH_CI_MIRROR:-0}" != "1" ]; then
  # 未 opt-in:立即 exit 0(對稱 harness template 「外部工具全 optional」承諾)
  exit 0
fi

# 決定 base ref(progress-codex 用)
# 順序(F2 修):env override > origin/HEAD symbolic > harness.config deliveryBranches[0] > fail
BASE_REF="${PRE_PUSH_BASE_REF:-}"
if [ -z "$BASE_REF" ]; then
  # 先嘗試 origin/HEAD symbolic-ref(default branch,動態抓)
  if head_ref=$(git symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null); then
    BASE_REF="${head_ref#refs/remotes/}"
  # F2 修(review round 1):fallback 讀 harness.config.json deliveryBranches[0],
  # 對 GitFlow(develop 為 delivery)不誤選 origin/main。
  elif [ -f "scripts/harness.config.json" ] && command -v node >/dev/null 2>&1; then
    delivery=$(node -e '
      try {
        const cfg = JSON.parse(require("fs").readFileSync("scripts/harness.config.json", "utf8"));
        if (Array.isArray(cfg.deliveryBranches) && cfg.deliveryBranches.length > 0) {
          process.stdout.write(cfg.deliveryBranches[0]);
        }
      } catch { /* fail-closed:讓下方 -z 分支 fail */ }
    ' 2>/dev/null)
    if [ -n "$delivery" ]; then
      BASE_REF="origin/$delivery"
    fi
  fi
  # F2 修:仍拿不到 → fail-closed,不再靜默用 origin/main
  if [ -z "$BASE_REF" ]; then
    echo "" >&2
    echo "✗ pre-push CI mirror: 無法判定 base ref。" >&2
    echo "   → 修法:git remote set-head origin -a(建 origin/HEAD symbolic)" >&2
    echo "   → 或設 PRE_PUSH_BASE_REF=<ref>(例:PRE_PUSH_BASE_REF=origin/develop)" >&2
    echo "   → 或補 scripts/harness.config.json deliveryBranches 欄位" >&2
    exit 1
  fi
fi

# F3 修(review round 1):驗 BASE_REF 存在。避免 git rev-list 靜默 fallback 到 0
# → skip PR-time gate 使用者誤以為跑了。fail-closed 附訊息教修法。
if ! git rev-parse --verify --quiet "$BASE_REF" >/dev/null; then
  echo "" >&2
  echo "✗ pre-push CI mirror: BASE_REF=$BASE_REF 不存在(未 fetch?)。" >&2
  echo "   → 修法:git fetch origin --prune;再重試 push" >&2
  echo "   → 或設 PRE_PUSH_BASE_REF 覆蓋成本機已有的 ref" >&2
  exit 1
fi

# 通用 runner:名字 + command → 失敗立即 exit 1
run_check() {
  local name="$1"
  shift
  echo "─── $name ─────────────────────────────────────" >&2
  if "$@" >&2; then
    echo "  ✅ $name" >&2
  else
    local ec=$?
    echo "" >&2
    echo "✗ pre-push CI mirror 撞紅: $name(exit $ec)" >&2
    echo "  → 修完再 push,或 unset ENABLE_PRE_PUSH_CI_MIRROR / git push --no-verify" >&2
    exit 1
  fi
}

# ── Fast checks(<10s each)─────────────────────────────────────
run_check "typecheck"          npx tsc --noEmit
run_check "lint"               npx eslint .
run_check "doc-refs"           npx tsx scripts/check-doc-refs.ts
run_check "doc-size"           npx tsx scripts/check-doc-size.ts
run_check "adoption-readiness" npm run --silent check:adoption
run_check "control-catalog"    npm run --silent check:catalog
run_check "mutation-specs"     npm run --silent check:mutation-specs
run_check "todos-markers"      npx tsx scripts/check-todos-markers.ts

# progress-codex 是 PR-time gate(CI 也只在 pull_request event 跑):
# 需要 base..HEAD 至少一個 commit;branch 剛建、base===HEAD 時 checker fail-closed 誤紅。
# 對稱 CI 的 `if: github.event_name == 'pull_request'`:若 base..HEAD 為空、直接 skip。
new_commits_count=$(git rev-list --count "$BASE_REF..HEAD" 2>/dev/null || echo 0)
if [ "$new_commits_count" = "0" ]; then
  echo "─── progress-codex ─────────────────────────────────────" >&2
  echo "  ℹ️  base($BASE_REF)..HEAD 無 commit,skip(對稱 CI PR-event-only)" >&2
else
  run_check "progress-codex"     npm run --silent check:progress-codex -- --base "$BASE_REF"
fi

run_check "no-source-terms"    npm run --silent check:no-source-terms

# ── Slow check:vitest(~3 min)──────────────────────────────────
if [ "${PRE_PUSH_SKIP_VITEST:-0}" = "1" ]; then
  echo "ℹ️  vitest 已依 PRE_PUSH_SKIP_VITEST=1 略過(fast checks 全過)" >&2
else
  run_check "vitest"           npx vitest run
fi

echo "" >&2
echo "✅ pre-push CI mirror 全部通過(base=$BASE_REF)" >&2
exit 0
