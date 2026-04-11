# CYaRon 数组求和示例

这个目录是 `codemaster` 外部 generator 接入的最小可运行示例。

目标题型：

- 输入：`n` 和长度为 `n` 的整数数组
- 输出：数组元素和
- 目标：演示如何根据题目约束、case seed 和 profile 生成边界数据

## 文件说明

- `std.cpp`：示例标准解
- `gen.py`：基于 CYaRon 的输入生成器
- `validator.py`：输入校验器
- `requirements.txt`：Python 依赖
- `testdata-generation-config.example.json`：可直接贴进后台版本配置的示例

## 安装

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster/problem-generators/examples/cyaron-array-sum
python3 -m pip install -r requirements.txt
```

## 本地快速试跑

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster/problem-generators/examples/cyaron-array-sum
python3 gen.py --mode alternating-extremes --seed demo > /tmp/cyaron-demo.in
python3 validator.py < /tmp/cyaron-demo.in
g++ -O2 -std=c++17 std.cpp -o /tmp/cyaron-demo-std
/tmp/cyaron-demo-std < /tmp/cyaron-demo.in
```

## 支持的 profile

- `min-single-zero`
- `min-single-negative`
- `all-zero`
- `all-max-positive`
- `all-max-negative`
- `alternating-extremes`
- `repeated-extreme`
- `near-overflow-32`
- `random-small`
- `random-large`
- `dense-duplicates`
- `max-n-random`

这些 profile 对应了常见边界：

- 最小规模
- 全零
- 全极值
- 正负极值交替
- 大量重复值
- 32 位整型溢出边界
- 最大 `n`

## 接到 codemaster

1. 在后台给目标题目上传标准解。
2. 打开该题版本的 `testdataGenerationConfig`。
3. 贴入 [testdata-generation-config.example.json](/Users/cherisher/Desktop/ccf-master/codemaster/problem-generators/examples/cyaron-array-sum/testdata-generation-config.example.json)。
4. 创建测试数据生成任务。

平台会自动把这些上下文传给 `gen.py`：

- `TESTDATA_CONTEXT_PATH`
- `TESTDATA_CASE_SEED`
- `TESTDATA_GROUP_KEY`
- `TESTDATA_ORDINAL`

`gen.py` 会优先读取：

- 题目信息：题面、约束、输入输出格式
- 标程信息：语言、源码
- 配置上下文：`context.profile / context.n_min / context.n_max / context.value_min / context.value_max`

## 和 GitHub 上项目的关系

- CYaRon 负责快速生成随机和边界输入
- `codemaster` 负责分组、seed、任务编排、标准解跑输出和测试点入库
- 如果你后面要接 `testlib`，更建议把它放在 validator/checker 层，而不是替代这套任务链路
