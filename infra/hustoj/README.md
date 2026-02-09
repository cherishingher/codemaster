# HUSTOJ 判题服务接入

本项目使用 HUSTOJ 作为判题后端（替换本地 judge-agent）。

## 1. 拉取 HUSTOJ 源码

```bash
bash infra/hustoj/bootstrap.sh
```

## 2. 启动 HUSTOJ 判题服务

```bash
cd infra/hustoj
docker compose up -d --build
```

会启动：
- `hustoj-mysql`（端口 3306，使用 MariaDB 10.6 以兼容 Apple Silicon）
- `hustoj-judge`（判题守护进程）

## 3. 配置项目环境变量

在 `.env` 中加入：

```
HUSTOJ_MYSQL_HOST=127.0.0.1
HUSTOJ_MYSQL_PORT=3307
HUSTOJ_MYSQL_USER=root
HUSTOJ_MYSQL_PASSWORD=root
HUSTOJ_MYSQL_DB=jol
HUSTOJ_DATA_DIR=/Users/cherisher/Desktop/扣得码斯特/infra/hustoj/data
```

> `HUSTOJ_DATA_DIR` 必须指向宿主机共享目录，容器内将挂载到 `/home/judge/data`。

## 4. 同步题库并判题

1. 在后台题目详情页点击“同步到 HUSTOJ”
2. 提交代码（`/api/problems/:id/submit`）
3. 通过 `/api/submissions/:id` 获取结果（会自动同步状态）

## 5. 语言支持

当前仅启用：
- C++（映射 HUSTOJ `LANG_CPP=1`）
- Python（映射 HUSTOJ `LANG_PYTHON=6`）

> C++11/14/17 会统一使用 HUSTOJ 的 C++ 编译器，标准由 `judge.conf` 中 `OJ_CPP_STD` 控制。
