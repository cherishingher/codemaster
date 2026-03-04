# 洛谷题目抓取脚本

脚本位置：
- `/Users/cherisher/Desktop/ccf-master/codemaster/scripts/luogu-sync.mjs`

NPM 入口：
- `npm run luogu:sync -- <args>`

## 作用

这个脚本会抓取洛谷公开题面，并转换成当前 CodeMaster 导入接口可直接使用的 JSON：

- 题目基础信息
- 题面 Markdown
- 输入格式 / 输出格式
- 样例
- 提示
- 时限 / 内存

默认只生成 JSON 文件，不直接写数据库。  
如果你提供后台 `cm_session` cookie，它也可以直接调用：

- `POST /api/admin/problems/import`

## 支持的模式

1. 按题号抓取

```bash
npm run luogu:sync -- --pids P1001,P1000 --output ./tmp/luogu-import.json
```

2. 按列表关键词抓取

```bash
npm run luogu:sync -- --list-keyword 入门 --list-pages 2 --list-limit 20 --output ./tmp/luogu-import.json
```

3. 抓取后直接导入本地平台

```bash
npm run luogu:sync -- \
  --pids P1001 \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```

## 参数

- `--pids`
  - 多个洛谷题号，逗号分隔，例如 `P1001,P1000`
- `--list-keyword`
  - 列表搜索关键词
- `--list-page`
  - 列表模式起始页，默认 `1`
- `--list-pages`
  - 列表模式抓取页数，默认 `1`
- `--list-limit`
  - 列表模式最多抓多少题
- `--output`
  - 输出 JSON 文件路径，默认 `./tmp/luogu-import.json`
- `--visibility`
  - 导入后的题目可见性，支持 `public/private/hidden/contest`，默认 `public`
- `--source-prefix`
  - `source` 字段前缀，默认 `luogu`
- `--tag-map`
  - 可选 JSON 文件，用来把洛谷 tag ID 映射到你平台的标签名
- `--keep-tag-ids`
  - 如果没有映射，保留成 `luogu-tag:<id>`
- `--delay-ms`
  - 抓题之间的延迟，默认 `400`
- `--timeout-ms`
  - 每次请求超时，默认 `15000`
- `--continue-on-error`
  - 某题抓取失败时跳过，继续跑剩余题目
- `--base-url`
  - CodeMaster 地址，例如 `http://127.0.0.1:3001`
- `--import-url`
  - 自定义导入接口地址，会覆盖 `--base-url`
- `--cookie`
  - 管理员 cookie，例如 `cm_session=...`

## 输出格式

输出 JSON 直接对齐当前导入接口：

```json
{
  "problems": [
    {
      "title": "A+B Problem",
      "difficulty": 1,
      "visibility": "public",
      "source": "luogu:P1001",
      "tags": [],
      "versions": [
        {
          "statement": "## 题目描述 ...",
          "statementMd": "## 题目描述 ...",
          "hints": "...",
          "inputFormat": "...",
          "outputFormat": "...",
          "samples": [
            {
              "input": "20 30\\n",
              "output": "50\\n"
            }
          ],
          "notes": "Imported from Luogu ...",
          "timeLimitMs": 1000,
          "memoryLimitMb": 512
        }
      ]
    }
  ]
}
```

## 标签映射

当前脚本会自动拉取洛谷公开标签字典：

- `https://www.luogu.com.cn/_lfe/tags/zh-CN`

也就是说，抓题时会直接把：

```json
"tags": [3, 12, 19]
```

自动转成对应的标签名。

### 本地覆盖

如果你希望把洛谷原始标签名改成你平台自己的命名，可以维护：

- `/Users/cherisher/Desktop/ccf-master/codemaster/config/luogu-tag-map.json`
- `/Users/cherisher/Desktop/ccf-master/codemaster/config/luogu-problem-tag-overrides.json`

其中：

- `luogu-tag-map.json`
  - 用来覆盖“tag id -> 标签名”
- `luogu-problem-tag-overrides.json`
  - 用来给“洛谷本身没有 tags 的题”手工指定标签

`luogu-tag-map.json` 现在表示“覆盖映射”，不是完整字典。  
例如你想把洛谷的 `动态规划 DP` 改成 `动态规划`：

```json
{
  "3": "动态规划"
}
```

如果你更新了这个文件，想把数据库里已经存在的旧标签名也一起规范化，可以执行：

```bash
npm run luogu:normalize-tags --
```

如果你想临时使用另一份覆盖文件，也可以传：

```bash
npm run luogu:sync -- --pids P1001 --tag-map ./tmp/luogu-tag-map.json
```

`luogu-problem-tag-overrides.json` 的格式例如：

```json
{
  "luogu:P1422": ["模拟", "分支结构"],
  "luogu:P1882": ["图论", "最短路"]
}
```

### 保留原始 tag ID

如果你不想映射名字，而是保留原始 ID，也可以用：

```bash
npm run luogu:sync -- --pids P1001 --keep-tag-ids
```

输出类似：

```json
{
  "tags": ["luogu-tag:1"]
}
```

### 给已导入题目回填标签

如果题目已经抓进库，但当时还没有打标签，可以直接回填：

```bash
npm run luogu:backfill-tags --
```

只回填某个区间：

```bash
npm run luogu:backfill-tags -- --from 1001 --to 2001
```

只预览不写库：

```bash
npm run luogu:backfill-tags -- --dry-run
```

回填逻辑顺序：

1. 先用题目 `notes` 里的 `Luogu tag IDs`
2. 如果本地没有记录，再回源洛谷题目详情抓 `tags`
3. 如果洛谷题目详情本身也没有标签，再应用 `luogu-problem-tag-overrides.json`

## 规范化已有标签

如果你改了 `luogu-tag-map.json`，并希望把数据库里已经存在的旧标签名一起改成规范名，可以执行：

```bash
npm run luogu:normalize-tags --
```

只预览不写库：

```bash
npm run luogu:normalize-tags -- --dry-run
```

## 直接导入时如何拿 `cm_session`

这个 cookie 是 HttpOnly，不能直接从网页脚本读取。  
最稳的方式是从浏览器开发者工具里复制请求头里的 `cookie`。

建议步骤：

1. 用管理员账号登录你的 CodeMaster 后台
2. 打开浏览器开发者工具
3. 找任意一个发往 `127.0.0.1:3001` 的请求
4. 复制请求头中的：

```text
cookie: cm_session=xxxx
```

5. 把 `cm_session=xxxx` 整段传给 `--cookie`

## 已知限制

1. 只抓公开题面，不抓 hidden testcase。
2. 不抓官方题解、提交记录、讨论区内容。
3. 洛谷难度会映射到你平台当前的 1/2/3 三档：
   - `<= 2 -> 1`
   - `<= 5 -> 2`
   - `>= 6 -> 3`
4. 原始洛谷难度、题号、链接、tag ID 会写进 `notes`。
5. `hint` 字段里有时会带“广告 / 代码模板 / 额外说明”，脚本当前保留原文，不做清洗。

## 推荐用法

先生成 JSON，人工抽查后再导入：

```bash
npm run luogu:sync -- --pids P1001,P1008 --output ./tmp/luogu-batch.json
```

检查无误后再导入：

```bash
curl -X POST http://127.0.0.1:3001/api/admin/problems/import \
  -H 'content-type: application/json' \
  -H 'cookie: cm_session=你的管理员会话' \
  --data-binary @./tmp/luogu-batch.json
```

如果你后面要做“定时同步”或“去重更新”，建议下一步加一张外部来源映射表，例如：

- `provider`
- `externalId`
- `sourceUrl`
- `problemId`
- `contentHash`
- `lastSyncedAt`

否则重复导入会只能靠标题或 source 字段做人肉判断。
