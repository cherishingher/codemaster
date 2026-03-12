#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/release-common.sh"

ensure_app_dir
load_env

legacy_repair_required="$(db_query_scalar "SELECT CASE
  WHEN to_regclass('public.\"Order\"') IS NULL THEN 0
  WHEN to_regclass('public.\"MembershipSubscription\"') IS NULL THEN 1
  WHEN to_regclass('public.\"RefundRequest\"') IS NULL THEN 1
  WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'updatedAt') THEN 1
  WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Order' AND column_name = 'orderNo') THEN 1
  WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'createdAt') THEN 1
  WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'updatedAt') THEN 1
  WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'paymentNo') THEN 1
  ELSE 0
END;")"

if [ "$legacy_repair_required" = "1" ]; then
  log "检测到旧库结构，先执行 repair"
  bash "$APP_DIR/scripts/repair-legacy-db.sh"

  npx prisma migrate resolve --rolled-back 20260310203509_camp_system_phase2 --schema "$SCHEMA_PATH" || true
  npx prisma migrate resolve --applied 20260311103000_mock_order_checkout --schema "$SCHEMA_PATH" || true
  npx prisma migrate resolve --applied 20260311160000_transaction_closure_upgrade --schema "$SCHEMA_PATH" || true
  npx prisma migrate resolve --applied 20260311190000_membership_vip_subscription --schema "$SCHEMA_PATH" || true
fi

npx prisma migrate deploy --schema "$SCHEMA_PATH"
npx prisma generate --schema "$SCHEMA_PATH"
log "数据库 migration 与 Prisma Client 已更新"
