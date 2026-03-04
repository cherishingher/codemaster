# 洛谷公开样例批量转测试点

脚本位置：
- `/Users/cherisher/Desktop/ccf-master/codemaster/scripts/luogu-sample-testcases.mjs`

命令入口：
- `npm run luogu:samples-to-testcases --`

## 作用

扫描库中 `source=luogu:*` 的题目，把公开 `samples` 转成你平台可导入的测试点 ZIP。

默认安全策略：
- 只处理当前 **没有测试点** 的洛谷题
- 只生成 **公开样例**
- 默认 **跳过 HUSTOJ 同步**

这意味着它适合：
- 批量给刚从洛谷导入的题补 `sample testcase`
- 初始化题目的运行/展示样例

不适合：
- 替代正式 hidden testcase
- 覆盖你已经维护过的正式评测数据

## 常用命令

只生成 ZIP，不导入：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run luogu:samples-to-testcases -- --from P1001 --to P1100
```

直接导入本地平台：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run luogu:samples-to-testcases -- \
  --from P1001 --to P1100 \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```

只处理指定题号：

```bash
npm run luogu:samples-to-testcases -- \
  --pids P1001,P1002,P1003 \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```

强制覆盖已有测试点：

```bash
npm run luogu:samples-to-testcases -- \
  --from P1001 --to P1010 \
  --overwrite-existing \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```

强制重新从洛谷拉样例，不用数据库里已保存的 `samples`：

```bash
npm run luogu:samples-to-testcases -- \
  --pids P1001 \
  --refresh-remote \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```

## 输出

默认生成：
- 目录：`/Users/cherisher/Desktop/ccf-master/codemaster/tmp/luogu-sample-testcases`
- ZIP：`/Users/cherisher/Desktop/ccf-master/codemaster/tmp/luogu-sample-testcases.zip`
- 摘要：`/Users/cherisher/Desktop/ccf-master/codemaster/tmp/luogu-sample-testcases.summary.json`

目录名使用题目的 `slug`，因此和批量测试点导入接口可以直接对上。

单题目录示例：

```text
noip-2002/
  1.in
  1.out
  2.in
  2.out
  config.yml
```

`config.yml` 会自动把这些样例标记为：
- `isSample: true`
- `visible: true`
- `caseType: 0`

## 参数

- `--pids`
- `--from`
- `--to`
- `--limit`
- `--output-dir`
- `--zip-output`
- `--refresh-remote`
- `--delay-ms`
- `--timeout-ms`
- `--continue-on-error`
- `--overwrite-existing`
- `--base-url`
- `--import-url`
- `--cookie`
- `--skip-sync`
- `--sync-hustoj`

## 注意

1. 默认不会覆盖已有测试点，这是故意的保护。
2. 洛谷公开接口拿不到 hidden testcase，所以这个脚本只能补样例。
3. 如果你本地 HUSTOJ 没配好，保持默认 `--skip-sync` 即可。
