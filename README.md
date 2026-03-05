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

## 前端 UI 体系（迁移中）
当前前端重构限定在 `apps/web` 的 UI 层，业务逻辑、API 路由、Prisma、Judge Agent 与部署配置保持不变。

### 目录
- `apps/web/src/app`：页面与布局，保留原有路由和数据调用，只调整展示层
- `apps/web/src/components/ui`：基础 UI primitives（Button、Input、Card、Badge、Tabs、Dropdown、Skeleton 等）
- `apps/web/src/components/patterns`：通用展示模式（AuthShell、SectionHeading、StatePanel 等）
- `apps/web/src/components/layout`：导航、页头页脚、应用壳层
- `apps/web/src/components/auth`：认证相关纯展示组件
- `apps/web/src/components/problems`：题库/做题区纯展示组件
- `apps/web/src/app/globals.css`：全局 tokens、基础排版、主题辅助样式

### 迁移批次
- `Batch 1`：完成 design tokens、基础 primitives、全局 shell、首页、认证页、loading/empty 基础状态
- `Batch 2`：题库列表页、提交列表页、筛选栏、分页与通用列表模式
- `Batch 3`：题目详情工作区、代码区/题面区、提交结果面板、题内历史提交
- `Batch 4`：管理员壳层、题库管理列表、题单列表、导入导出页、后台通用表格/筛选模式
- `Batch 5`：管理员详情页、个人中心、图形化入口包装层、错误/未授权状态补齐
- `Batch 6`：无障碍与键盘交互收口、视觉一致性检查、回归验收

### 当前完成度
- `Batch 1`：已完成并通过 `build`
- `Batch 2`：题库列表页、提交列表页已完成并通过 `build`
- `Batch 3-6`：待迁移

### 人工确认点
- 首页、登录、注册、找回密码页的视觉改动是否已经足够贴近“教育平台 + claymorphism”方向
- 做题页暂时保留原界面；后续如果要重做，需要单独定义不同于 landing/list 的工作区风格
- 顶部导航、页脚、全局按钮/输入框/卡片样式是否需要再收紧间距
- 全局背景与阴影层级在桌面端和移动端是否都可接受
- `apps/web/public/graphical` 下历史产物在 `lint` 时仍有旧式 `eslint-env` warning；当前不影响 `build`，但不属于本轮 UI 改造范围

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
