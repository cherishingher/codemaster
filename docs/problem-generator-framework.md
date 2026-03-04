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
