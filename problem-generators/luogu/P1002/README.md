# luogu:P1002 生成器

- 标题：`[NOIP 2002 普及组] 过河卒`
- slug：`noip-2002`
- 当前状态：`active`

## 实现说明

- `std.mjs`
  - 使用 `BigInt` 二维动态规划
  - 屏蔽马本身和马能控制到的 8 个点
- `brute.mjs`
  - 小数据 DFS 枚举
  - 只用于差分验证
- `gen.mjs`
  - `small-random`：小规模随机棋盘
  - `edge`：边界和特殊阻挡位置
  - `stress`：接近上界的随机棋盘

## 使用

```bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run generator:verify -- --dirs ./problem-generators/luogu/P1002
npm run generator:generate -- --dirs ./problem-generators/luogu/P1002 \
  --base-url http://127.0.0.1:3001 \
  --cookie 'cm_session=你的管理员会话'
```
