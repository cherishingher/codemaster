# CodeMaster 平台使用文档

本目录用于说明当前 CodeMaster 平台已经落地的主要功能，包括学习端、商品与会员、训练营与竞赛、社区与家长端、管理后台、学校/机构工作台与开放 API。

文档按页面拆分，适合直接交给产品、运营、教研、测试和实施同学使用。

## 目录

1. [快速开始与角色说明](./01-quick-start.md)
2. [学习端使用说明：题库、提交、学习报告、AI](./02-learning-and-ai.md)
3. [商品、订单、会员与内容解锁](./03-commerce-membership-access.md)
4. [进阶学习路径、训练营与模拟赛](./04-training-camp-contest.md)
5. [社区互动、积分奖励与家长端](./05-community-parent-growth.md)
6. [管理后台与内容生产](./06-admin-content-ops.md)
7. [学校/机构工作台与开放 API](./07-tenant-school-and-open-api.md)

## 建议阅读顺序

- 新用户：先看 `01`、`02`、`03`
- 付费用户或学习顾问：继续看 `04`、`05`
- 运营/教研/管理员：重点看 `06`
- 学校/机构实施与对接方：重点看 `07`

## 平台能力总览

### 学习侧

- 账号注册、登录、找回密码
- 题库浏览、做题、提交记录、图形化题目
- 高级题解、视频解析、训练路径
- AI 推荐、AI 辅导、个性化学习规划
- 学习报告、个性化学习分析

### 商业化侧

- 商品中心、内容包、会员中心
- 下单、支付、我的订单、我的资产
- 训练营报名、模拟赛报名
- 内容解锁与权限控制

### 社区与成长侧

- 学习小组、讨论区、动态分享
- 积分获取、积分兑换
- 家长绑定与家长增强报告

### 运营与后台

- 题库管理、题单管理、商品管理
- 内容生产后台：题解、视频、路径、工作流
- 训练营、模拟赛、学习分析
- 机构、教师、班级、作业与统计

## 主要前台入口

```text
/                      首页
/login                 登录
/register              注册
/problems              题库
/submissions           提交记录
/learn                 视频学习
/training-paths        训练路径
/products              商品中心
/membership            会员中心
/content-packs         内容包
/camps                 训练营
/contests              模拟赛/竞赛
/reports/learning      学习报告
/ai                    AI 辅导
/discuss               社区讨论
/parent                家长端
/tenant                机构工作台
```

## 主要后台入口

```text
/admin                         后台首页
/admin/problems                题库管理
/admin/problem-sets            题单管理
/admin/store-products          商品管理
/admin/content                 内容后台
/admin/content/videos          视频资源
/admin/content/paths           路径编排
/admin/content/workflow        审核日志
/admin/analytics               学习分析
/admin/organizations           机构管理
/admin/teachers                教师管理
/admin/classes                 班级管理
```

## 文档范围说明

- 本文档基于当前仓库已实现页面与接口编写。
- 文档重点是“如何使用”和“如何联动现有功能”，不是数据库或源码设计文档。
- 若后续页面路径或按钮文案有调整，优先以实际页面为准。

---

[下一页：快速开始与角色说明](./01-quick-start.md)
