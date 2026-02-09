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

## 阿里云验证码快速接入
查看完整流程与最短执行清单：`docs/aliyun-auth-setup.md`

## 结构
- `apps/web`：前后端一体（Next.js App Router）
- `packages/db`：Prisma schema 与数据库包
- `services/judge-agent`：自建判题服务
- `infra`：部署与基础设施配置

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

### 当前状态（注意）
- Scratch 评分已支持多规则累计 **分值**（总分为各得分点之和）。
- Scratch 判题仍以 **AC/WA** 为最终状态（非满分视为 WA），但会记录实际分数。

### 待办 / 计划
- Scratch 评分状态扩展：按分值给出 `PARTIAL`（可选）。
- Scratch 得分点批量导入（ZIP + config.yml 或文件名约定）。
- 阿里云短信/邮件验证码注册流程落地与生产配置。

## Scratch 规则生成（简要）
1. 进入管理端题目详情页
2. “Scratch 评测规则生成”上传标准答案 `.sb3`
3. 选择版本（可选），角色名（可选）
4. 点击生成 → 规则写入该版本 `scratchRules`
