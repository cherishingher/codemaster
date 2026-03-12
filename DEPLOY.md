# Deploy

## 约定
- 项目目录：`/root/codemaster`
- 部署分支：`codex/phased-release`
- PM2 应用：`codemaster`
- 健康检查：`http://127.0.0.1:3000/api/health`
- 构建参数：`NODE_OPTIONS=--max-old-space-size=4096`

## 新机器初始化
```bash
apt update
apt install -y git curl docker.io docker-compose-plugin postgresql-client-common
npm i -g pm2
git clone -b codex/phased-release https://github.com/cherishingher/codemaster.git /root/codemaster
cd /root/codemaster
cp .env.example .env
```

必须填写：
- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_CODE_SECRET`
- `JUDGE_CALLBACK_SECRET`
- `PAYMENT_CALLBACK_SECRET`

生产环境要求：
```env
DEBUG_AUTH_CODES=false
ENABLE_LOCAL_RUNNER=false
ALLOW_ADMIN_DEV_ROUTES=false
NEXT_PUBLIC_ALLOW_ADMIN_DEV_TOOLS=false
```

## 标准发布
```bash
cd /root/codemaster
bash /root/codemaster/update.sh
```

发布脚本会自动执行：
1. 环境变量检查
2. 数据库备份
3. 启动 `db` / `redis`
4. 更新代码到 `origin/codex/phased-release`
5. 安装依赖（跳过 chromedriver 下载）
6. 执行旧库 repair、Prisma migration、Prisma generate
7. 构建 Web
8. 重启 PM2
9. 健康检查

## 发布后验证
```bash
pm2 status
pm2 logs codemaster --lines 50
curl http://127.0.0.1:3000/api/health
```

期望返回：
```json
{"ok":true}
```

## 临时启用 dev 接口
仅在演示场景手动打开：
```env
ALLOW_ADMIN_DEV_ROUTES=true
NEXT_PUBLIC_ALLOW_ADMIN_DEV_TOOLS=true
```

然后执行：
```bash
pm2 restart codemaster --update-env
```
