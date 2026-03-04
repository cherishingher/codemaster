# CodeMaster (OJ + 课程 + 比赛)

单人全栈落地骨架：Next.js + PostgreSQL + Redis + 自建 Judge Agent。

## 快速开始（本地）
1. 准备环境变量：复制 `.env.example` 为 `.env`
2. 安装依赖：
   ```bash
   npm install
   ```
3. 生成 Prisma Client：
   ```bash
   npm run db:generate
   ```
4. 启动开发服务：
   ```bash
   npm run dev
   ```

## 部署所需组件
- **Web 应用**：`apps/web`（Next.js）
- **PostgreSQL**：主业务数据库（Prisma）
- **Redis**：任务队列 / 缓存（评测任务流）
- **HUSTOJ**：评测后端（含 MySQL）
- **Judge Agent**：自建判题服务（`services/judge-agent`）
- **Scratch GUI**：图形化入口（构建产物在 `apps/web/public/graphical`）

## 部署顺序（建议）
1. **基础服务**：启动 PostgreSQL、Redis
2. **HUSTOJ**：启动 HUSTOJ（含 MySQL），确保能访问并初始化
3. **Web**：
   - 配置 `.env`
   - 运行 Prisma 迁移/生成
   - 启动 `apps/web`
4. **Judge Agent**：启动 `services/judge-agent`（确保能连 Redis 与 Web API）
5. **图形化**：如需 Scratch，确保 `apps/web/public/graphical` 已同步构建产物

## 生产部署脚本
- 脚本：`scripts/deploy-prod.sh`
- 手册：`docs/prod-deploy-and-recovery.md`

当前阿里云服务器推荐直接执行：
```bash
cd /root/codemaster
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh
```

## 阿里云验证码快速接入
查看完整流程与最短执行清单：`docs/aliyun-auth-setup.md`

## 洛谷题目抓取脚本
- 脚本：`scripts/luogu-sync.mjs`
- 文档：`docs/luogu-sync-script.md`
- 公开样例转测试点：`scripts/luogu-sample-testcases.mjs`
- 文档：`docs/luogu-sample-testcases.md`
- 测评数据生成器框架：`docs/problem-generator-framework.md`
- 默认标签映射：`config/luogu-tag-map.json`
- 题目级手工标签规则：`config/luogu-problem-tag-overrides.json`

常用示例：
```bash
npm run luogu:sync -- --pids P1001,P1008 --output ./tmp/luogu-import.json
```

给已导入的洛谷题回填标签：
```bash
npm run luogu:backfill-tags --
```

把历史洛谷标签名规范化：
```bash
npm run luogu:normalize-tags --
```

如果要直接导入本地站点：
```bash
npm run luogu:sync -- \
  --pids P1001 \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```

把公开样例批量转成测试点并导入本地站点：
```bash
npm run luogu:samples-to-testcases -- \
  --from P1001 --to P1100 \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```

验证题目生成器：
```bash
npm run generator:verify -- --all
```

批量生成洛谷题目的生成器模板：
```bash
npm run generator:scaffold -- --from P1002 --to P1010
```

生成 hidden/stress 数据并导入本地站点：
```bash
npm run generator:generate -- --all \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```

## 结构
- `apps/web`：前后端一体（Next.js App Router）
- `packages/db`：Prisma schema 与数据库包
- `services/judge-agent`：自建判题服务
- `infra`：部署与基础设施配置

## 题库数据库升级（LeetCode 风格）
- 设计文档：`docs/problem-bank-db-design.md`
- Prisma Schema：`packages/db/prisma/schema.prisma`
- 迁移目录：`packages/db/prisma/migrations/20260303233000_leetcode_style_problem_bank`

### 迁移
1. 执行 Prisma migration：
   ```bash
   npx prisma migrate deploy --schema packages/db/prisma/schema.prisma
   ```
2. 重新生成 Prisma Client：
   ```bash
   npx prisma generate --schema packages/db/prisma/schema.prisma
   ```

### Seed
当前仓库保留了最小种子入口（管理员权限）：
```bash
curl -X POST http://127.0.0.1:3000/api/admin/dev/seed \
  -H 'cookie: cm_session=<admin_session_token>'
```

该入口会插入 2 道演示题、标签、样例、测试点、官方题解以及默认 `ProblemJudgeConfig`。

### 最小 API
- `GET /api/problems`
  - 支持：`keyword|q`、`difficulty`、`tag|tags`、`status`、`userStatus`、`page`、`limit`
- `GET /api/problems/:idOrSlug`
  - 返回：`currentVersion`、`tags`、`judgeConfigs`、样例
- `POST /api/problems/:idOrSlug/submit`
  - 创建 `Submission` + `SourceCode`
- `GET /api/submissions`
  - 当前用户提交分页列表
- `GET /api/submissions/:id`
  - 当前用户或管理员可见；包含 `compileInfo`、`runtimeInfo`、安全裁剪后的 `submission_cases`

## 判题链路
提交 → 任务入 Redis Streams → Judge Agent 拉取 → 沙箱执行 → 结果回写 API。

## 近期协作记录（总结）
以下内容为本次对话期间完成与规划事项的摘要，便于后续接力。

### 已完成
- **HUSTOJ 联通与评测跑通**：Docker 版 HUSTOJ 可用，题目同步、提交、评测结果回写正常。
- **ZIP 测试点上传**：支持按 `{problemId}.zip` 上传，`*1.in/*1.out` 成对；支持 `config.yml/.yaml` 覆盖时限、内存、分值、预测与分组；上传自动同步到 HUSTOJ。
- **评测结果展示**：前端提交后可展示评测结果，提供漂浮提示条。
- **Scratch 接入（图形化入口）**：
  - 首页导航增加 “图形化” 入口，嵌入 Scratch GUI（构建产物同步到 `apps/web/public/graphical`）。
  - 题目做题页：选择 Scratch 语言后切换至 Scratch 组件；禁用本地运行。
- **Scratch 判题（必做/可选）**：
  - 实现 Scratch 规则匹配判题（宽松模式：顶层与子栈可无序、表达式允许等价）。
  - 新增 Scratch 规则“生成器”接口（通过上传标准答案 `.sb3` / `project.json` 自动生成规则并写入版本）。
- **标签体系**：
  - 管理端题库：语言/数据结构/算法标签可选；
  - 语言标签保留 `C++ / Python / scratch-必做 / scratch-可选`。

### 已实现的 Scratch 规则生成入口
- 管理端题目详情页：**Scratch 评测规则生成**
  - 上传标准答案 `.sb3` 或 `project.json`
  - 可选填角色名、选择版本
  - 可选分值（支持追加/覆盖）
  - 支持批量 ZIP 导入得分点（可选 `config.yml/.yaml/.json`，或按文件名识别分值）

### 当前状态（注意）
- Scratch 评分已支持多规则累计 **分值**（总分为各得分点之和）。
- Scratch 判题状态已支持 **AC / PARTIAL / WA**（部分通过会显示 PARTIAL）。

### 待办 / 计划
- 阿里云短信/邮件验证码注册流程落地与生产配置。

## Scratch 规则生成（简要）
1. 进入管理端题目详情页
2. “Scratch 评测规则生成”上传标准答案 `.sb3`
3. 选择版本（可选），角色名（可选）
4. 点击生成 → 规则写入该版本 `scratchRules`
