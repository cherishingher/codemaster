# 讨论模块设计与落地方案

> 说明  
> 1. 当前仓库实际运行栈是 `Next.js Route Handler + server/modules + Prisma + PostgreSQL`。  
> 2. 你本次要求里明确指定了 `MySQL + NestJS + Prisma + Redis + JWT`，因此本文的数据库 DDL 按 **MySQL 8.0 推荐版** 输出。  
> 3. 如果在当前仓库落地，建议保持业务模型不变，把 SQL 映射为 Prisma 模型，并使用 `relationMode = "prisma"`，避免高并发热表上的物理外键约束。  

## 第1部分：功能架构设计

### 推荐方案

推荐采用 **统一帖子主表 + 评论表 + 互动行为表 + 审核/风控表 + 冗余统计字段** 的方案，而不是把“题目讨论”“比赛讨论”“题解帖”“问答帖”拆成多张独立内容表。

理由：
- 讨论列表、搜索、审核、推荐、举报、点赞、收藏、排序，本质上都围绕“帖子”统一处理。
- 算法平台的差异主要在 `post_type + problem_id + contest_id + publish_at + solved/best_comment + 风控规则`，不是在存储形态。
- 统一内容模型最利于后续接入搜索、推荐、审核流、缓存、冷热分层和分表扩展。

### 1. 模块组成

| 模块 | 作用 | MVP |
|---|---|---|
| 帖子中心 | 发帖、编辑、删除、详情、列表 | 必做 |
| 评论中心 | 一级评论、楼中楼回复、最佳回复 | 必做 |
| 互动中心 | 点赞、收藏、举报 | 必做 |
| 审核中心 | 审核、屏蔽、锁帖、置顶、加精、推荐 | 必做 |
| 风控中心 | 新用户限流、广告检测、比赛期防剧透、敏感词 | 必做 |
| 统计中心 | 浏览量、热度分、计数冗余、榜单 | 必做 |
| 搜索标签中心 | 关键词、标签、题目/比赛关联筛选 | P1 |
| 订阅通知中心 | 关注帖子、回复提醒、最佳回复提醒 | P2 |

### 2. 内容分类

统一使用 `post_type` 表示：
- `problem_discussion` 题目讨论帖
- `solution` 题解帖
- `contest_discussion` 比赛讨论帖
- `question` 算法问答帖
- `experience` 学习经验分享帖
- `feedback` 站务反馈帖
- `announcement` 公告帖
- `general` 普通社区讨论帖

### 3. 发帖类型与绑定规则

| post_type | 是否必须绑定 problem_id | 是否必须绑定 contest_id | 说明 |
|---|---:|---:|---|
| `problem_discussion` | 是 | 否 | 题目页下发起，服务做题交流 |
| `solution` | 是 | 否 | 题解必须绑定题目，支持延迟公开 |
| `contest_discussion` | 否 | 是 | 比赛页下发起，赛后复盘优先 |
| `question` | 否 | 否 | 可选绑定题目或比赛 |
| `experience` | 否 | 否 | 经验沉淀 |
| `feedback` | 否 | 否 | 站务反馈 |
| `announcement` | 否 | 否 | 仅官方可发 |
| `general` | 否 | 否 | 普通社区话题 |

### 4. 哪些帖子必须绑定题目或比赛

必须强制绑定：
- `problem_discussion`
- `solution`
- `contest_discussion`

推荐允许可选绑定：
- `question`

不建议绑定：
- `experience`
- `feedback`
- `announcement`
- `general`

### 5. MVP 必做功能

- 发帖、编辑、软删除
- 评论、回复评论
- 点赞、收藏、举报
- 题目页讨论列表
- 比赛页讨论列表
- 审核状态与屏蔽状态
- 锁帖、置顶、加精、推荐
- 问答帖已解决/最佳回复
- 新用户限流与敏感词检测
- 比赛期间反剧透
- 题解帖延迟公开
- MySQL 搜索初版

### 6. 第二阶段建议功能

- 帖子关注与回复通知
- 评论@提醒
- 草稿箱
- 编辑历史
- 相似帖子推荐
- 举报工单台
- Elasticsearch 检索
- AI 风险初审与内容摘要
- 优质内容合集 / 题单式沉淀

## 第2部分：数据库设计

### 2.1 总体设计决策

- 主键推荐：`CHAR(26)`，应用侧生成 ULID，兼顾时间有序与分库分表扩展。
- 热表不强依赖数据库外键：帖子、评论、点赞、收藏、举报等表建议通过应用层保证一致性，方便后续拆库。
- 审核状态与展示状态分离：
  - `audit_status`：`pending/approved/rejected/manual_review`
  - `display_status`：`visible/hidden/shadow_hidden`
- 删除状态单独保留：`is_deleted + deleted_at + deleted_by`
- 评论仅支持两层：
  - 一级评论：`parent_comment_id IS NULL`
  - 楼中楼回复：`parent_comment_id != NULL` 且 `root_comment_id = 一级评论ID`
- 题解延迟公开统一使用 `publish_at`
- 最佳回复与已解决：
  - `discussion_post.best_comment_id`
  - `discussion_post.is_solved`
- 统计字段冗余到帖子/评论主表，异步更新

### 2.2 枚举码推荐

| 字段 | 推荐值 |
|---|---|
| `post_type` | `problem_discussion`, `solution`, `contest_discussion`, `question`, `experience`, `feedback`, `announcement`, `general` |
| `audit_status` | `pending`, `approved`, `rejected`, `manual_review` |
| `display_status` | `visible`, `hidden`, `shadow_hidden` |
| `publish_status` | `immediate`, `scheduled`, `delayed_by_contest` |
| `report_target_type` | `post`, `comment` |
| `report_status` | `pending`, `processing`, `accepted`, `rejected`, `closed` |
| `moderation_action_type` | `approve`, `reject`, `hide`, `unhide`, `lock`, `unlock`, `pin`, `unpin`, `feature`, `unfeature`, `recommend`, `unrecommend`, `delete`, `restore`, `mark_best_comment`, `mark_solved`, `unmark_solved` |

### 2.3 完整建表 SQL（MySQL 8.0 推荐版本）

```sql
CREATE TABLE discussion_post (
  id CHAR(26) NOT NULL COMMENT 'ULID，应用侧生成',
  author_id CHAR(26) NOT NULL COMMENT '发帖用户ID',
  post_type VARCHAR(32) NOT NULL COMMENT '帖子类型',
  title VARCHAR(160) NOT NULL COMMENT '标题',
  content_markdown MEDIUMTEXT NOT NULL COMMENT '原始Markdown/富文本源码',
  content_html MEDIUMTEXT NULL COMMENT '安全渲染后的HTML',
  content_plain TEXT NULL COMMENT '纯文本索引内容',
  excerpt VARCHAR(500) NULL COMMENT '摘要',
  problem_id CHAR(26) NULL COMMENT '关联题目ID',
  contest_id CHAR(26) NULL COMMENT '关联比赛ID',
  best_comment_id CHAR(26) NULL COMMENT '最佳回复ID',
  accepted_by_id CHAR(26) NULL COMMENT '设置最佳回复的用户ID',
  audit_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '审核状态',
  display_status VARCHAR(20) NOT NULL DEFAULT 'visible' COMMENT '展示状态',
  publish_status VARCHAR(24) NOT NULL DEFAULT 'immediate' COMMENT '公开策略',
  publish_at DATETIME NULL COMMENT '延迟公开时间',
  is_locked TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否锁帖',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否软删除',
  deleted_at DATETIME NULL COMMENT '删除时间',
  deleted_by CHAR(26) NULL COMMENT '删除操作人',
  is_pinned TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否置顶',
  pin_scope VARCHAR(20) NOT NULL DEFAULT 'none' COMMENT 'none/global/problem/contest/category',
  is_featured TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否加精',
  is_recommended TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否推荐',
  is_official TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否官方帖',
  is_solved TINYINT(1) NOT NULL DEFAULT 0 COMMENT '问答帖是否已解决',
  solved_at DATETIME NULL COMMENT '解决时间',
  risk_level TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '风险等级 0-5',
  risk_flags JSON NULL COMMENT '风控标签数组',
  comment_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '一级评论数',
  reply_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '楼中楼回复数',
  like_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '点赞数',
  favorite_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '收藏数',
  view_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '浏览量',
  report_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '举报数',
  hot_score DECIMAL(18,6) NOT NULL DEFAULT 0 COMMENT '热度分',
  last_comment_at DATETIME NULL COMMENT '最后评论时间',
  last_comment_user_id CHAR(26) NULL COMMENT '最后评论用户ID',
  metadata JSON NULL COMMENT '扩展字段，如引用题号、比赛轮次、题解来源等',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_post_author_created (author_id, created_at DESC),
  KEY idx_post_problem_created (problem_id, created_at DESC),
  KEY idx_post_contest_created (contest_id, created_at DESC),
  KEY idx_post_type_audit_display_created (post_type, audit_status, display_status, created_at DESC),
  KEY idx_post_publish (publish_status, publish_at),
  KEY idx_post_solved (post_type, is_solved, created_at DESC),
  KEY idx_post_featured (is_featured, is_recommended, created_at DESC),
  KEY idx_post_hot (display_status, audit_status, hot_score DESC),
  KEY idx_post_last_comment (last_comment_at DESC),
  FULLTEXT KEY ft_post_search (title, excerpt, content_plain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='讨论帖子表';

CREATE TABLE discussion_comment (
  id CHAR(26) NOT NULL COMMENT 'ULID，应用侧生成',
  post_id CHAR(26) NOT NULL COMMENT '所属帖子',
  author_id CHAR(26) NOT NULL COMMENT '评论作者',
  root_comment_id CHAR(26) NULL COMMENT '一级评论ID，一级评论为空，楼中楼回复指向一级评论',
  parent_comment_id CHAR(26) NULL COMMENT '直接父评论ID',
  reply_to_user_id CHAR(26) NULL COMMENT '被回复用户ID',
  content_markdown TEXT NOT NULL COMMENT '评论原文',
  content_html TEXT NULL COMMENT '渲染后的安全HTML',
  content_plain TEXT NULL COMMENT '纯文本检索内容',
  depth TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1一级评论 2楼中楼',
  floor_no INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '楼层号，仅一级评论有效',
  audit_status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '审核状态',
  display_status VARCHAR(20) NOT NULL DEFAULT 'visible' COMMENT '展示状态',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否软删除',
  deleted_at DATETIME NULL COMMENT '删除时间',
  deleted_by CHAR(26) NULL COMMENT '删除操作人',
  like_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '点赞数',
  reply_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '回复数，仅一级评论聚合',
  report_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '举报数',
  risk_level TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '风险等级',
  risk_flags JSON NULL COMMENT '风控标签',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comment_post_floor (post_id, root_comment_id, created_at ASC),
  KEY idx_comment_parent (parent_comment_id, created_at ASC),
  KEY idx_comment_author_created (author_id, created_at DESC),
  KEY idx_comment_audit_display (post_id, audit_status, display_status, created_at ASC),
  FULLTEXT KEY ft_comment_search (content_plain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='讨论评论表';

CREATE TABLE discussion_tag (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tag_name VARCHAR(32) NOT NULL COMMENT '标签名',
  tag_slug VARCHAR(64) NOT NULL COMMENT '机器可用slug',
  tag_type VARCHAR(20) NOT NULL DEFAULT 'topic' COMMENT 'topic/problem_source/algorithm/contest',
  status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active/disabled',
  post_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '帖子数',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tag_name (tag_name),
  UNIQUE KEY uk_tag_slug (tag_slug),
  KEY idx_tag_type_status (tag_type, status, post_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='讨论标签表';

CREATE TABLE discussion_post_tag (
  post_id CHAR(26) NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, tag_id),
  KEY idx_post_tag_tag (tag_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帖子标签关联表';

CREATE TABLE discussion_post_like (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id CHAR(26) NOT NULL,
  user_id CHAR(26) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_post_like_user (post_id, user_id),
  KEY idx_post_like_user_created (user_id, created_at DESC),
  KEY idx_post_like_post_created (post_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帖子点赞';

CREATE TABLE discussion_comment_like (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  comment_id CHAR(26) NOT NULL,
  user_id CHAR(26) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_comment_like_user (comment_id, user_id),
  KEY idx_comment_like_user_created (user_id, created_at DESC),
  KEY idx_comment_like_comment_created (comment_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='评论点赞';

CREATE TABLE discussion_post_favorite (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id CHAR(26) NOT NULL,
  user_id CHAR(26) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_post_favorite_user (post_id, user_id),
  KEY idx_post_favorite_user_created (user_id, created_at DESC),
  KEY idx_post_favorite_post_created (post_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='帖子收藏';

CREATE TABLE discussion_report (
  id CHAR(26) NOT NULL,
  reporter_id CHAR(26) NOT NULL COMMENT '举报人',
  target_type VARCHAR(16) NOT NULL COMMENT 'post/comment',
  target_id CHAR(26) NOT NULL COMMENT '目标内容ID',
  reason_type VARCHAR(32) NOT NULL COMMENT '广告/辱骂/剧透/抄袭/灌水等',
  reason_detail VARCHAR(500) NULL COMMENT '补充说明',
  evidence JSON NULL COMMENT '截图URL等',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/processing/accepted/rejected/closed',
  handled_by CHAR(26) NULL COMMENT '处理人',
  handled_at DATETIME NULL COMMENT '处理时间',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_report_target_status (target_type, target_id, status),
  KEY idx_report_reporter_created (reporter_id, created_at DESC),
  KEY idx_report_status_created (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='举报表';

CREATE TABLE discussion_audit_log (
  id CHAR(26) NOT NULL,
  target_type VARCHAR(16) NOT NULL COMMENT 'post/comment',
  target_id CHAR(26) NOT NULL COMMENT '目标内容ID',
  audit_status_from VARCHAR(20) NULL COMMENT '变更前审核状态',
  audit_status_to VARCHAR(20) NOT NULL COMMENT '变更后审核状态',
  operator_id CHAR(26) NOT NULL COMMENT '审核人',
  reason VARCHAR(500) NULL COMMENT '审核原因',
  extra JSON NULL COMMENT '命中规则、截图、上下文',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_target_created (target_type, target_id, created_at DESC),
  KEY idx_audit_operator_created (operator_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审核日志';

CREATE TABLE discussion_moderation_action (
  id CHAR(26) NOT NULL,
  target_type VARCHAR(16) NOT NULL COMMENT 'post/comment/user',
  target_id CHAR(26) NOT NULL COMMENT '目标ID',
  action_type VARCHAR(32) NOT NULL COMMENT '管理动作',
  action_scope VARCHAR(20) NOT NULL DEFAULT 'content' COMMENT 'content/user/global',
  operator_id CHAR(26) NOT NULL COMMENT '操作管理员',
  reason VARCHAR(500) NULL COMMENT '操作原因',
  expires_at DATETIME NULL COMMENT '临时禁言/屏蔽到期时间',
  extra JSON NULL COMMENT '扩展信息',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_moderation_target_created (target_type, target_id, created_at DESC),
  KEY idx_moderation_operator_created (operator_id, created_at DESC),
  KEY idx_moderation_action_created (action_type, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理动作审计';

CREATE TABLE discussion_sensitive_hit (
  id CHAR(26) NOT NULL,
  target_type VARCHAR(16) NOT NULL COMMENT 'post/comment',
  target_id CHAR(26) NOT NULL COMMENT '目标内容ID',
  engine_source VARCHAR(32) NOT NULL COMMENT 'keyword/regex/ml/manual',
  rule_code VARCHAR(64) NOT NULL COMMENT '命中规则编码',
  hit_text VARCHAR(255) NULL COMMENT '命中文本片段',
  weight INT NOT NULL DEFAULT 0 COMMENT '风险权重',
  action_suggest VARCHAR(20) NOT NULL DEFAULT 'review' COMMENT 'allow/review/reject',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sensitive_target_created (target_type, target_id, created_at DESC),
  KEY idx_sensitive_rule_created (rule_code, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='敏感内容命中记录';

CREATE TABLE discussion_user_risk_profile (
  user_id CHAR(26) NOT NULL,
  risk_score INT NOT NULL DEFAULT 0 COMMENT '风险分，越高越危险',
  credit_score INT NOT NULL DEFAULT 100 COMMENT '信用分，越高越可信',
  is_new_user TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否新用户',
  mute_until DATETIME NULL COMMENT '禁言到期时间',
  post_cooldown_until DATETIME NULL COMMENT '发帖冷却到期',
  last_risk_at DATETIME NULL COMMENT '最后一次风险更新时间',
  stats JSON NULL COMMENT '发帖次数/举报命中/违规历史等',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_risk_score (risk_score DESC),
  KEY idx_credit_score (credit_score DESC),
  KEY idx_mute_until (mute_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户风险画像';
```

### 2.4 关键索引设计说明

- `discussion_post.idx_post_type_audit_display_created`
  - 支持社区首页、分类页、题目讨论页、比赛讨论页的主列表查询。
- `discussion_post.idx_post_problem_created`
  - 支持题目页下讨论列表。
- `discussion_post.idx_post_contest_created`
  - 支持比赛页下讨论列表。
- `discussion_post.idx_post_hot`
  - 支持热门帖榜单。
- `discussion_comment.idx_comment_post_floor`
  - 支持一级评论 + 楼中楼批量加载。
- `discussion_report.idx_report_target_status`
  - 支持某帖子/评论举报聚合与处理台检索。
- `FULLTEXT ft_post_search`
  - 支持 MySQL 初期全文搜索。

### 2.5 冗余字段设计说明

建议保留冗余字段：
- 帖子：`comment_count`, `reply_count`, `like_count`, `favorite_count`, `view_count`, `report_count`, `last_comment_at`, `hot_score`
- 评论：`like_count`, `reply_count`, `report_count`

原因：
- 列表页不能每次实时聚合明细表。
- 排行、热度、题目页讨论数都依赖冗余字段。
- 互动行为写多读更多，异步修正比联表聚合更稳。

### 2.6 为什么这样设计

- 统一帖子模型足够表达题目讨论、比赛复盘、题解、问答。
- `publish_at` 能解决题解延迟公开和赛后解锁。
- `audit_status + display_status + is_deleted` 分层后，审核、屏蔽、删除互不混淆。
- 评论树只做两层，性能、前端渲染、审核都更稳。
- 热表无强 FK，后续分库更容易。

## 第3部分：接口设计（RESTful API）

### 3.1 统一响应格式

```json
{
  "code": "OK",
  "message": "success",
  "data": {},
  "requestId": "01HV...",
  "timestamp": "2026-03-20T10:00:00+08:00"
}
```

分页返回：

```json
{
  "code": "OK",
  "message": "success",
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 132,
    "hasMore": true
  }
}
```

### 3.2 错误码规范

| 错误码 | 含义 |
|---|---|
| `UNAUTHORIZED` | 未登录 |
| `FORBIDDEN` | 无权限 |
| `NOT_FOUND` | 内容不存在 |
| `INVALID_PARAMS` | 参数不合法 |
| `RATE_LIMITED` | 操作过于频繁 |
| `DUPLICATE_ACTION` | 重复提交 |
| `POST_LOCKED` | 帖子已锁定 |
| `POST_AUDIT_PENDING` | 帖子审核中 |
| `COMMENT_AUDIT_PENDING` | 评论审核中 |
| `CONTEST_SPOILER_FORBIDDEN` | 比赛期间禁止剧透 |
| `SOLUTION_DELAYED` | 题解未到公开时间 |
| `RISK_REJECTED` | 风控拒绝 |
| `BEST_COMMENT_INVALID` | 最佳回复不合法 |
| `POST_TYPE_BINDING_INVALID` | 帖子类型与绑定对象不匹配 |

### 3.3 分页参数规范

- `page`：默认 `1`
- `pageSize`：默认 `20`，最大 `50`
- 排序字段：`sort=newest|hot|featured|unsolved`
- 游标分页可用于热门流与大流量首页，管理台仍保留页码分页

### 3.4 API 清单

| # | Method | Path | 说明 | 权限 | 关键校验 |
|---|---|---|---|---|---|
| 1 | `POST` | `/api/discussions/posts` | 创建帖子 | 登录 | `post_type` 与 `problem_id/contest_id` 绑定关系合法 |
| 2 | `PATCH` | `/api/discussions/posts/:id` | 编辑帖子 | 作者/版主/管理员 | 锁帖后作者不可编辑 |
| 3 | `DELETE` | `/api/discussions/posts/:id` | 软删除帖子 | 作者/版主/管理员 | 作者仅能删自己的未锁帖 |
| 4 | `GET` | `/api/discussions/posts/:id` | 帖子详情 | 公开/管理员 | 延迟题解未到时间不可见 |
| 5 | `GET` | `/api/discussions/posts` | 通用帖子列表 | 游客可读 | 仅返回 `approved + visible + publish_at<=now` |
| 6 | `GET` | `/api/discussions/posts/hot` | 热门帖子 | 游客可读 | 按 `hot_score` |
| 7 | `GET` | `/api/discussions/posts/featured` | 精选帖子 | 游客可读 | `is_featured=1` |
| 8 | `GET` | `/api/problems/:problemId/discussions` | 题目下帖子列表 | 游客可读 | 仅限绑定当前题目 |
| 9 | `GET` | `/api/contests/:contestId/discussions` | 比赛下帖子列表 | 游客可读 | 比赛进行中仅返回允许公开内容 |
| 10 | `GET` | `/api/me/discussions/posts` | 我的帖子 | 登录 | 支持全部状态 |
| 11 | `POST` | `/api/discussions/posts/:id/comments` | 发表评论 | 登录 | 帖子未锁定 |
| 12 | `POST` | `/api/discussions/posts/:id/comments/:commentId/replies` | 回复评论 | 登录 | 只允许两层 |
| 13 | `PATCH` | `/api/discussions/comments/:id` | 编辑评论 | 作者/版主/管理员 | 删除后不可编辑 |
| 14 | `DELETE` | `/api/discussions/comments/:id` | 删除评论 | 作者/版主/管理员 | 软删除 |
| 15 | `GET` | `/api/discussions/posts/:id/comments` | 评论列表 | 游客可读 | 一级评论分页，回复批量带出 |
| 16 | `GET` | `/api/me/discussions/comments` | 我的评论 | 登录 | 自己全量可见 |
| 17 | `POST` | `/api/discussions/posts/:id/like` | 点赞帖子 | 登录 | 幂等 |
| 18 | `DELETE` | `/api/discussions/posts/:id/like` | 取消点赞帖子 | 登录 | 幂等 |
| 19 | `POST` | `/api/discussions/comments/:id/like` | 点赞评论 | 登录 | 幂等 |
| 20 | `DELETE` | `/api/discussions/comments/:id/like` | 取消点赞评论 | 登录 | 幂等 |
| 21 | `POST` | `/api/discussions/posts/:id/favorite` | 收藏帖子 | 登录 | 幂等 |
| 22 | `DELETE` | `/api/discussions/posts/:id/favorite` | 取消收藏 | 登录 | 幂等 |
| 23 | `POST` | `/api/discussions/reports` | 举报帖子或评论 | 登录 | 不可举报自己 |
| 24 | `POST` | `/api/admin/discussions/posts/:id/audit` | 审核帖子 | 版主/管理员 | 可通过/拒绝/转人工 |
| 25 | `POST` | `/api/admin/discussions/comments/:id/audit` | 审核评论 | 版主/管理员 | 同上 |
| 26 | `POST` | `/api/admin/discussions/posts/:id/hide` | 屏蔽帖子 | 版主/管理员 | 写管理日志 |
| 27 | `POST` | `/api/admin/discussions/posts/:id/delete` | 管理删除帖子 | 版主/管理员 | 与作者删除区分 |
| 28 | `POST` | `/api/admin/discussions/posts/:id/pin` | 置顶/取消置顶 | 版主/管理员 | 作用域校验 |
| 29 | `POST` | `/api/admin/discussions/posts/:id/feature` | 加精/取消加精 | 版主/管理员 | 仅已审核通过 |
| 30 | `POST` | `/api/admin/discussions/posts/:id/recommend` | 推荐/取消推荐 | 版主/管理员 | 仅高质量帖 |
| 31 | `POST` | `/api/admin/discussions/posts/:id/lock` | 锁帖/解锁 | 版主/管理员 | 锁帖后仅管理员可评论 |
| 32 | `POST` | `/api/discussions/posts/:id/best-comment` | 设置最佳回复 | 作者/版主/管理员 | 仅 `question`，评论必须属于本帖 |
| 33 | `POST` | `/api/discussions/posts/:id/solve` | 标记已解决/未解决 | 作者/版主/管理员 | 仅 `question` |
| 34 | `GET` | `/api/discussions/search` | 按关键词搜索帖子 | 游客可读 | 走 FULLTEXT + 结构化过滤 |

### 3.5 请求与响应要点

#### 创建帖子

`POST /api/discussions/posts`

请求体：

```json
{
  "postType": "solution",
  "title": "P1001 题解：前缀和做法",
  "contentMarkdown": "### 思路...",
  "problemId": "01H...",
  "contestId": null,
  "tagIds": [1, 2, 3]
}
```

成功响应：

```json
{
  "code": "OK",
  "message": "created",
  "data": {
    "id": "01J...",
    "auditStatus": "pending",
    "displayStatus": "visible",
    "publishAt": "2026-03-22T20:00:00+08:00"
  }
}
```

业务校验：
- `solution` 必须绑定 `problemId`
- 比赛进行中，若帖子关联到进行中的比赛或比赛题目：
  - `solution`：直接拒绝或强制延迟公开
  - `problem_discussion`：普通用户进入待审核/延迟公开
  - `contest_discussion`：仅允许官方公告或赛后讨论
- 新用户前 3 帖强制待审核

#### 设置最佳回复

`POST /api/discussions/posts/:id/best-comment`

请求体：

```json
{
  "commentId": "01J..."
}
```

业务校验：
- 帖子类型必须是 `question`
- 评论必须属于该帖子
- 帖子必须未删除
- 锁帖也允许设置最佳回复

#### 搜索接口

`GET /api/discussions/search?q=dp&postType=solution&problemId=...&tagId=1&page=1&pageSize=20`

返回：
- 搜索命中帖子
- 题目/比赛过滤
- 标签过滤
- 排序：默认相关度 + 新鲜度

### 3.6 防重复提交方案

- 发帖、评论、举报、点赞、收藏接口支持 `Idempotency-Key`
- Redis 记录 `user_id + path + idempotency_key`，TTL 5 分钟
- 无 `Idempotency-Key` 时，发帖/评论可用内容摘要 + 时间窗兜底去重

### 3.7 防刷方案

- Redis 限流：
  - 发帖：普通用户 `5/10min`，新用户 `2/30min`
  - 评论：普通用户 `20/10min`，新用户 `5/10min`
  - 举报：`10/1h`
  - 点赞/收藏：`60/min`
- 对同 IP、同设备、同账号簇做附加限流
- 同一内容短时间重复发送直接拦截

### 3.8 安全建议

- XSS：只存 `content_markdown` 原文，服务端渲染白名单 HTML
- SQL 注入：全部使用 Prisma 参数化
- 富文本安全：禁止内联脚本、事件属性、危险协议
- 代码块：保留 fenced code block
- 数学公式：白名单 KaTeX/LaTeX 语法

## 第4部分：权限系统设计

### 4.1 角色设计

| 角色 | 说明 |
|---|---|
| 游客 | 只读公开内容 |
| 新用户 | 注册时间短、题目完成少、无信誉积累 |
| 普通用户 | 满足基础活跃条件 |
| 高信誉用户 | 历史内容质量高、举报命中低 |
| 版主 | 社区秩序维护 |
| 超级管理员 | 全量管理 |

### 4.2 权限点清单

- `discussion.post.create`
- `discussion.post.edit.self`
- `discussion.post.delete.self`
- `discussion.post.solution.create`
- `discussion.comment.create`
- `discussion.comment.delete.self`
- `discussion.report.create`
- `discussion.best_comment.set`
- `discussion.solve.mark`
- `discussion.audit.post`
- `discussion.audit.comment`
- `discussion.moderate.hide`
- `discussion.moderate.lock`
- `discussion.moderate.pin`
- `discussion.moderate.feature`
- `discussion.moderate.recommend`
- `discussion.user.mute`

### 4.3 角色权限建议

| 能力 | 游客 | 新用户 | 普通用户 | 高信誉用户 | 版主 | 超管 |
|---|---:|---:|---:|---:|---:|---:|
| 读公开帖 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 发普通帖 | ✗ | 受限 | ✓ | ✓ | ✓ | ✓ |
| 发题解帖 | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| 评论 | ✗ | 受限 | ✓ | ✓ | ✓ | ✓ |
| 举报 | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 删除自己内容 | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 审核 | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| 置顶/加精/推荐 | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| 禁言/限流 | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

### 4.4 新用户限制策略

推荐判定：
- 注册 < 3 天，或
- 通过题数 < 5，或
- 信用分 < 80

限制：
- 前 3 帖、前 10 条评论默认待审核
- 禁止外链、二维码、联系方式
- 禁止发题解帖
- 单位时间发帖/评论更严

### 4.5 高频操作限流建议

- 点赞/收藏：滑动窗口
- 发帖/评论：令牌桶
- 管理动作：写审计日志 + 双确认

### 4.6 数据表设计建议

权限可复用平台已有 RBAC；讨论模块只需补：
- `discussion_user_risk_profile`
- `user_role`
- `role_permission`

## 第5部分：审核与风控设计

### 5.1 违规内容类型

- 广告引流
- 侮辱辱骂
- 剧透/泄题
- 抄袭搬运
- 灌水无意义内容
- 恶意刷屏
- 敏感政治/违法内容

### 5.2 比赛期间反剧透机制

推荐规则：
- 若帖子或评论绑定 `contest_id`，且比赛状态为 `running`：
  - `solution`：直接拒绝
  - `problem_discussion`：普通用户进入 `manual_review + delayed publish`
  - `contest_discussion`：仅允许官方公告、赛务说明
- 若题目属于正在进行的比赛，也按同样规则处理
- 评论中命中“AC代码”“完整做法”“关键结论”等规则时直接拦截

### 5.3 题解帖延迟公开机制

- `solution` 帖默认支持：
  - 立即公开
  - 定时公开
  - 比赛结束后公开
- 存储到 `publish_status + publish_at`
- 列表查询统一过滤 `publish_at <= now()`

### 5.4 新用户反广告机制

发帖前检查：
- 是否带外链
- 是否包含联系方式
- 是否命中广告词
- 是否短时间重复
- 是否高频跨题发帖

处理策略：
- 高危直接拒绝
- 中危进入待审核
- 低危先发后审

### 5.5 敏感词检测

- 精确词库
- 正则词库
- URL/二维码/联系方式提取
- 比赛剧透规则库
- 重复文本相似度

### 5.6 机器审核 + 人工审核流程

1. 发帖前同步检查：基础风控、比赛状态、权限、限流
2. 发帖后异步检查：敏感词、ML 分类、相似度
3. 根据风险分决定：
   - 低风险：`approved`
   - 中风险：`manual_review`
   - 高风险：直接 `rejected`

### 5.7 举报处理流程

1. 用户提交举报
2. 聚合同目标举报数
3. 达阈值自动进入复审队列
4. 版主处理并写 `discussion_moderation_action`
5. 回写举报状态

### 5.8 用户信用分 / 风险分

- 初始 `credit_score = 100`
- 被采纳最佳回复、优质帖加精、举报成功可加分
- 广告、辱骂、剧透、重复违规扣分
- 信用分低于阈值转为“高风险用户”

### 5.9 管理员操作日志

所有以下动作必须记录：
- 审核通过/拒绝
- 屏蔽/解除屏蔽
- 锁帖/解锁
- 置顶/撤销置顶
- 加精/取消加精
- 推荐/取消推荐
- 删除/恢复
- 禁言/解除禁言

### 5.10 误杀与申诉机制

- 被拒绝内容保留 `reason + hit_rule`
- 作者可在一定时间内申诉
- 管理后台提供“误杀恢复”

## 第6部分：排序与推荐设计

### 6.1 排序方式

- 最新：`created_at DESC`
- 热门：`hot_score DESC`
- 未解决：`is_solved = 0 AND post_type = question`
- 精选：`is_featured = 1`
- 题目讨论页：默认最新，备选热门
- 比赛讨论页：赛后默认热门 + 精选，赛中默认官方公告优先

### 6.2 热度公式（简单版）

```text
hot_score =
  ln(1 + like_count * 2 + favorite_count * 2 + comment_count * 3 + reply_count * 1.5 + view_count * 0.08)
  + featured_bonus
  + solved_bonus
  - report_penalty
  - age_hours / 36
```

其中：
- `featured_bonus = 2`
- `solved_bonus = 1`（优质问答沉淀）
- `report_penalty = min(report_count * 0.5, 5)`

### 6.3 防刷赞刷回复

- 账号、IP、设备三重画像
- 短时高频点赞仅计一次或延迟入分
- 被判定风险用户的互动不立即纳入 `hot_score`

### 6.4 新帖曝光与沉淀平衡

- 首页推荐流混排：`70% 热门 + 30% 新帖探索`
- 问答区对 `未解决` 新帖给予短期提升
- 精华帖长期固定在精选流，不与热门流完全竞争

## 第7部分：搜索与标签设计

### 7.1 标签体系

推荐三层：
- 算法标签：`dp`, `graph`, `greedy`
- 场景标签：`题解`, `问答`, `比赛复盘`
- 关系标签：题源、比赛级别、训练主题

### 7.2 搜索字段

- `title`
- `excerpt`
- `content_plain`
- `tag_name`
- `problem_id`
- `contest_id`
- `author_id`

### 7.3 MySQL 搜索方案

- `FULLTEXT(title, excerpt, content_plain)`
- 结合结构化过滤：
  - `post_type`
  - `tag_id`
  - `problem_id`
  - `contest_id`
  - `author_id`

### 7.4 Elasticsearch 升级方案

- 通过 Outbox/消息队列同步帖子变更到 ES
- 建索引字段：
  - 内容字段
  - 标签
  - 题目/比赛关联
  - 审核与展示状态
  - 热度分

### 7.5 热门标签和相关标签推荐

- 基于 `discussion_post_tag` 做近 7 天、近 30 天统计
- 相关标签用共现矩阵

### 7.6 标签防滥用机制

- 每帖最多 5 个标签
- 用户不能自由创建公开标签，初期仅管理员维护
- 相似标签合并后台

## 第8部分：后端代码骨架设计

### 8.1 当前仓库推荐目录结构

```text
apps/web/src/server/modules/discussion-center/
  controller.ts
  post.service.ts
  comment.service.ts
  moderation.service.ts
  risk.service.ts
  schemas.ts
  shared.ts
```

### 8.2 你要求的 NestJS 代码骨架

示例文件已放到：

```text
docs/examples/discussion-nest/
```

包含：
- `discussion.module.ts`
- `discussion.controller.ts`
- `discussion.service.ts`
- `dto/create-post.dto.ts`
- `dto/update-post.dto.ts`
- `dto/create-comment.dto.ts`
- `dto/query-post-list.dto.ts`
- `prisma-discussion-models.prisma`

### 8.3 Repository / Prisma 建议

- Service 内不要直接堆复杂 Prisma 逻辑，按 `post/comment/moderation/risk` 拆分。
- 列表查询统一封装 `buildPostListWhere`。
- 计数异步更新：
  - 写入点赞/评论后先写行为表
  - 再投递 Redis Stream / BullMQ 任务更新冗余计数

### 8.4 Redis 缓存建议

- 热门帖子列表缓存 30~60 秒
- 题目页讨论列表缓存 30 秒
- 详情页浏览量用 Redis 计数，定时落库
- 幂等键、限流键、风控临时状态全部放 Redis

### 8.5 单元测试建议

- 帖子类型与绑定对象校验
- 两层评论深度校验
- 比赛期间反剧透校验
- 题解延迟公开校验
- 最佳回复与已解决逻辑
- 点赞/收藏幂等

## 第9部分：前端页面与交互建议

### 1. 讨论首页
- Tab：最新 / 热门 / 精选 / 问答
- 首屏可展示官方公告与精选题解

### 2. 分类页
- 按帖子类型分类
- 支持标签、题目、比赛筛选

### 3. 帖子详情页
- 标题区显示：类型、题目/比赛关联、标签、作者、审核标签
- 内容区支持代码块、公式、题号引用、比赛引用
- 右侧可显示相关题目/相关讨论

### 4. 发帖页
- 发帖类型先选
- 根据类型动态要求 problem/contest 绑定
- 题解帖展示“公开时间”配置

### 5. 题目页下讨论区
- 默认只显示 `problem_discussion + solution + question`
- 支持“只看题解/只看问答”

### 6. 比赛页下讨论区
- 赛中默认只展示官方公告和澄清
- 赛后切换为复盘讨论流

### 7. 我的帖子 / 我的评论 / 我的收藏
- 分 tab 展示
- 支持查看审核状态与被拒原因

### 8. 管理员审核后台
- 审核队列
- 举报队列
- 风险命中详情
- 操作日志

## 第10部分：开发优先级与任务拆分

### MVP

- 帖子主表、评论表、互动表、审核表
- 发帖/评论/点赞/收藏/举报
- 题目页讨论列表
- 比赛页讨论列表
- 管理员审核
- 问答已解决/最佳回复
- 基础风控和比赛期防剧透

### P1

- 搜索与标签
- 热门排序与精选流
- 我的帖子/评论/收藏
- 管理后台队列

### P2

- 关注帖子
- 通知提醒
- 编辑历史
- 标签运营

### P3

- Elasticsearch
- AI 审核
- 内容合集/知识库沉淀

### 前端任务

- 首页、列表页、详情页、发帖页
- 题目页讨论区组件
- 比赛页讨论区组件
- 管理审核后台

### 后端任务

- Post / Comment / Interaction / Moderation / Risk Service
- 统一权限守卫
- 搜索接口
- 冗余计数异步任务

### 数据库任务

- 建表
- 索引
- 审计日志表
- 风险画像表

### 风控与审核任务

- 敏感词词库
- 比赛状态联动校验
- 新用户限流
- 举报处理台

### 测试要点

- 比赛期间规则
- 题解延迟公开
- 楼中楼深度
- 幂等与限流
- 审核和屏蔽状态一致性

### 容易踩坑的地方

- 把审核状态和删除状态混成一个字段
- 评论树无限嵌套
- 题解延迟公开只在前端做限制
- 热门排序实时联表聚合导致性能抖动
- 比赛期间只过滤帖子，不过滤评论
