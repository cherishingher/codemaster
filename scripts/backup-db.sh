#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/release-common.sh"

ensure_app_dir
load_env
ensure_backup_dir

timestamp="$(date +%Y%m%d-%H%M%S)"
target_path="${1:-$BACKUP_DIR/pre-update-${timestamp}.dump}"
mkdir -p "$(dirname "$target_path")"

if command -v pg_dump >/dev/null 2>&1; then
  pg_dump -Fc -d "$(db_url_psql)" -f "$target_path"
else
  detect_compose
  "${COMPOSE_BIN[@]}" exec -T db sh -lc \
    'PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -Fc --no-owner --no-privileges -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-oj}"' \
    > "$target_path"
fi

log "数据库备份完成: $target_path"
