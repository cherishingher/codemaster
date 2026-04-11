# 测评数据自动生成器框架

## 目录约定

每道题一个生成器目录，例如：

```text
/Users/cherisher/Desktop/ccf-master/codemaster/problem-generators/
  luogu/
    P1001/
      spec.json
      std.mjs
      brute.mjs
      gen.mjs
```

字段说明：
- `spec.json`：题目匹配信息、分组、分值、校验规则
- `std.mjs`：标准解，导出 `solve(input)`
- `brute.mjs`：暴力解，导出 `solve(input)`
- `gen.mjs`：输入生成器，导出 `generate(context)`

## 批量生成模板

按题号区间批量生成 Luogu 题目的草稿模板：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run generator:scaffold -- --from P1002 --to P1010
```

按指定题号生成：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run generator:scaffold -- --pids P1002,P1003,P1004
```

覆盖已有模板：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run generator:scaffold -- --pids P1002 --force
```

说明：
- 生成的模板默认会写 `draft: true`
- `generator:verify --all` 和 `generator:generate --all` 默认跳过这些草稿目录
- 当你补完 `std.mjs / brute.mjs / gen.mjs` 后，把 `spec.json` 里的 `draft` 改成 `false`

## CYaRon 脚手架

如果你要给某道新题起一个完整的外部 generator 目录，可以直接跑：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run generator:scaffold:cyaron -- --slug my-problem --title "My Problem"
```

默认会生成到：

```text
/Users/cherisher/Desktop/ccf-master/codemaster/problem-generators/custom/my-problem
```

会包含这些文件：

- `gen.py`
- `validator.py`
- `std.cpp`
- `requirements.txt`
- `problem.json`
- `testdata-generation-config.example.json`
- `README.md`

## 验证命令

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run generator:verify -- --all
```

## 生成命令

只生成目录和 ZIP：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run generator:generate -- --all
```

生成并导入本地题库：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run generator:generate -- --all \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```

只跑某一题：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run generator:verify -- --dirs ./problem-generators/luogu/P1001
npm run generator:generate -- --dirs ./problem-generators/luogu/P1001 \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```

## 设计原则

1. AI 生成的标准解不能直接信任。
2. 必须先做 `std` 与 `brute` 的差分验证。
3. `sample`、`hidden`、`stress` 分组独立生成。
4. 最终输出直接复用当前题库的批量测试点 ZIP 导入格式。
5. 默认跳过 HUSTOJ 同步，先保证本地题库测试点正确。

## 当前已验证示例

- 题目：`luogu:P1001`
- 目录：`/Users/cherisher/Desktop/ccf-master/codemaster/problem-generators/luogu/P1001`
- 验证结果：`51` 个检查通过
- 生成结果：`26` 个测试点
- 导入方式：直接调用 `/api/admin/testcases/import-zip`

## 外部生成器接入

除了仓库内置的 `array / string / queries` 这类 generator，版本级 `testdataGenerationConfig`
现在也支持外部 driver。适合把 GitHub 上常见的竞赛出题工具接进来：

- `testlib`：最适合做 `validator / checker / generator`
- `TCFrame`：适合整题工程化生成，需要你写一个按单 case 输出输入数据的包装命令
- `CYaRon`：适合 Python 快速造随机和边界数据

### 设计原则

1. 平台负责调度：分组、种子、测试点入库、标准解产出 `.out`
2. 外部脚本负责输入生成：根据题面、约束、标准代码和 case seed 产出 `.in`
3. 外部 validator 可选：每个生成 case 可以先过 validator，再进入标准解执行

### 配置结构

`generator.type = "external"` 时，支持以下字段：

```json
{
  "version": 1,
  "groups": [
    {
      "key": "edge-small",
      "count": 4,
      "score": 10,
      "visible": false,
      "generator": {
        "type": "external",
        "params": {
          "driver": "cyaron",
          "cwd": "problem-generators/custom/p1000",
          "command": ["python3", "gen.py", "--mode", "{{groupKey}}", "--seed", "{{caseSeed}}"],
          "outputMode": "text",
          "context": {
            "profile": "small-edge"
          },
          "validator": {
            "command": ["python3", "validator.py"],
            "timeoutMs": 5000
          }
        }
      }
    }
  ]
}
```

### 运行时上下文

平台会把完整上下文写到临时 JSON 文件，并通过环境变量传给外部命令：

- `TESTDATA_CONTEXT_PATH`
- `TESTDATA_REPO_ROOT`
- `TESTDATA_CASE_SEED`
- `TESTDATA_GROUP_KEY`
- `TESTDATA_ORDINAL`

`TESTDATA_CONTEXT_PATH` 对应的 JSON 包含：

- `plan`：当前测试点的分组、序号、seed、score、visible 等信息
- `problem`：题目标题、题面、约束、输入输出格式、时空限制、标签
- `standardSolution`：标程语言和源码
- `context`：你在配置里手工写入的扩展参数

### 模板占位符

`command / env / stdinTemplate` 支持 `{{...}}` 占位符，例如：

- `{{caseSeed}}`
- `{{groupKey}}`
- `{{ordinal}}`
- `{{problem.title}}`
- `{{problem.constraints}}`
- `{{standardSolution.language}}`
- `{{external.profile}}`
- `{{generatedInput}}`（仅 validator 阶段可用）

### 输出约定

- `outputMode = "text"`：外部命令 stdout 直接作为 `.in`
- `outputMode = "json"`：stdout 需要输出 JSON，默认读取 `input` 和 `metadata` 字段

示例：

```json
{
  "input": "5\n1 2 3 4 5\n",
  "metadata": {
    "strategy": "anti-greedy",
    "edgeCase": "max-duplicates"
  }
}
```

### 接入建议

- `testlib`：优先接 validator，generator 通过命令行参数读取 `caseSeed / profile`
- `TCFrame`：写一个 wrapper，把单次生成结果打印到 stdout，再让平台负责跑标程
- `CYaRon`：直接在 `gen.py` 中读取 `TESTDATA_CONTEXT_PATH`，基于题面和标程生成边界数据
