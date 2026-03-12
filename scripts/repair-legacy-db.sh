#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/release-common.sh"

ensure_app_dir
load_env

db_exec_file "$APP_DIR/scripts/sql/repair-legacy-db.sql"
log "旧库 repair SQL 已执行"
