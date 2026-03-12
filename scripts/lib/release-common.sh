#!/usr/bin/env bash
set -Eeuo pipefail

COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$COMMON_DIR/../.." && pwd)}"
SCHEMA_PATH="${SCHEMA_PATH:-$APP_DIR/packages/db/prisma/schema.prisma}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
DEPLOY_REF="${DEPLOY_REF:-origin/codex/phased-release}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-codex/phased-release}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"
WEB_PORT="${WEB_PORT:-3000}"
PM2_APP="${PM2_APP:-codemaster}"
START_JUDGE_AGENT="${START_JUDGE_AGENT:-false}"
JUDGE_PM2_APP="${JUDGE_PM2_APP:-codemaster-judge-agent}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
DEPLOY_ENV="${DEPLOY_ENV:-production}"

log() {
  printf '[release] %s\n' "$*"
}

warn() {
  printf '[release] WARN: %s\n' "$*" >&2
}

fail() {
  printf '[release] ERROR: %s\n' "$*" >&2
  exit 1
}

ensure_app_dir() {
  [ -d "$APP_DIR" ] || fail "APP_DIR 不存在: $APP_DIR"
  cd "$APP_DIR"
}

load_env() {
  [ -f "$APP_DIR/.env" ] || fail "缺少 $APP_DIR/.env"
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a
}

detect_compose() {
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_BIN=(docker-compose)
    return
  fi

  if docker compose version >/dev/null 2>&1; then
    COMPOSE_BIN=(docker compose)
    return
  fi

  fail "docker compose / docker-compose 不可用"
}

db_url_psql() {
  printf '%s\n' "${DATABASE_URL%\?schema=public}"
}

db_name() {
  local stripped="${DATABASE_URL%\?*}"
  printf '%s\n' "${stripped##*/}"
}

ensure_backup_dir() {
  mkdir -p "$BACKUP_DIR"
}

db_query_scalar() {
  local sql="$1"

  if command -v psql >/dev/null 2>&1; then
    PAGER=cat psql "$(db_url_psql)" -Atq -v ON_ERROR_STOP=1 -c "$sql"
    return
  fi

  detect_compose
  printf '%s\n' "$sql" | "${COMPOSE_BIN[@]}" exec -T db sh -lc \
    'PGPASSWORD="${POSTGRES_PASSWORD}" psql -Atq -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-oj}"'
}

db_exec_file() {
  local file_path="$1"

  [ -f "$file_path" ] || fail "SQL 文件不存在: $file_path"

  if command -v psql >/dev/null 2>&1; then
    PAGER=cat psql "$(db_url_psql)" -v ON_ERROR_STOP=1 -f "$file_path"
    return
  fi

  detect_compose
  "${COMPOSE_BIN[@]}" exec -T db sh -lc \
    'PGPASSWORD="${POSTGRES_PASSWORD}" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-oj}" -f -' \
    < "$file_path"
}

ensure_clean_git() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git status --short
    fail "工作区不干净，已停止发布"
  fi
}

stop_pm2_app() {
  if command -v pm2 >/dev/null 2>&1; then
    pm2 stop "$PM2_APP" >/dev/null 2>&1 || true
  fi
}

restart_web_pm2() {
  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    HOST="$WEB_HOST" PORT="$WEB_PORT" NODE_ENV=production pm2 restart "$PM2_APP" --update-env
    return
  fi

  HOST="$WEB_HOST" PORT="$WEB_PORT" NODE_ENV=production \
    pm2 start npm --name "$PM2_APP" --cwd "$APP_DIR" -- --prefix apps/web run start
}

restart_judge_pm2() {
  if [ "$START_JUDGE_AGENT" != "true" ]; then
    return
  fi

  if pm2 describe "$JUDGE_PM2_APP" >/dev/null 2>&1; then
    NODE_ENV=production pm2 restart "$JUDGE_PM2_APP" --update-env
    return
  fi

  NODE_ENV=production \
    pm2 start npm --name "$JUDGE_PM2_APP" --cwd "$APP_DIR" -- --prefix services/judge-agent run start
}
