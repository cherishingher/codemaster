# Judge Dispatch 部署文档

## 概述

`judge-dispatch` 是 `judge-agent` 的**替代品**，用于将判题任务分发到本地 285K 机器执行。

**核心区别：**
- `judge-agent`：在云服务器上编译运行代码（受限于云服务器性能）
- `judge-dispatch`：将任务通过 WebSocket 转发到本地高性能机器判题

**对 Next.js 应用零侵入**：读同一个 Redis Stream，调同一个 callback 接口。

## 架构

```
用户提交 → Next.js API → Redis Stream (judge:jobs)
                              ↓
                    judge-dispatch (本服务)
                              ↓ WebSocket
                    本地 285K judge-worker
                              ↓ 判题完成
                    judge-dispatch
                              ↓ HTTP POST
                    /api/judge/callback → 写入数据库
```

## 部署步骤

### 1. 安装依赖

```bash
cd services/judge-dispatch
pip3 install -r requirements.txt
```

### 2. 配置环境变量

复用已有的 `.env` 变量，judge-dispatch 自动读取：

| 变量 | 说明 | 示例 |
|------|------|------|
| `REDIS_URL` | Redis 连接串 | `redis://127.0.0.1:6379` |
| `API_BASE_URL` | Next.js 回调地址 | `http://127.0.0.1:3000` |
| `JUDGE_CALLBACK_SECRET` | 回调鉴权密钥 | 与 .env 中一致 |
| `JUDGE_ID` | 实例标识（可选） | `judge-dispatch` |
| `DISPATCH_PORT` | 监听端口（可选） | `8000` |

### 3. 启动服务

```bash
# 开发模式
REDIS_URL="redis://127.0.0.1:6379" \
API_BASE_URL="http://127.0.0.1:3000" \
JUDGE_CALLBACK_SECRET="你的密钥" \
python3 services/judge-dispatch/main.py

# 生产模式 (PM2)
pm2 start "python3 services/judge-dispatch/main.py" \
  --name judge-dispatch \
  --env REDIS_URL=redis://127.0.0.1:6379 \
  --env API_BASE_URL=http://127.0.0.1:3000 \
  --env JUDGE_CALLBACK_SECRET=你的密钥
pm2 save
```

### 4. 切换判题后端

```bash
# 停掉旧的 judge-agent
pm2 stop codemaster-judge-agent

# 确认 judge-dispatch 运行正常
curl http://127.0.0.1:8000/api/status
```

### 5. 防火墙

```bash
# 放行 WebSocket 端口，让本地 285K 连接
ufw allow 8000/tcp
```

### 6. 连接本地 Judge Worker

在本地 285K 机器上启动 judge-worker（代码在 [judge-local](https://github.com/cherishingher/judge-local) 仓库）：

```bash
python3 judge_worker.py --server ws://云服务器IP:8000/ws/judge --hybrid \
  --p-cores 0,1,2,3,4,5,6,7 \
  --e-cores 8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23
```

## 回退方案

随时可以切回原来的 judge-agent：

```bash
pm2 stop judge-dispatch
pm2 start codemaster-judge-agent
```

两个服务读同一个 Redis Stream、调同一个 callback，可以无缝切换。

## 监控

```bash
# 查看状态
curl http://127.0.0.1:8000/api/status

# 返回示例
{
  "judges_online": 1,
  "judge_workers": [{"id": "abc123", "max_concurrent": 16, "active_tasks": 3}],
  "queue_size": 0,
  "pending_results": 3,
  "total_dispatched": 150,
  "total_completed": 147
}
```

## 协议兼容性

judge-dispatch 与 judge-agent 使用完全相同的：

| 接口 | 格式 |
|------|------|
| Redis 消费 | `XREADGROUP` on `judge:jobs` stream |
| Callback | `POST /api/judge/callback` with `x-judge-secret` header |
| Payload | `{submissionId, status, score, cases[]}` |
| Status 值 | `ACCEPTED`, `WRONG_ANSWER`, `TIME_LIMIT_EXCEEDED`, `RUNTIME_ERROR`, `COMPILE_ERROR` |
