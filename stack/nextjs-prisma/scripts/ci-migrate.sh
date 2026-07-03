#!/usr/bin/env bash
# CI-only migration orchestration(模板)
#
# 適用情境:你的 migration 史中有一支「資料 migration」(例如
# `UPDATE ... SET tenantId = <某租戶 id>`)依賴某筆 seed 資料先存在。
# 本地開發時 seed 是在兩支 migration 之間手動跑的;CI 每次從空 DB 重建,
# 需要重現同樣的編排:
#
#   1. migrate deploy(只跑到 gate migration 之前,建好基礎表)
#   2. 跑 seed 腳本(塞入資料 migration 依賴的那筆資料)
#   3. migrate deploy(跑剩下的,含依賴 seed 資料的資料 migration)
#
# 實作:臨時把 gate migration 以及之後的所有 migration 搬到暫存目錄,跑第一輪
# migrate deploy,seed,搬回來,跑第二輪。結束狀態跟本地一致。
#
# idempotent:所有搬移都用暫存目錄,seed 自己 upsert,
# migrate deploy 跑過的 migration 不會重跑。
#
# 【使用前必改】
#   - CI_GATE_MIGRATION:改成你的 gate migration 目錄名(或用 env 傳入)
#   - Phase 2 的 seed 指令:換成你專案的 seed 腳本
#
# 若你的 migration 史沒有這種「資料 migration 依賴 seed」的情況,
# CI 直接跑 `npx prisma migrate deploy` 即可,不需要本腳本。

set -euo pipefail

# gate migration 目錄名(第一支依賴 seed 資料的 migration)— 使用前必改
GATE_MIG="${CI_GATE_MIGRATION:?請設 CI_GATE_MIGRATION 環境變數,或直接在本腳本硬編 gate migration 目錄名}"
MIG_DIR="prisma/migrations"
STASH_DIR="${CI_MIG_STASH:-/tmp/gate-migrations}"

echo "=== CI migrate orchestration ==="
echo "Gate migration: $GATE_MIG"
echo "Stash dir: $STASH_DIR"

# Step 1:把 gate migration 以及之後的所有 migration 搬去 stash
mkdir -p "$STASH_DIR"
moved_count=0
for dir in "$MIG_DIR"/*/; do
  name=$(basename "$dir")
  # 字串比較:>= GATE_MIG 的都搬走
  if [[ "$name" > "$GATE_MIG" || "$name" == "$GATE_MIG" ]]; then
    mv "$dir" "$STASH_DIR/"
    moved_count=$((moved_count + 1))
  fi
done
echo "Moved $moved_count migrations to stash"

# Step 2:第一輪 migrate deploy(跑到 gate 之前為止)
echo ""
echo "=== Phase 1: migrate deploy up to gate ==="
npx prisma migrate deploy

# Step 3:seed 資料 migration 依賴的資料
echo ""
echo "=== Phase 2: seed prerequisite data ==="
# 【使用前必改】換成你專案的 seed 腳本,例如:
#   npx tsx scripts/seed-base-tenant.ts
echo "TODO: 在此呼叫你的 seed 腳本(見上方註解)" && exit 1

# Step 4:搬回 stash 的 migrations
echo ""
echo "=== Phase 3: restore stashed migrations ==="
for dir in "$STASH_DIR"/*/; do
  [ -d "$dir" ] || continue
  mv "$dir" "$MIG_DIR/"
done
echo "Restored migrations"

# Step 5:第二輪 migrate deploy(跑剩下的,資料 migration 會用到剛 seed 的資料)
echo ""
echo "=== Phase 4: migrate deploy remaining ==="
npx prisma migrate deploy

echo ""
echo "=== CI migrate done ==="
