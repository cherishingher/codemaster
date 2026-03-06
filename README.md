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

- 认证体系：注册、登录、登出、验证码请求、重置密码
- 题库能力：题目列表筛选、题目详情、标签与难度、用户做题进度
- 评测能力：
  - HUSTOJ 评测（生产主链路）
  - 本地运行接口（管理员，`ENABLE_LOCAL_RUNNER=true`）
  - Scratch 规则判题与分点评分
- 提交管理：提交列表、提交详情、编译/运行信息、测试点明细
- 管理端：题目 CRUD、版本管理、测试点 ZIP 导入、批量操作、统计概览
- 内容模块：帖子、评论、审核日志
- 题单模块：公开题单列表与详情，后台题单维护

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
  JA --> CB["/api/judge/callback"]
  CB --> PG

  API --> HJ["HUSTOJ"]
  API --> ALI["阿里云 SMS / DM"]
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
├── infra/                      # 基础设施与外部系统集成说明
├── docker-compose.yml          # PostgreSQL + Redis 本地/服务器依赖
├── .env.example                # 环境变量模板
└── package.json                # Monorepo 根脚本与 workspace 定义
```

## 安装方法

### 1) 准备环境

- Node.js 20+
- npm 10+
- Docker / Docker Compose

### 2) 安装依赖

```bash
npm install
```

### 3) 启动基础服务

```bash
docker-compose up -d db redis
```

### 4) 初始化数据库

```bash
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npx prisma generate --schema packages/db/prisma/schema.prisma
```

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

## 环境变量配置

复制模板并填写：

```bash
cp .env.example .env
```

核心变量如下：

| 变量 | 说明 | 示例 |
| ---- | ---- | ---- |
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://postgres:pass@127.0.0.1:5432/oj?schema=public` |
| `REDIS_URL` | Redis 连接串 | `redis://127.0.0.1:6379` |
| `AUTH_CODE_SECRET` | 验证码签名密钥 | `change-me` |
| `DEBUG_AUTH_CODES` | 开发环境回显验证码 | `true/false` |
| `BOOTSTRAP_ADMIN_EMAIL` | 首个管理员邮箱（注册时自动授予 admin） | `admin@example.com` |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云 AccessKeyId | `...` |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云 AccessKeySecret | `...` |
| `ALIYUN_SMS_SIGN_NAME` | 短信签名 | `...` |
| `ALIYUN_SMS_TEMPLATE_CODE` | 短信模板 Code | `...` |
| `ALIYUN_DM_ACCOUNT_NAME` | 直邮发信地址 | `...` |
| `JUDGE_CALLBACK_SECRET` | Judge 回调鉴权密钥 | `dev-judge-secret` |
| `API_BASE_URL` | Judge Agent 回调 Web 地址 | `http://127.0.0.1:3001` |
| `JUDGE_ID` | Judge 实例 ID | `judge-local` |
| `ENABLE_LOCAL_RUNNER` | 是否启用本地运行接口 | `true/false` |
| `CPP_COMPILER` | 本地运行 C++ 编译器 | `g++` |
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

## 数据库设计

数据库定义在 `packages/db/prisma/schema.prisma`，核心实体如下：

- 用户域：`User`、`Session`、`Role`、`UserRole`、`VerificationCode`
- 题库域：`Problem`、`ProblemVersion`、`Testcase`、`Tag`、`ProblemTag`
- 评测域：`Submission`、`SubmissionCase`、`ProblemJudgeConfig`、`ProblemStat`、`UserProblemProgress`
- 内容域：`Post`、`Comment`、`Solution`、`ModerationLog`
- 题单域：`ProblemSet`、`ProblemSetItem`

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
cd /root/codemaster
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh
```

如需同时拉起判题代理：

```bash
START_JUDGE_AGENT=true JUDGE_PM2_APP=codemaster-judge-agent ./scripts/deploy-prod.sh
```

### 手工部署（关键步骤）

```bash
docker-compose up -d db redis
npm ci --workspace apps/web --workspace services/judge-agent --include-workspace-root
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
npx prisma generate --schema packages/db/prisma/schema.prisma
npm --prefix apps/web run build
HOST=127.0.0.1 PORT=3000 NODE_ENV=production pm2 start npm --name codemaster --cwd /root/codemaster -- --prefix apps/web run start
pm2 save
```

更多恢复与故障处理见：`docs/prod-deploy-and-recovery.md`。

## 未来改进

基于当前 TODO 与代码现状，优先级建议如下：

- 判题沙箱隔离（容器/微虚拟机 + 更严格资源限制）
- 比赛功能完善（报名、榜单、封榜、归档）
- 课程/支付/权益模块打通（当前模型已预留）
- 题库与内容搜索（可接入 MeiliSearch / Elasticsearch）
- 多地域部署与容灾方案

## License

仓库中未发现明确的 `LICENSE` 文件，当前许可证状态为未指定。
