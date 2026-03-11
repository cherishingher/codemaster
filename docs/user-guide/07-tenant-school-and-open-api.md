# 07. 学校/机构工作台与开放 API

## 目录

- 机构工作台
- 组织与班级管理
- 成员导入
- 作业与成绩管理
- 班级统计
- 开放 API 对接

## 机构工作台

入口：

```text
/tenant
/tenant/organizations/:id
/tenant/organizations/:id/classes/:classId
/tenant/organizations/:id/classes/:classId/stats
/tenant/organizations/:id/classes/:classId/assignments/:assignmentId
```

定位说明：

- 当前是学校/机构版的基础层
- 采用逻辑租户隔离
- 适合机构管理员和教师使用
- 不等同于完整学校版 SaaS

## 组织与班级管理

后台入口：

```text
/admin/organizations
/admin/organizations/:id
/admin/teachers
/admin/classes
/admin/classes/:id
```

当前支持：

- 创建学校/机构
- 维护组织基本信息
- 创建班级
- 绑定教师
- 建立学生成员关系

说明：

- 平台管理员负责创建组织
- 机构管理员和教师通过租户工作台进入自己可访问的组织

## 成员导入

支持方式：

- 按现有用户 ID、邮箱、手机号匹配
- 若平台中不存在该学生账号，可自动创建占位学生账号
- 同步建立班级成员关系

适用场景：

- 新班开班导入
- 批量补录学生
- 机构从外部系统同步学生名单

## 作业与成绩管理

当前作业模型复用题单：

- 班级为单位布置题单
- 学生围绕题单完成练习
- 系统自动聚合做题数据
- 教师可以同步成绩并补录人工分与评语

相关页面：

```text
/tenant/organizations/:id/classes/:classId
/tenant/organizations/:id/classes/:classId/assignments/:assignmentId
```

支持操作：

- 班级查看已布置题单
- 同步题单完成情况
- 查看学生成绩簿
- 录入人工成绩和评语

## 班级统计

统计内容包括：

- 班级学生数
- 已布置题单数
- 已分配题目数
- 活跃学生数
- 总提交数
- 通过人数与完成度
- 每个学生的进度表现

适用场景：

- 教师班级巡检
- 机构管理员教学复盘

## 开放 API 对接

开放 API 适用于与学校/机构现有系统对接。

鉴权方式：

- 使用机构 API Key
- 通过请求头传递 `x-org-api-key`

常见接口方向：

- 创建班级
- 创建教师
- 创建学生
- 查询班级统计
- 创建班级作业
- 查询作业成绩
- 更新学生成绩

对接建议：

1. 先在后台生成机构和 API Key
2. 用测试环境验证班级、成员、成绩写入
3. 再接正式对接流程

## 三期可继续扩展的方向

当前明确没有做：

- 复杂多租户权限矩阵
- 财务与机构结算
- 独立学校版控制台
- 复杂审批流与通知流

三期可在当前基础上继续扩：

- 更完整的教师端
- 学校/机构版商业化
- 多角色教务协同
- 数据导出与更完整成绩报表

---

[上一页：管理后台与内容生产](./06-admin-content-ops.md) | [返回总目录](./README.md)
