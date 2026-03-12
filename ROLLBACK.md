# Rollback

## 仅回滚代码
```bash
cd /root/codemaster
git log --oneline -n 10
git checkout <commit>
set -a
source /root/codemaster/.env
set +a
rm -rf apps/web/.next
NODE_OPTIONS="--max-old-space-size=4096" npm --prefix apps/web run build
pm2 restart codemaster --update-env
pm2 save
curl http://127.0.0.1:3000/api/health
```

适用场景：
- migration 未执行
- 数据结构未变化
- 仅页面或服务逻辑回退

## 回滚数据库
1. 停服务
```bash
pm2 stop codemaster
```
2. 查看备份
```bash
ls -lh /root/codemaster/backups
```
3. 恢复
```bash
cd /root/codemaster
bash scripts/restore-db.sh /root/codemaster/backups/<backup>.dump
```
4. 重新生成并启动
```bash
set -a
source /root/codemaster/.env
set +a
npx prisma generate --schema packages/db/prisma/schema.prisma
pm2 restart codemaster --update-env
pm2 save
curl http://127.0.0.1:3000/api/health
```

适用场景：
- migration 已执行
- repair 脚本已修改数据库结构
- 需要回退到旧数据状态
