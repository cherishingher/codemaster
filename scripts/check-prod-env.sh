#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/release-common.sh"

ensure_app_dir
load_env

required_vars=(
  DATABASE_URL
  REDIS_URL
  AUTH_CODE_SECRET
  JUDGE_CALLBACK_SECRET
  PAYMENT_CALLBACK_SECRET
)

for var_name in "${required_vars[@]}"; do
  value="${!var_name:-}"
  [ -n "$value" ] || fail "缺少环境变量: $var_name"
done

if [ "$DEPLOY_ENV" = "production" ]; then
  for unsafe in "change-me" "dev" "dev-auth-code-secret" "dev-judge-secret" "dev-payment-secret"; do
    [ "${AUTH_CODE_SECRET:-}" != "$unsafe" ] || fail "AUTH_CODE_SECRET 仍是危险默认值"
    [ "${JUDGE_CALLBACK_SECRET:-}" != "$unsafe" ] || fail "JUDGE_CALLBACK_SECRET 仍是危险默认值"
    [ "${PAYMENT_CALLBACK_SECRET:-}" != "$unsafe" ] || fail "PAYMENT_CALLBACK_SECRET 仍是危险默认值"
  done

  [ "${DEBUG_AUTH_CODES:-false}" != "true" ] || fail "生产环境禁止 DEBUG_AUTH_CODES=true"
  [ "${ENABLE_LOCAL_RUNNER:-false}" != "true" ] || fail "生产环境禁止 ENABLE_LOCAL_RUNNER=true"
fi

if [ "${ALLOW_ADMIN_DEV_ROUTES:-false}" = "true" ]; then
  warn "ALLOW_ADMIN_DEV_ROUTES=true，生产环境仅建议临时开启"
fi

if [ "${NEXT_PUBLIC_ALLOW_ADMIN_DEV_TOOLS:-false}" = "true" ]; then
  warn "NEXT_PUBLIC_ALLOW_ADMIN_DEV_TOOLS=true，生产环境仅建议临时开启"
fi

log "环境变量检查通过"
