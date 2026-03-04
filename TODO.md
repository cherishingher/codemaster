# TODO

## Now
- [x] 复制 `.env.example` 为 `.env` 并补齐配置（DB/Redis/对象存储）
- [x] 安装依赖：`npm install @alicloud/pop-core --workspace apps/web`
- [ ] 配置阿里云验证码环境变量（短信/邮件/密钥/Region）
- [x] 阿里云验证码接入文档 `docs/aliyun-auth-setup.md`
- [ ] 执行阿里云验证码“最短执行清单”（见 `docs/aliyun-auth-setup.md`）
- [ ] 启动基础服务（Postgres/Redis）：`docker compose up -d`
- [ ] 执行数据库迁移：`npm run db:migrate`
- [x] 基础登录/会话（注册、登录、登出、当前用户）
- [x] RBAC 权限中间件与路由保护（withAuth + roles）
- [x] 题库管理基础接口（创建题目/版本/测试点 + 公共列表/详情）
- [x] 论坛/评论审核流（发帖/评论 + 管理端审核 + 审核日志）
- [x] 判题链路可跑（C++17 编译/运行 + 判题回写；未做沙箱隔离）

## Next
- [ ] 判题沙箱隔离（Docker/Firecracker + 资源限制）
- [ ] 比赛功能：报名、榜单、封榜、成绩归档
- [ ] 课程体系：课程/章节/课时、播放授权
- [ ] 支付与权益：订单、支付回调、权限校验
- [ ] 搜索：题库/课程检索（可选 Meili/ES）

## Later
- [ ] 监考体系：摄像头/屏幕采集、告警、回放
- [ ] 内容推荐与学习路径
- [ ] 多地域部署与容灾
- [ ] 统计与运营看板
