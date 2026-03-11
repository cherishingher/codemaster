# Phase 2 README

## 范围

本阶段对应高客单价产品与教学运营能力，目标是在一期底座上扩出训练营、模拟赛、家长增强和内容生产后台。

## 主要能力

- 训练营系统
- 模拟赛收费体系
- 家长端增强
- 内容生产后台
- 教师 / 机构预备能力

## 主要前台入口

```text
/camps
/camp-class/:id
/contests
/parent
```

## 主要后台入口

```text
/admin/content
/admin/content/videos
/admin/content/paths
/admin/content/workflow
/admin/organizations
/admin/teachers
/admin/classes
```

## 核心设计

- 训练营与模拟赛继续复用一期商品和订单体系
- 家长端继续复用学习报告、训练营、模拟赛聚合数据
- 内容后台不重做内容表，只给 `Solution / Lesson / ProblemSet` 增加工作流
- 教师 / 机构只做数据底座和最小管理后台，不做完整 SaaS

## 本次提交重点

- 训练营报名、名额、任务、打卡、排行榜、结营报告
- 模拟赛报名、成绩、赛后解析、赛后报告
- 家长绑定、家长增强报告、推荐商品
- 内容状态流转与审核日志
- 机构、教师、班级、学生导入、题单布置、班级统计

## 验证重点

- 训练营名额占用与释放
- 模拟赛报名与赛后内容解锁
- 家长绑定越权保护
- 内容 `draft / review / published` 前后台一致性
- 班级统计与真实学习数据一致
