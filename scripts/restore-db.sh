#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/release-common.sh"

dump_path="${1:-}"
[ -n "$dump_path" ] || fail "用法: bash scripts/restore-db.sh <dump-file>"
[ -f "$dump_path" ] || fail "备份文件不存在: $dump_path"

ensure_app_dir
load_env
detect_compose
stop_pm2_app

database_name="$(db_name)"

if command -v psql >/dev/null 2>&1 && command -v pg_restore >/dev/null 2>&1; then
  admin_url="$(db_url_psql)"
  admin_url="${admin_url%/*}/postgres"

  PAGER=cat psql "$admin_url" -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${database_name}'
  AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS "${database_name}";
CREATE DATABASE "${database_name}";
SQL

  pg_restore --no-owner --no-privileges --clean --if-exists -d "$(db_url_psql)" "$dump_path"
else
  printf '%s\n' "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database_name}' AND pid <> pg_backend_pid();" \
    "DROP DATABASE IF EXISTS \"${database_name}\";" \
    "CREATE DATABASE \"${database_name}\";" \
    | "${COMPOSE_BIN[@]}" exec -T db sh -lc \
      'PGPASSWORD="${POSTGRES_PASSWORD}" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d postgres'

  "${COMPOSE_BIN[@]}" exec -T db sh -lc \
    'PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore --no-owner --no-privileges --clean --if-exists -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-oj}"' \
    < "$dump_path"
fi

log "数据库恢复完成: $dump_path"
