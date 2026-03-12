#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
# shellcheck disable=SC1091
source "$APP_DIR/scripts/lib/release-common.sh"

BUILD_NODE_OPTIONS="${BUILD_NODE_OPTIONS:---max-old-space-size=4096}"

ensure_app_dir
load_env

ensure_clean_git
detect_compose

log "启动基础服务"
"${COMPOSE_BIN[@]}" up -d db redis

log "更新代码到 $DEPLOY_REF"
git fetch "$REMOTE_NAME" --prune
git checkout -B "$DEPLOY_BRANCH" "$DEPLOY_REF"

bash "$APP_DIR/scripts/check-prod-env.sh"

log "备份数据库"
bash "$APP_DIR/scripts/backup-db.sh"

log "安装依赖"
CHROMEDRIVER_SKIP_DOWNLOAD=true npm ci --ignore-scripts

log "执行 repair / migrate / generate"
bash "$APP_DIR/scripts/migrate-db.sh"

log "清理旧构建产物"
rm -rf "$APP_DIR/apps/web/.next"

log "构建 Web"
NODE_OPTIONS="$BUILD_NODE_OPTIONS" npm --prefix apps/web run build

if [ -f "$APP_DIR/services/judge-agent/package.json" ]; then
  log "构建 judge-agent"
  npm --prefix services/judge-agent run build
fi

log "重启 PM2"
restart_web_pm2
restart_judge_pm2
pm2 save >/dev/null 2>&1 || true

log "探活检查"
sleep 5
curl -fsS "http://${WEB_HOST}:${WEB_PORT}/api/health"

log "发布完成"
git log --oneline -n 1
