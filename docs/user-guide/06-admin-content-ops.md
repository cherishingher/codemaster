# 06. 管理后台与内容生产

## 目录

- 后台首页
- 题库与题单管理
- 商品与商业化配置
- 内容生产后台
- 学习分析与运营数据

## 后台首页

入口：

```text
/admin
```

后台首页提供统一入口，便于快速进入：

- 题库管理
- 题单管理
- 商品管理
- 内容后台
- 机构后台
- 教师后台
- 班级后台
- 导入导出
- 运营统计
- 学习分析

## 题库与题单管理

入口：

```text
/admin/problems
/admin/problems/:id
/admin/problem-sets
/admin/import-export
/admin/submit-test
```

支持功能：

- 创建题目
- 编辑题面
- 维护题目版本
- 导入测试点
- 管理题解
- 管理题单
- 导入导出题库数据

## 商品与商业化配置

入口：

```text
/admin/store-products
```

支持管理：

- 商品基本信息
- SKU、价格、原价
- 商品类型
- 权益说明
- 内容绑定元信息
- 上下架状态

适用商品类型：

- 会员商品
- 内容包
- 训练营报名商品
- 模拟赛报名商品

## 内容生产后台

入口：

```text
/admin/content
/admin/content/solutions
/admin/content/solutions/:id
/admin/content/videos
/admin/content/paths
/admin/content/paths/:id
/admin/content/workflow
```

当前支持：

- 题解模板化编辑
- 视频资源录入
- 路径批量编排
- 内容状态流转
- 审核日志查看

内容状态：

- `draft`
- `review`
- `published`

使用建议：

1. 先在内容后台维护题解、视频、路径
2. 进入审核流
3. 发布后由前台读取
4. 再通过商品配置与权限中心完成解锁

## 学习分析与运营数据

入口：

```text
/admin/stats
/admin/analytics
```

可查看：

- 平台学习趋势
- 标签热度
- 路径使用情况
- 训练营与模拟赛参与表现
- 风险分布与建议

适用场景：

- 运营复盘
- 教研优化内容供给
- 商品和训练营设计参考

---

[上一页：社区互动、积分奖励与家长端](./05-community-parent-growth.md) | [下一页：学校/机构工作台与开放 API](./07-tenant-school-and-open-api.md)
