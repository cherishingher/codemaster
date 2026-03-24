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
    scalarLayout?: number[]
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

const CHINESE_NUMBER_MAP: Record<string, number> = {
  "一": 1,
  "二": 2,
  "两": 2,
  "三": 3,
  "四": 4,
  "五": 5,
}

function parseCountToken(raw: string | undefined) {
  if (!raw) return undefined
  const normalized = raw.trim().toLowerCase()
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10)
  }
  if (normalized in CHINESE_NUMBER_MAP) {
    return CHINESE_NUMBER_MAP[normalized]
  }
  switch (normalized) {
    case "one":
      return 1
    case "two":
      return 2
    case "three":
      return 3
    case "four":
      return 4
    case "five":
      return 5
    default:
      return undefined
  }
}

function inferScalarLayout(text: string) {
  const layout: number[] = []
  const normalized = text.replace(/\s+/g, " ")
  const scalarTypePattern = "(?:正|负|非负|非正|long\\s+long\\s+)?(?:整数|int|integer|numbers?)"

  const numberedLinePatterns: Array<[RegExp, number]> = [
    [new RegExp(`第[一1]行[^。；\\n]*?([一二两三四五\\d]+|one|two|three|four|five)\\s*(?:个)?\\s*${scalarTypePattern}`, "i"), 1],
    [new RegExp(`第[二2]行[^。；\\n]*?([一二两三四五\\d]+|one|two|three|four|five)\\s*(?:个)?\\s*${scalarTypePattern}`, "i"), 2],
    [new RegExp(`第[三3]行[^。；\\n]*?([一二两三四五\\d]+|one|two|three|four|five)\\s*(?:个)?\\s*${scalarTypePattern}`, "i"), 3],
    [new RegExp(`第[四4]行[^。；\\n]*?([一二两三四五\\d]+|one|two|three|four|five)\\s*(?:个)?\\s*${scalarTypePattern}`, "i"), 4],
  ]

  for (const [pattern, order] of numberedLinePatterns) {
    const match = normalized.match(pattern)
    const count = parseCountToken(match?.[1])
    if (count && count > 0) {
      layout[order - 1] = count
    }
  }

  if (layout.length > 0 && layout.every((value) => Number.isInteger(value) && value > 0)) {
    return layout
  }

  const singleLineMatch = normalized.match(
    new RegExp(
      `(?:输入(?:只有|仅有|一行包含|一行输入)?|given|contains?)\\s*([一二两三四五\\d]+|one|two|three|four|five)\\s*(?:个)?\\s*${scalarTypePattern}`,
      "i"
    )
  )
  const singleLineCount = parseCountToken(singleLineMatch?.[1])
  if (singleLineCount && singleLineCount > 0) {
    return [singleLineCount]
  }

  if (
    new RegExp(`(?:输入|given|contains?)[^。；\\n]*?(?:一个|1\\s*个|one)\\s*${scalarTypePattern}`, "i").test(
      normalized
    )
  ) {
    return [1]
  }

  if (
    new RegExp(`(?:输入|given|contains?)[^。；\\n]*?(?:两个|2\\s*个|two)\\s*${scalarTypePattern}`, "i").test(
      normalized
    )
  ) {
    return [2]
  }

  return undefined
}

export function extractProblemFeatures(input: ProblemAnalysisInput): ProblemFeatures {
  const title = normalizeText(input.title)
  const statement = normalizeText(input.statement)
  const statementMd = normalizeText(input.statementMd)
  const solutionSource = normalizeText(input.solutionSource)
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
    || hasAny(solutionSource, ["std::string", " string ", ".substr(", "substr(", "kmp", "z_function", "manacher"])
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
    || hasAny(solutionSource, ["dx[4]", "dy[4]", "dx[8]", "dy[8]", "grid", "board", "matrix"])
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
    || hasAny(solutionSource, ["segmenttree", "fenwick", "bit<", "query(", "update(", "modify(", "lazy"])
  const hasGraphEdges = hasAny(text, [
    "m 条边",
    "m edges",
    "u v",
    "图",
    "graph",
    "顶点",
    "边",
  ])
    || hasAny(solutionSource, ["dijkstra", "bellman", "floyd", "toposort", "adj", "edges", "unionfind", "dsu", "graph"])
  const hasTreeEdges = hasAny(text, [
    "n-1 条边",
    "n - 1 条边",
    "树",
    "tree",
    "父节点",
    "子节点",
  ])
    || hasAny(solutionSource, ["lca", "subtree", "heavy", "centroid", "tree", "children", "parent"])
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
  const scalarLayout = inferScalarLayout([inputFormat, outputFormat, constraints].filter(Boolean).join("\n"))

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
      scalarLayout,
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
      mentionsSubstring: hasAny(text, ["substring", "子串"]) || hasAny(solutionSource, ["substr(", "substring", "prefix_function", "z_function"]),
      mentionsPalindrome: hasAny(text, ["palindrome", "回文"]) || hasAny(solutionSource, ["manacher", "palindrome"]),
      mentionsGraph: hasAny(text, ["graph", "图", "最短路", "连通", "拓扑"]) || hasAny(solutionSource, ["dijkstra", "spfa", "bellman", "floyd", "toposort", "scc", "bridge"]),
      mentionsTree: hasAny(text, ["tree", "树", "lca", "子树"]) || hasAny(solutionSource, ["lca", "dfs1", "dfs2", "subtree", "centroid", "hld"]),
      mentionsInterval: hasIntervals,
      mentionsQuery: hasQueries || hasAny(solutionSource, ["query(", "modify(", "update(", "range_", "segmenttree", "fenwick"]),
      mentionsUpdate: hasAny(text, ["update", "modify", "修改", "更新", "set", "add"]) || hasAny(solutionSource, ["update(", "modify(", "add(", "lazy"]),
      mentionsConnected: hasAny(text, ["connected", "连通"]) || hasAny(solutionSource, ["unionfind", "dsu", "bfs(", "dfs("]),
    },
  }
}
