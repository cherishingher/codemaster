#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/root/codemaster}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
REMOTE_BRANCH="${REMOTE_BRANCH:-main}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-deploy/prod-main}"
WEB_HOST="${WEB_HOST:-127.0.0.1}"
WEB_PORT="${WEB_PORT:-3000}"
PM2_APP="${PM2_APP:-codemaster}"
START_JUDGE_AGENT="${START_JUDGE_AGENT:-false}"
JUDGE_PM2_APP="${JUDGE_PM2_APP:-codemaster-judge-agent}"
CLEAN_INSTALL="${CLEAN_INSTALL:-true}"

log() {
  printf '[deploy] %s\n' "$1"
}

fail() {
  printf '[deploy] ERROR: %s\n' "$1" >&2
  exit 1
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

  fail "docker-compose / docker compose 都不可用"
}

ensure_clean_git() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    git status --short
    fail "工作区不是干净状态，已停止部署"
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

check_security() {
  if [ "$(id -u)" -eq 0 ]; then
    log "⚠ 警告：当前以 root 用户运行，生产环境建议使用专用非 root 用户"
    log "  可使用: useradd -m -s /bin/bash codemaster && chown -R codemaster:codemaster $APP_DIR"
    if [ "${ALLOW_ROOT:-false}" != "true" ]; then
      fail "以 root 运行已被阻止。设置 ALLOW_ROOT=true 以跳过此检查"
    fi
  fi

  if [ -f "$APP_DIR/.env" ]; then
    local env_file="$APP_DIR/.env"
    if grep -qE '^AUTH_CODE_SECRET\s*=\s*"?$' "$env_file" 2>/dev/null; then
      fail "AUTH_CODE_SECRET 不能为空"
    fi
    if grep -qE '^JUDGE_CALLBACK_SECRET\s*=\s*"?$' "$env_file" 2>/dev/null; then
      fail "JUDGE_CALLBACK_SECRET 不能为空"
    fi
    if grep -qE '^DEBUG_AUTH_CODES\s*=\s*"?true' "$env_file" 2>/dev/null; then
      log "⚠ 警告：DEBUG_AUTH_CODES=true 已启用，生产环境请关闭"
    fi
    if grep -qE '^ENABLE_LOCAL_RUNNER\s*=\s*"?true' "$env_file" 2>/dev/null; then
      log "⚠ 警告：ENABLE_LOCAL_RUNNER=true 已启用，存在安全风险"
    fi
  fi
}

main() {
  cd "$APP_DIR"
  detect_compose

  log "安全检查"
  check_security

  log "检查工作区"
  ensure_clean_git

  log "切换到 ${REMOTE_NAME}/${REMOTE_BRANCH}"
  git fetch "$REMOTE_NAME" "$REMOTE_BRANCH"
  git checkout -B "$DEPLOY_BRANCH" "$REMOTE_NAME/$REMOTE_BRANCH"

  log "固定 npm registry"
  npm config set registry https://registry.npmjs.org/ >/dev/null

  log "清理旧 PostCSS 残留"
  rm -f apps/web/postcss.config.js
  rm -rf apps/web/.next

  log "启动基础服务"
  "${COMPOSE_BIN[@]}" up -d db redis
  docker update --restart unless-stopped codemaster_db_1 codemaster_redis_1 >/dev/null 2>&1 || true

  if [ "$CLEAN_INSTALL" = "true" ]; then
    log "清理旧依赖"
    rm -rf node_modules apps/web/node_modules services/judge-agent/node_modules
  fi

  log "安装依赖"
  npm ci --workspace apps/web --workspace services/judge-agent --include-workspace-root

  log "执行 Prisma migration"
  npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
  npx prisma generate --schema packages/db/prisma/schema.prisma

  log "构建 Web"
  npm --prefix apps/web run build

  if [ -f services/judge-agent/package.json ]; then
    log "构建 judge-agent"
    npm --prefix services/judge-agent run build
  fi

  log "重启 PM2"
  restart_web_pm2
  restart_judge_pm2
  pm2 save >/dev/null 2>&1 || true

  log "探活检查"
  sleep 5
  curl -fsSI "http://${WEB_HOST}:${WEB_PORT}/" >/dev/null
  curl -fsSI "http://${WEB_HOST}:${WEB_PORT}/problems" >/dev/null
  curl -fsSI "http://${WEB_HOST}:${WEB_PORT}/admin/problems" >/dev/null

  log "部署完成"
  git log --oneline -n 1
}

main "$@"
