# 自动测试数据生成开发 Checklist

## MVP 阶段

### 1. 数据模型
- [x] 新增 `StandardSolution`
- [x] 新增 `TestdataGenerationTask`
- [x] 新增 `TestdataCase`
- [x] 新增 `TestdataGenerationLog`
- [x] 新增 `FileAsset`
- [x] 扩展 `ProblemVersion.testdataGenerationConfig`
- [x] 扩展 `Testcase.sourceType`
- [x] 扩展 `Testcase.generationTaskId`
- [x] 扩展 `Testcase.generationOrdinal`

### 2. Generator 核心
- [x] 定义统一 generator 接口
- [x] 支持固定 seed 复现
- [x] 支持 `array`
- [x] 支持 `string`
- [x] 支持 `intervals`
- [x] 支持 `queries`
- [x] 支持配置校验和 case 规划

### 3. 管理后台 API
- [x] 上传标程
- [x] 查询标程列表
- [x] 读取生成配置
- [x] 保存生成配置
- [x] 创建生成任务
- [x] 查询任务详情
- [x] 查询任务日志
- [x] 查询生成 case
- [x] 重试失败任务

### 4. Worker 主链路
- [x] 新增 `testgen:jobs` 队列
- [x] `judge-agent` 支持 testdata job
- [x] 读取预生成输入
- [x] 编译标程
- [x] 运行标程生成输出
- [x] 写入 `TestdataCase`
- [x] 发布到正式 `Testcase`

## 后续增强

### 5. 运行隔离
- [ ] Docker runner
- [ ] `--network none`
- [ ] `--read-only`
- [ ] `--pids-limit`
- [ ] `--memory` / `--cpus`
- [ ] 残留容器清理

### 6. 管理后台 UI
- [ ] 题目后台集成测试数据生成面板
- [ ] JSON 配置编辑器
- [ ] 任务状态轮询
- [ ] 日志查看器

### 7. 打包下载
- [ ] 生成 `manifest.json`
- [ ] 导出 ZIP 包

### 8. 题目分析层
- [ ] 规则引擎
- [ ] generator 推荐
- [ ] 结构化草稿输出
