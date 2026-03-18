import type { ProblemAnalysisInput } from "@/lib/problem-analysis/types"

function normalizeText(value: string | null | undefined) {
  return (value ?? "").toLowerCase()
}

function hasAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern))
}

function parseNumberToken(raw: string) {
  const normalized = raw.replace(/[,，]/g, "").replace(/\s+/g, "").toLowerCase()
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10)
  }
  const scientific = normalized.match(/^(\d+(?:\.\d+)?)e(\d+)$/)
  if (scientific) {
    return Math.floor(Number.parseFloat(scientific[1]) * 10 ** Number.parseInt(scientific[2], 10))
  }
  const power = normalized.match(/^10\^(\d+)$/)
  if (power) {
    return 10 ** Number.parseInt(power[1], 10)
  }
  return undefined
}

function parseMaxForVariable(text: string, names: string[]) {
  const compact = text.replace(/\s+/g, " ")
  const patterns = names.flatMap((name) => [
    new RegExp(`${name}\\s*(?:<=|≤|<|不超过|最多)\\s*([0-9eE^.,]+)`, "i"),
    new RegExp(`([0-9eE^.,]+)\\s*(?:>=|≥|>|不少于|至少)\\s*${name}`, "i"),
  ])

  for (const pattern of patterns) {
    const match = compact.match(pattern)
    if (!match?.[1]) continue
    const value = parseNumberToken(match[1])
    if (value !== undefined) {
      return value
    }
  }

  return undefined
}

export type ProblemFeatures = {
  text: string
  tagsLower: string[]
  bounds: {
    nMax?: number
    mMax?: number
    qMax?: number
    valueMax?: number
  }
  formatHints: {
    hasArray: boolean
    hasString: boolean
    hasMatrixGrid: boolean
    hasGraphEdges: boolean
    hasTreeEdges: boolean
    hasIntervals: boolean
    hasQueries: boolean
    hasGridQueries: boolean
    hasCompositeArrayQueries: boolean
  }
  semanticHints: {
    mentionsSort: boolean
    mentionsSubstring: boolean
    mentionsPalindrome: boolean
    mentionsGraph: boolean
    mentionsTree: boolean
    mentionsInterval: boolean
    mentionsQuery: boolean
    mentionsUpdate: boolean
    mentionsConnected: boolean
  }
}

export function extractProblemFeatures(input: ProblemAnalysisInput): ProblemFeatures {
  const title = normalizeText(input.title)
  const statement = normalizeText(input.statement)
  const statementMd = normalizeText(input.statementMd)
  const constraints = normalizeText(input.constraints)
  const inputFormat = normalizeText(input.inputFormat)
  const outputFormat = normalizeText(input.outputFormat)
  const text = [title, statement, statementMd, constraints, inputFormat, outputFormat]
    .filter(Boolean)
    .join("\n")
  const tagsLower = input.tags.map((tag) => tag.toLowerCase())

  const hasArray = hasAny(inputFormat, [
    "n 个整数",
    "n integers",
    "array",
    "数组",
    "a_i",
    "a1",
  ])
  const hasString = hasAny(text, ["字符串", "string", "substring", "回文", "palindrome"])
  const hasMatrixGrid = hasAny(text, [
    "棋盘",
    "board",
    "grid",
    "矩阵",
    "网格",
    "n×m",
    "n x m",
    "n \\times m",
  ])
  const hasIntervals = hasAny(text, ["区间", "interval", "[l, r]", "[l,r]", "左端点", "右端点"])
  const hasQueries = hasAny(text, [
    "q 次操作",
    "q operations",
    "接下来 q 行",
    "each operation",
    "查询",
    "操作",
    "update",
    "query",
  ])
  const hasGraphEdges = hasAny(text, [
    "m 条边",
    "m edges",
    "u v",
    "图",
    "graph",
    "顶点",
    "边",
  ])
  const hasTreeEdges = hasAny(text, [
    "n-1 条边",
    "n - 1 条边",
    "树",
    "tree",
    "父节点",
    "子节点",
  ])
  const hasGridQueries =
    hasMatrixGrid &&
    hasQueries &&
    hasAny(text, [
      "每行包含 4 个整数",
      "每行包含 6 个整数",
      "坐标",
      "位置",
      "空白格",
    ])

  return {
    text,
    tagsLower,
    bounds: {
      nMax: parseMaxForVariable(text, ["n"]),
      mMax: parseMaxForVariable(text, ["m"]),
      qMax: parseMaxForVariable(text, ["q"]),
      valueMax: parseMaxForVariable(text, ["a_i", "ai", "value", "x"]),
    },
    formatHints: {
      hasArray,
      hasString,
      hasMatrixGrid,
      hasGraphEdges,
      hasTreeEdges,
      hasIntervals,
      hasQueries,
      hasGridQueries,
      hasCompositeArrayQueries: hasArray && hasQueries,
    },
    semanticHints: {
      mentionsSort: hasAny(text, ["排序", "sort", "升序", "降序"]),
      mentionsSubstring: hasAny(text, ["substring", "子串"]),
      mentionsPalindrome: hasAny(text, ["palindrome", "回文"]),
      mentionsGraph: hasAny(text, ["graph", "图", "最短路", "连通", "拓扑"]),
      mentionsTree: hasAny(text, ["tree", "树", "lca", "子树"]),
      mentionsInterval: hasIntervals,
      mentionsQuery: hasQueries,
      mentionsUpdate: hasAny(text, ["update", "modify", "修改", "更新", "set", "add"]),
      mentionsConnected: hasAny(text, ["connected", "连通"]),
    },
  }
}
