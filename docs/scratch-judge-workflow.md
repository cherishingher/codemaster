# Scratch 判题工作流

本文档说明当前项目内可复用的 Scratch 判题链路，范围只覆盖 `apps/web` 中的 Scratch 判题与后台管理流程。

## 目标

当前实现解决两类问题：

- 兼容已有单角色 Scratch 判题规则
- 支持多角色分段计分，并允许“题干先落草稿，管理员上传标准答案后自动补全”

适用场景：

- GESP 图形化编程一级题目
- 题干中存在明确的“功能实现 / 注意事项 / 角色代码区”结构

## 规则形态

### 1. 单角色规则

最早的 Scratch 判题规则，只检查一个角色。

```json
{
  "role": "Cake",
  "scripts": []
}
```

### 2. 单角色计分规则

把一个角色拆成多个得分点。

```json
{
  "role": "Cake",
  "totalScore": 20,
  "rules": [
    { "score": 10, "rule": { "role": "Cake", "scripts": [] } }
  ]
}
```

### 3. 多角色分段计分规则

当前推荐的最终判题格式。每个分段明确指定角色，适合 GESP 图形化题。

```json
{
  "version": 1,
  "mode": "score_by_part",
  "totalScore": 25,
  "parts": [
    {
      "id": "r1",
      "title": "Stage 背景初始化",
      "role": "Stage",
      "score": 4,
      "rule": {
        "role": "Stage",
        "scripts": []
      }
    }
  ]
}
```

### 4. 题干草稿规则

这是自动生成的中间态，不直接用于用户提交判题，只用于管理员后续上传标准答案时自动补全。

```json
{
  "version": 1,
  "mode": "score_by_part_draft",
  "source": "statement",
  "totalScore": 100,
  "parts": [
    {
      "id": "r1",
      "index": 1,
      "title": "Stage 点击绿旗，背景换成 Hill。",
      "description": "点击绿旗，背景换成 Hill。",
      "role": "Stage",
      "score": 13,
      "ordered": false,
      "consecutive": false
    }
  ]
}
```

## 判题能力

Scratch 判题核心在：

- [`apps/web/src/lib/scratch-judge.ts`](../apps/web/src/lib/scratch-judge.ts)
- [`apps/web/src/lib/scratch-rules-gen.ts`](../apps/web/src/lib/scratch-rules-gen.ts)
- [`apps/web/src/lib/scratch-rule-draft.ts`](../apps/web/src/lib/scratch-rule-draft.ts)

当前支持：

- 单角色规则判题
- 单角色分点评分
- 多角色分段评分 `score_by_part`
- 连续有序匹配 `ordered_consecutive`
- 题干草稿补全 `score_by_part_draft -> score_by_part`

其中 `ordered_consecutive` 用于这类要求：

- “依次执行”
- “然后”
- “之后”
- “必须连到一起”

它表示：

- 顺序必须一致
- 中间不允许插入其他积木

## 后台工作流

### 一、创建或导入题目时

以下入口会尝试根据题干自动生成 Scratch 草稿规则：

- [`apps/web/src/app/api/admin/problems/route.ts`](../apps/web/src/app/api/admin/problems/route.ts)
- [`apps/web/src/app/api/admin/problems/[id]/versions/route.ts`](../apps/web/src/app/api/admin/problems/%5Bid%5D/versions/route.ts)
- [`apps/web/src/app/api/admin/problems/import/route.ts`](../apps/web/src/app/api/admin/problems/import/route.ts)
- [`apps/web/src/app/api/admin/problems/import-zip/route.ts`](../apps/web/src/app/api/admin/problems/import-zip/route.ts)
- [`scripts/import-gesp-graphical-level1.mjs`](../scripts/import-gesp-graphical-level1.mjs)

只要题干能识别出：

- `功能实现`
- 编号条目，例如 `（1）`
- `注意事项`
- “背景代码区 / 角色 XXX 代码区”

系统就会把要求点先写进 `ProblemVersion.scratchRules`。

### 二、管理员上传标准答案 `.sb3`

后台页面：

- [`apps/web/src/app/(app)/admin/problems/[id]/page.tsx`](../apps/web/src/app/%28app%29/admin/problems/%5Bid%5D/page.tsx)

上传接口：

- [`apps/web/src/app/api/admin/problems/[id]/scratch-rules/route.ts`](../apps/web/src/app/api/admin/problems/%5Bid%5D/scratch-rules/route.ts)

当版本中的 `scratchRules` 是草稿时：

1. 解析管理员上传的 `.sb3`
2. 按角色生成基础规则
3. 依据题干草稿里的分段信息自动切分
4. 生成最终 `score_by_part`
5. 直接回写到 `ProblemVersion.scratchRules`

管理员不需要再手工写 JSON。

### 三、后台验证

接口：

- [`apps/web/src/app/api/admin/versions/[id]/scratch-rules/route.ts`](../apps/web/src/app/api/admin/versions/%5Bid%5D/scratch-rules/route.ts)

它支持两种情况：

- 直接验证最终规则
- 直接验证草稿规则，验证时自动先补全再评分

## 用户提交时的行为

用户 Scratch 提交入口：

- [`apps/web/src/app/api/problems/[id]/submit/route.ts`](../apps/web/src/app/api/problems/%5Bid%5D/submit/route.ts)

规则约束如下：

- 如果当前版本没有 `scratchRules`，返回 `scratch_rules_not_configured`
- 如果当前版本仍然是草稿规则，返回 `scratch_rules_incomplete`
- 只有最终规则才允许进入正式判题

这能避免“草稿规则被直接用于线上提交”。

## GESP 图形化一级现状

项目已经支持：

- 导入时自动为 GESP 图形化一级题目生成草稿规则
- 管理员上传标准答案后自动补全完整判题规则

当前批量回填脚本：

- [`scripts/backfill-gesp-scratch-level1-drafts.mts`](../scripts/backfill-gesp-scratch-level1-drafts.mts)

运行：

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
node --import tsx scripts/backfill-gesp-scratch-level1-drafts.mts
```

如果需要重刷已有草稿：

```bash
node --import tsx scripts/backfill-gesp-scratch-level1-drafts.mts --refresh-drafts
```

## 本地验证脚本

### 1. 验证“题干草稿 -> 标准答案 -> 自动补全”

- [`scripts/validate-scratch-draft-completion.mts`](../scripts/validate-scratch-draft-completion.mts)

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
node --import tsx scripts/validate-scratch-draft-completion.mts <statement.txt> <answer.sb3>
```

### 2. 验证已有 `score_by_part` 规则

- [`scripts/validate-scratch-score-by-part.mts`](../scripts/validate-scratch-score-by-part.mts)

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
node --experimental-strip-types scripts/validate-scratch-score-by-part.mts <answer.sb3> [rules.json]
```

## 已知边界

- 题干草稿生成是启发式逻辑，不是通用自然语言理解器
- 当前最适合 GESP 图形化一级这类结构化题干
- 如果题干没有明确“角色归属”或要求点文本结构不稳定，仍建议人工复核草稿
- 最终线上判题始终依赖管理员上传的标准答案补全后生成的规则
