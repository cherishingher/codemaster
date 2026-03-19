# CodeMaster

CodeMaster 是一个面向算法训练与教学场景的在线评测平台（OJ）单仓项目，提供题库管理、提交评测、题单与内容社区等能力，并集成 HUSTOJ 与自建 Judge Agent。

## 项目简介

该项目目标是提供一套可落地的 OJ 平台工程骨架，覆盖：

- 用户认证与会话管理（邮箱/手机号标识）
- 题库发布与版本化管理
- 在线提交、运行与评测回写
- 管理后台（题目、题单、测试点、统计、审核）
- 题解与讨论内容流
- Scratch 图形化题目接入与规则评测

## 主要功能

- **认证体系**：注册、登录、登出、验证码请求、重置密码、登录限流
- **题库能力**：题目列表筛选、题目详情、标签与难度、用户做题进度
- **评测能力**：
  - HUSTOJ 评测（生产主链路）
  - Docker 容器沙箱（`ENABLE_DOCKER_SANDBOX=true`）
  - 本地运行接口（管理员，`ENABLE_LOCAL_RUNNER=true`）
  - Scratch 规则判题与分点评分
- **比赛系统**：
  - 支持 ACM / OI / IOI 三种赛制
  - 用户报名、赛中提交、实时排行榜
  - 自动封榜机制（比赛最后 20% 时间冻结排名）
  - 赛后解封与成绩归档
- **题单与学习路径**：
  - 公开题单列表与搜索
  - 题单详情页含做题进度追踪（已做/AC/未做）
  - 完成率进度条
- **课程/视频教学**：
  - 课程列表（按分类展示）
  - 课程详情（章节目录、视频播放、试看/付费权限）
- **班级/组织**：
  - 教师创建班级、学生通过邀请码加入
  - 布置作业（关联题单 + 截止时间）
  - 按学生维度查看做题进度和完成率
  - 成绩导出 CSV
- **讨论社区**：
  - 发帖（Markdown）、帖子列表、审核流
  - 帖子详情 + 评论
- **提交管理**：提交列表、提交详情、编译/运行信息、测试点明细、提交频率限制
- **支付与权益**：订单创建、支付处理（微信/支付宝/手动）、权益自动发放
- **全局搜索**：跨题目、帖子、题单的关键词搜索
- **管理端**：
  - 题目 CRUD、版本管理、测试点 ZIP 导入、批量操作
  - 比赛管理（创建/删除/关联题目）
  - 用户管理（搜索/角色授予撤销）
  - 题单管理、运营统计看板

## 系统架构

### 架构说明

- `apps/web` 是 Next.js App Router 一体化应用（页面 + API 路由）。
- API 层通过 Prisma 访问 PostgreSQL，并通过 Redis Streams 投递评测任务。
- `services/judge-agent` 作为消费者读取 `judge:jobs`，执行编译/运行后回调 `/api/judge/callback`。
- 评测可走两条路径：
  - HUSTOJ 路径：Web 提交到 HUSTOJ，再轮询/回写状态。
  - 自建 Agent 路径：Redis Stream -> Judge Agent -> 回调 Web。

```mermaid
flowchart LR
  U["用户浏览器"] --> W["Next.js Web (apps/web)"]
  W --> API["App Router API /api/*"]
  API --> PG[(PostgreSQL)]
  API --> R[(Redis Streams: judge:jobs)]

  JA["Judge Agent (services/judge-agent)"] --> R
  JA --> SB["Docker Sandbox"]
  JA --> CB["/api/judge/callback"]
  CB --> PG

  API --> HJ["HUSTOJ"]
  API --> ALI["阿里云 SMS / DM"]

  API --> Contest["/api/contests/*"]
  API --> Classroom["/api/classrooms/*"]
  API --> Search["/api/search"]
  Contest --> PG
  Classroom --> PG
```

## 技术栈

| 层 | 技术 |
| ---- | ---- |
| 语言 | TypeScript、SQL |
| 前端 | Next.js 16、React 19、App Router |
| UI | Tailwind CSS v4、Radix UI、Lucide、Sonner |
| 后端 | Next.js Route Handlers（Node.js Runtime） |
| 数据库 | PostgreSQL 15 |
| 缓存/队列 | Redis 7（Streams） |
| ORM | Prisma |
| 判题 | HUSTOJ + 自建 Judge Agent（Node + `child_process`） |
| 进程管理 | PM2 |
| 部署 | Docker Compose、Nginx、Shell 脚本 |

## 项目结构

```text
codemaster/
├── apps/
│   ├── web/                    # 主应用：Next.js 页面 + API
│   └── graphical/              # Scratch GUI 源码（构建后同步到 web/public）
├── packages/
│   └── db/                     # Prisma Schema 与数据库包
├── services/
│   └── judge-agent/            # Redis Stream 消费与判题执行器
├── scripts/                    # 部署、题目导入、生成器、图形化同步脚本
├── docs/                       # 部署、导题、题库设计、运维文档
├── config/                     # 导题映射等配置
├── infra/
│   ├── sandbox/                # 判题沙箱 Docker 镜像（安全隔离）
│   ├── nginx/                  # 生产 Nginx + HTTPS 配置模板
│   └── hustoj/                 # HUSTOJ 集成说明
├── docker-compose.yml          # PostgreSQL + Redis + 沙箱构建
├── .env.example                # 环境变量模板
└── package.json                # Monorepo 根脚本与 workspace 定义
```

## 安装方法

### 1) 准备环境

- Node.js 20+
- npm 10+
- Docker / Docker Compose
- （生产环境）Nginx、Certbot

### 2) 安装依赖

```bash
npm install
```

### 3) 配置环境变量

```bash
cp .env.example .env
```

**必须修改以下变量**（留空或使用默认值将导致启动失败或安全风险）：

```bash
# 生成随机密钥的推荐方式
openssl rand -base64 32  # 用于 AUTH_CODE_SECRET
openssl rand -base64 32  # 用于 JUDGE_CALLBACK_SECRET
openssl rand -base64 16  # 用于 POSTGRES_PASSWORD
openssl rand -base64 16  # 用于 REDIS_PASSWORD
```

将生成的值填入 `.env`：

```env
AUTH_CODE_SECRET="<生成的随机值>"
JUDGE_CALLBACK_SECRET="<生成的随机值>"
POSTGRES_PASSWORD="<生成的随机值>"
REDIS_PASSWORD="<生成的随机值>"
DATABASE_URL="postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5432/oj?schema=public"
REDIS_URL="redis://:<REDIS_PASSWORD>@127.0.0.1:6379"
```

### 4) 启动基础服务

```bash
docker-compose up -d db redis
```

### 5) 初始化数据库

```bash
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npx prisma generate --schema packages/db/prisma/schema.prisma
```

### 6) 构建判题沙箱镜像（推荐）

沙箱为代码执行提供容器级隔离（禁止网络、限制内存/CPU/进程数、只读文件系统）：

```bash
docker build -t codemaster-sandbox -f infra/sandbox/Dockerfile .
```

启用沙箱需在 `.env` 中设置：

```env
ENABLE_DOCKER_SANDBOX="true"
```

> 未启用时将自动 fallback 到 ulimit 方案（安全性较低）。

## 启动项目

### 开发模式（Web）

```bash
npm run dev
```

默认访问：`http://127.0.0.1:3000`

### 可选：启动 Judge Agent（开发）

```bash
npm run judge:dev
```

### 生产模式（手动）

```bash
npm --prefix apps/web run build
HOST=127.0.0.1 PORT=3000 NODE_ENV=production npm --prefix apps/web run start
```

### 生产部署完整流程

```bash
# 1. 生成密钥并配置 .env（见上方说明）

# 2. 启动基础设施
docker-compose up -d db redis

# 3. 构建沙箱镜像
docker build -t codemaster-sandbox -f infra/sandbox/Dockerfile .

# 4. 安装依赖 + 数据库迁移
npm ci --workspace apps/web --workspace services/judge-agent --include-workspace-root
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npx prisma generate --schema packages/db/prisma/schema.prisma

# 5. 构建
npm --prefix apps/web run build

# 6. 使用 PM2 启动
HOST=127.0.0.1 PORT=3000 NODE_ENV=production \
  pm2 start npm --name codemaster -- --prefix apps/web run start

# 7. （可选）启动 Judge Agent
NODE_ENV=production \
  pm2 start npm --name codemaster-judge-agent -- --prefix services/judge-agent run start

pm2 save

# 8. 创建管理员账号
node scripts/create-admin.mjs --email admin@your-domain.com

# 9. 配置 HTTPS（见下方说明）
```

### 配置 HTTPS（生产必需）

项目提供了预配置的 Nginx 反向代理模板：

```bash
# 安装 Nginx + Certbot
apt install -y nginx certbot python3-certbot-nginx

# 申请 SSL 证书
certbot certonly --webroot -w /var/www/certbot -d your-domain.com

# 部署 Nginx 配置
sed 's/YOUR_DOMAIN/your-domain.com/g' infra/nginx/codemaster.conf \
  > /etc/nginx/sites-available/codemaster
ln -sf /etc/nginx/sites-available/codemaster /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Nginx 配置包含：TLS 1.2+、HSTS preload、OCSP stapling、安全响应头、敏感文件拦截（.env/.git/.sql）。

详见 `infra/nginx/README.md`。

### 创建管理员账号

项目提供安全的 CLI 脚本直接写库创建管理员，不经过 Web 注册流程，避免凭据泄露和抢注风险。

```bash
# 自动生成强密码（推荐）
node scripts/create-admin.mjs --email admin@your-domain.com

# 指定密码和姓名
node scripts/create-admin.mjs --email admin@your-domain.com --password 'MyStr0ngP@ss' --name '管理员'

# 用手机号创建
node scripts/create-admin.mjs --phone +8613800138000

# 将已注册的普通用户提升为管理员（脚本自动检测并仅授予角色）
node scripts/create-admin.mjs --email existing-user@example.com
```

> 省略 `--password` 时脚本自动生成 24 字符随机密码并打印到终端，请立即记录。首次登录后建议修改密码。

## 环境变量配置

复制模板并填写：

```bash
cp .env.example .env
```

核心变量如下：

| 变量 | 说明 | 示例 |
| ---- | ---- | ---- |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://postgres:xxx@127.0.0.1:5432/oj?schema=public` |
| `REDIS_URL` | Redis 连接串 | `redis://:xxx@127.0.0.1:6379` |
| `AUTH_CODE_SECRET` | **必填** 验证码签名密钥（≥16 字符） | `openssl rand -base64 32` |
| `JUDGE_CALLBACK_SECRET` | **必填** Judge 回调鉴权密钥（≥16 字符） | `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | **必填** PostgreSQL 密码 | `openssl rand -base64 16` |
| `REDIS_PASSWORD` | **必填** Redis 密码 | `openssl rand -base64 16` |
| `DEBUG_AUTH_CODES` | 开发环境回显验证码（生产**必须**为 false） | `false` |
| `BOOTSTRAP_ADMIN_EMAIL` | 首个管理员邮箱（注册时自动授予 admin） | `admin@example.com` |
| `ENABLE_DOCKER_SANDBOX` | 启用 Docker 容器沙箱执行代码 | `true/false` |
| `SANDBOX_IMAGE` | 沙箱 Docker 镜像名 | `codemaster-sandbox` |
| `SANDBOX_MEMORY` | 沙箱内存限制 | `256m` |
| `SANDBOX_CPUS` | 沙箱 CPU 限制 | `1` |
| `SANDBOX_PIDS` | 沙箱进程数限制 | `32` |
| `SANDBOX_TMPFS_SIZE` | 沙箱可写临时目录大小 | `32m` |
| `ENABLE_LOCAL_RUNNER` | 是否启用本地运行接口 | `true/false` |
| `CPP_COMPILER` | 本地运行 C++ 编译器 | `g++` |
| `API_BASE_URL` | Judge Agent 回调 Web 地址 | `http://127.0.0.1:3001` |
| `JUDGE_ID` | Judge 实例 ID | `judge-local` |
| `HUSTOJ_MYSQL_SSL` | HUSTOJ MySQL 启用 SSL | `true/false` |
| `ALIYUN_*` | 阿里云 SMS/DirectMail 配置 | 见 `.env.example` |
| `HUSTOJ_*` | HUSTOJ MySQL/数据目录连接配置 | 见 `.env.example` |

## API 文档（核心接口）

API 风格为 REST 风格 Route Handlers（`/api/*`）。

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| `POST` | `/api/auth/login` | 邮箱/手机号 + 密码登录 |
| `POST` | `/api/auth/register` | 验证码注册 |
| `POST` | `/api/auth/request-code` | 请求短信/邮件验证码 |
| `POST` | `/api/auth/reset-password` | 验证码重置密码 |
| `GET` | `/api/auth/me` | 获取当前会话用户 |
| `POST` | `/api/auth/logout` | 登出 |
| `GET` | `/api/problems` | 题目分页与筛选 |
| `GET` | `/api/problems/:id` | 题目详情（按 id/slug） |
| `POST` | `/api/problems/:id/submit` | 提交评测（HUSTOJ/Scratch） |
| `POST` | `/api/problems/:id/run` | 本地运行（管理员） |
| `GET` | `/api/submissions` | 当前用户提交列表 |
| `GET` | `/api/submissions/:id` | 提交详情/状态同步 |
| `POST` | `/api/judge/callback` | Judge 结果回调 |
| `GET` | `/api/problem-sets` | 公开题单列表 |
| `GET` | `/api/problem-sets/:id` | 题单详情 |
| `GET` | `/api/health` | 健康检查 |
| `GET/POST` | `/api/admin/problems` | 后台题目列表/创建 |
| `GET/PATCH` | `/api/admin/problems/:id` | 后台题目详情/更新 |
| `GET/POST` | `/api/admin/problems/:id/versions` | 题目版本管理 |
| `POST` | `/api/admin/problems/:id/testcases-zip` | 测试点 ZIP 导入 |
| `GET/POST` | `/api/admin/problem-sets` | 后台题单管理 |
| `GET/POST` | `/api/admin/contests` | 后台比赛管理 |
| `PATCH/DELETE` | `/api/admin/contests/:id` | 比赛编辑/删除 |
| `GET/PATCH` | `/api/admin/users` | 用户列表/角色管理 |
| **比赛** | | |
| `GET` | `/api/contests` | 比赛列表（支持 status 筛选） |
| `GET` | `/api/contests/:id` | 比赛详情（题目、报名状态） |
| `POST` | `/api/contests/:id/register` | 比赛报名 |
| `GET` | `/api/contests/:id/standings` | 排行榜（ACM 罚时 / OI 总分） |
| `POST` | `/api/contests/:id/submit` | 赛中提交 |
| **班级** | | |
| `GET/POST` | `/api/classrooms` | 班级列表/创建 |
| `POST` | `/api/classrooms/:id/join` | 加入班级（邀请码） |
| `GET/POST` | `/api/classrooms/:id/assignments` | 作业列表/布置 |
| `GET` | `/api/classrooms/:id/stats` | 班级成绩统计 |
| **其他** | | |
| `GET` | `/api/search` | 全局搜索（题目/帖子/题单） |
| `POST` | `/api/orders/:id/pay` | 支付处理与权益发放 |

## 数据库设计

数据库定义在 `packages/db/prisma/schema.prisma`，核心实体如下：

- 用户域：`User`、`Session`、`Role`、`UserRole`、`VerificationCode`
- 题库域：`Problem`、`ProblemVersion`、`Testcase`、`Tag`、`ProblemTag`
- 评测域：`Submission`、`SubmissionCase`、`ProblemJudgeConfig`、`ProblemStat`、`UserProblemProgress`
- 比赛域：`Contest`、`ContestProblem`、`ContestParticipant`
- 班级域：`Classroom`、`ClassroomMember`、`ClassroomAssignment`
- 内容域：`Post`、`Comment`、`Solution`、`ModerationLog`
- 题单域：`ProblemSet`、`ProblemSetItem`
- 商业域：`Product`、`Order`、`Payment`、`Entitlement`
- 学习域：`Course`、`Section`、`Lesson`、`Enrollment`

```mermaid
erDiagram
  USER ||--o{ SESSION : has
  USER ||--o{ USER_ROLE : has
  ROLE ||--o{ USER_ROLE : grants

  USER ||--o{ SUBMISSION : submits
  PROBLEM ||--o{ PROBLEM_VERSION : has
  PROBLEM ||--o{ SUBMISSION : receives
  PROBLEM_VERSION ||--o{ TESTCASE : contains
  PROBLEM_VERSION ||--o{ PROBLEM_JUDGE_CONFIG : configures

  SUBMISSION ||--o{ SUBMISSION_CASE : includes
  TESTCASE ||--o{ SUBMISSION_CASE : maps

  PROBLEM ||--o{ PROBLEM_TAG : tagged
  TAG ||--o{ PROBLEM_TAG : labels

  USER ||--o{ USER_PROBLEM_PROGRESS : tracks
  PROBLEM ||--o{ USER_PROBLEM_PROGRESS : trackedBy
  PROBLEM ||--|| PROBLEM_STAT : stats

  USER ||--o{ PROBLEM_SET : owns
  PROBLEM_SET ||--o{ PROBLEM_SET_ITEM : includes
  PROBLEM ||--o{ PROBLEM_SET_ITEM : appearsIn

  CONTEST ||--o{ CONTEST_PROBLEM : has
  CONTEST ||--o{ CONTEST_PARTICIPANT : enrolls
  PROBLEM ||--o{ CONTEST_PROBLEM : appearsIn
  USER ||--o{ CONTEST_PARTICIPANT : joins

  USER ||--o{ CLASSROOM : teaches
  CLASSROOM ||--o{ CLASSROOM_MEMBER : has
  CLASSROOM ||--o{ CLASSROOM_ASSIGNMENT : assigns
  USER ||--o{ CLASSROOM_MEMBER : joins
  PROBLEM_SET ||--o{ CLASSROOM_ASSIGNMENT : uses

  USER ||--o{ ORDER : places
  ORDER ||--o{ PAYMENT : paidBy
  PRODUCT ||--o{ ORDER : soldIn
  USER ||--o{ ENTITLEMENT : holds
  PRODUCT ||--o{ ENTITLEMENT : grants
```

## 开发指南

- 代码组织
  - 页面：`apps/web/src/app/**/page.tsx`
  - API：`apps/web/src/app/api/**/route.ts`
  - 业务逻辑：`apps/web/src/lib/**`
  - UI 组件：`apps/web/src/components/**`
- 常用脚本

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:migrate
npm run judge:dev
```

- 题库导入与生成器

```bash
npm run luogu:sync -- --help
npm run luogu:samples-to-testcases -- --help
npm run generator:verify -- --all
npm run generator:generate -- --all
```

## 部署方法

### 一键部署（推荐）

项目内置生产脚本：`scripts/deploy-prod.sh`

```bash
# 建议使用专用非 root 用户运行
cd /home/codemaster/codemaster
chmod +x scripts/deploy-prod.sh

# 首次部署前务必：
# 1. 配置 .env（见安装方法第 3 步）
# 2. 构建沙箱镜像：docker build -t codemaster-sandbox -f infra/sandbox/Dockerfile .

./scripts/deploy-prod.sh
```

如需同时拉起判题代理：

```bash
START_JUDGE_AGENT=true JUDGE_PM2_APP=codemaster-judge-agent ./scripts/deploy-prod.sh
```

> 脚本会自动检测 root 运行并警告。如确需以 root 运行：`ALLOW_ROOT=true ./scripts/deploy-prod.sh`

### 手工部署（关键步骤）

```bash
docker-compose up -d db redis
docker build -t codemaster-sandbox -f infra/sandbox/Dockerfile .
npm ci --workspace apps/web --workspace services/judge-agent --include-workspace-root
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npx prisma generate --schema packages/db/prisma/schema.prisma
npm --prefix apps/web run build
HOST=127.0.0.1 PORT=3000 NODE_ENV=production pm2 start npm --name codemaster -- --prefix apps/web run start
pm2 save
```

更多恢复与故障处理见：`docs/prod-deploy-and-recovery.md`。

## 安全特性

项目内置了多层纵深安全防护，覆盖认证、执行、传输、部署全链路。

### 认证与会话

| 防护项 | 说明 |
| ---- | ---- |
| 密码哈希 | bcrypt（salt=10）|
| 密码策略 | 8-128 位，必须包含字母和数字（`lib/password-policy.ts`） |
| 验证码签名 | HMAC-SHA256，密钥通过 `AUTH_CODE_SECRET` 配置，缺失时拒绝启动 |
| 验证码生成 | `crypto.randomInt()`（非 `Math.random()`） |
| 登录限流 | 按账号 10 次 / 15 分钟，按 IP 30 次 / 15 分钟（`lib/rate-limit.ts`） |
| 验证码限流 | 按 target 60 秒冷却，按 IP 20 次 / 小时 |
| Session 管理 | 7 天过期、访问时主动删除过期记录、概率性批量清理 |
| 用户枚举防护 | 注册/重置密码的验证码请求接口返回统一响应 |
| DEBUG 保护 | `DEBUG_AUTH_CODES` 仅在 `NODE_ENV !== "production"` 时生效，日志不打印验证码明文 |

### 代码执行沙箱

| 防护项 | 说明 |
| ---- | ---- |
| Docker 容器隔离 | `--network none`（禁止网络）、`--read-only`（只读文件系统）、非 root 用户（uid 65534） |
| 资源限制 | `--memory 256m`、`--cpus 1`、`--pids-limit 32`、可写 tmpfs 上限 32MB |
| ulimit fallback | 未启用 Docker 时自动降级为 ulimit（CPU/文件/虚拟内存/进程数限制） |
| 代码大小限制 | 提交 ≤ 64KB，run 端点 ≤ 64KB |
| 提交频率限制 | 每用户 10 次 / 分钟 |
| 路径遍历防护 | `file://` URI 白名单目录校验（judge-agent + hustoj.ts），null byte 检测 |
| 沙箱镜像 | `infra/sandbox/Dockerfile`：最小化 Ubuntu，仅含 g++ 和 python3 |

### API 与传输

| 防护项 | 说明 |
| ---- | ---- |
| 全局速率限制 | 所有 API 120 请求 / 分钟 / IP，响应附带 `X-RateLimit-*` 头 |
| Judge 回调鉴权 | `crypto.timingSafeEqual` 常量时间比较，防止时序攻击 |
| 管理路由保护 | Middleware 对 `/admin/*` 和 `/api/admin/*` 强制 session 校验 |
| HTTPS 强制 | Middleware 层 HTTP → HTTPS 301 重定向（生产环境） |
| 错误信息脱敏 | HUSTOJ 等内部错误不返回给客户端，仅写日志 |
| 日志安全 | `lib/logger.ts` 自动脱敏 password/token/secret/cookie 等字段 |

### 安全响应头

| 头 | 值 |
| ---- | ---- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'none'; upgrade-insecure-requests` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation()` |

### 部署与基础设施

| 防护项 | 说明 |
| ---- | ---- |
| 端口绑定 | PostgreSQL / Redis 仅监听 `127.0.0.1` |
| Redis 认证 | `requirepass` 强制密码 |
| 环境变量校验 | 启动时检查必需密钥，生产环境警告弱密钥（`lib/env-check.ts`） |
| 非 root 检查 | 部署脚本默认禁止 root 运行，需 `ALLOW_ROOT=true` 显式覆盖 |
| .env 审查 | 部署脚本自动检测危险配置（`DEBUG_AUTH_CODES=true`、`ENABLE_LOCAL_RUNNER=true`） |
| Nginx 安全 | TLS 1.2+、OCSP stapling、拦截 `.env/.git/.sql/.log` 等敏感文件 |
| HUSTOJ MySQL SSL | 支持 `HUSTOJ_MYSQL_SSL=true` 启用加密连接 |
| 默认密钥清空 | `.env.example` 所有密钥默认留空，强制用户填写 |

## 未来改进

- CAPTCHA 防自动化（推荐 hCaptcha / Cloudflare Turnstile）
- MeiliSearch / Elasticsearch 全文搜索（当前为数据库 LIKE 查询）
- 监考模式（比赛期间限制切屏/复制粘贴）
- AI 解题提示（基于 LLM）
- 多语言判题扩展（Java / Go / Rust）
- 比赛数据大屏（实时提交/AC 动态）
- 微信/支付宝实际支付网关对接（当前为手动/模拟支付）
- 多地域部署与容灾方案

## License

仓库中未发现明确的 `LICENSE` 文件，当前许可证状态为未指定。
