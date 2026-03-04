# 生产部署与恢复手册

适用环境：
- 项目目录：`/root/codemaster`
- Web 进程：PM2 `codemaster`
- Web 端口：`127.0.0.1:3000`
- 基础服务：`docker-compose` 启动 `Postgres/Redis`

## 一键部署
脚本位置：
- `/root/codemaster/scripts/deploy-prod.sh`

首次使用：
```bash
cd /root/codemaster
chmod +x scripts/deploy-prod.sh
```

执行部署：
```bash
cd /root/codemaster
APP_DIR=/root/codemaster \
WEB_HOST=127.0.0.1 \
WEB_PORT=3000 \
PM2_APP=codemaster \
./scripts/deploy-prod.sh
```

如果同时需要启动 `judge-agent`：
```bash
cd /root/codemaster
START_JUDGE_AGENT=true \
JUDGE_PM2_APP=codemaster-judge-agent \
./scripts/deploy-prod.sh
```

## 部署流程说明
脚本会按顺序执行：
1. 校验 Git 工作区是干净的
2. 拉取 `origin/main`
3. 切到部署分支 `deploy/prod-main`
4. 固定 `npm` 源为 `https://registry.npmjs.org/`
5. 删除旧版 `apps/web/postcss.config.js`
6. 启动 `db/redis`
7. 安装依赖
8. 执行 Prisma migration / generate
9. 构建 `apps/web`
10. 重启 PM2
11. 做 `/`、`/problems`、`/admin/problems` 探活

## 常见故障

### 1. `Can't reach database server at localhost:5432`
原因：
- `Postgres` 容器没启动

检查：
```bash
cd /root/codemaster
docker-compose ps
ss -ltnp | grep 5432 || true
```

恢复：
```bash
cd /root/codemaster
docker-compose up -d db redis
docker-compose ps
```

### 2. `Cannot find module 'autoprefixer'`
原因：
- 服务器残留了旧文件 `apps/web/postcss.config.js`
- 当前主分支只应该保留 `apps/web/postcss.config.mjs`

检查：
```bash
cd /root/codemaster
find apps/web -maxdepth 2 -name 'postcss.config.*' -print
```

恢复：
```bash
cd /root/codemaster
rm -f apps/web/postcss.config.js
rm -rf apps/web/.next
```

### 3. `npm ERR! EINTEGRITY` 且日志指向 `npmmirror`
原因：
- 机器使用了镜像源缓存，tarball 校验不一致

恢复：
```bash
cd /root/codemaster
npm config set registry https://registry.npmjs.org/
npm cache clean --force
rm -rf /root/.npm/_cacache
rm -rf node_modules apps/web/node_modules services/judge-agent/node_modules
npm ci --workspace apps/web --workspace services/judge-agent --include-workspace-root
```

### 4. `docker compose` 不可用
原因：
- 服务器是老版 Docker Compose

检查：
```bash
which docker-compose || true
docker-compose version || true
```

恢复：
- 使用 `docker-compose`，不要用 `docker compose`

### 5. 服务器跑在旧 hotfix 分支
原因：
- 生产目录没有切到最新 `origin/main`

恢复：
```bash
cd /root/codemaster
git fetch origin main
git checkout -B deploy/prod-main origin/main
```

## 手工恢复顺序
如果你不想跑脚本，按这个顺序：

```bash
cd /root/codemaster
git fetch origin main
git checkout -B deploy/prod-main origin/main
npm config set registry https://registry.npmjs.org/
rm -f apps/web/postcss.config.js
rm -rf apps/web/.next
docker-compose up -d db redis
npm ci --workspace apps/web --workspace services/judge-agent --include-workspace-root
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npx prisma generate --schema packages/db/prisma/schema.prisma
npm --prefix apps/web run build
HOST=127.0.0.1 PORT=3000 NODE_ENV=production pm2 restart codemaster --update-env
```

探活：
```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/problems
curl -I http://127.0.0.1:3000/admin/problems
```

## 持久化建议
```bash
docker update --restart unless-stopped codemaster_db_1 codemaster_redis_1
pm2 save
```
