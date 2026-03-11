# Phase 1 README

## 范围

本阶段对应平台商业化 MVP，重点是打通“商品 -> 下单 -> 支付 -> 发权益 -> 解锁内容 -> 查看学习报告”的最小闭环。

## 主要能力

- 商品中心
- 订单与支付
- 会员体系
- 内容权限中心
- 高级题解 / 视频解析
- 专题训练路径
- 学习报告

## 主要前台入口

```text
/products
/membership
/content-packs
/checkout
/me/orders
/me/assets
/training-paths
/reports/learning
/problems/:id
```

## 主要后台入口

```text
/admin/store-products
/admin/problem-sets
/admin/problems
```

## 核心设计

- 复用现有用户、题目、提交、题解、题单模型
- 商品与支付统一复用 `Product / ProductSku / Order / Payment / Entitlement`
- 内容解锁统一走权限中心
- 学习报告基于现有提交和做题记录聚合

## 本次提交重点

- 商品和 SKU 体系落地
- mock 支付闭环与订单状态流转
- VIP 会员与自动生效
- 高级题解、视频解析、训练路径与学习报告接入统一权限服务

## 验证重点

- 支付回调幂等
- 权益发放幂等
- 会员续费顺延与到期失效
- 未解锁内容只返回摘要和锁态
