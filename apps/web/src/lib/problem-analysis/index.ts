import { extractProblemFeatures } from "@/lib/problem-analysis/features"
import type {
  GeneratorRecommendation,
  GeneratorType,
  InputStructure,
  Pitfall,
  ProblemAnalysisBundle,
  ProblemAnalysisInput,
  ProblemAnalysisResult,
  ProblemCategory,
  RuleEvidence,
  SuggestedGroup,
} from "@/lib/problem-analysis/types"

type AutoDraftOptions = {
  testcaseCount?: number
  totalScore?: number
}

type Scoreboard = {
  category: Map<ProblemCategory, number>
  structure: Map<InputStructure, number>
  generator: Map<GeneratorType, { score: number; reasonCodes: string[]; paramsHint?: Record<string, unknown> }>
  pitfalls: Set<Pitfall>
  evidence: RuleEvidence[]
  warnings: string[]
}

function addScore<T extends string>(
  board: Map<T, number>,
  key: T,
  score: number
) {
  board.set(key, (board.get(key) ?? 0) + score)
}

function addGeneratorScore(
  scoreboard: Scoreboard,
  type: GeneratorType,
  score: number,
  reasonCode: string,
  evidence?: RuleEvidence,
  paramsHint?: Record<string, unknown>
) {
  const current = scoreboard.generator.get(type) ?? { score: 0, reasonCodes: [] as string[], paramsHint: undefined }
  current.score += score
  if (!current.reasonCodes.includes(reasonCode)) {
    current.reasonCodes.push(reasonCode)
  }
  if (paramsHint) {
    current.paramsHint = { ...(current.paramsHint ?? {}), ...paramsHint }
  }
  scoreboard.generator.set(type, current)
  if (evidence) {
    scoreboard.evidence.push(evidence)
  }
}

function topEntries<T extends string>(board: Map<T, number>, minimum = 1) {
  return [...board.entries()]
    .filter(([, score]) => score >= minimum)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)
}

function toRecommendation(
  type: GeneratorType,
  item: { score: number; reasonCodes: string[]; paramsHint?: Record<string, unknown> }
): GeneratorRecommendation {
  return {
    type,
    score: Math.max(0, Math.min(1, Number((item.score / 10).toFixed(2)))),
    reasonCodes: item.reasonCodes,
    paramsHint: item.paramsHint,
  }
}

function clampPositive(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function buildArrayDraft(bounds: { nMax?: number; valueMax?: number }) {
  const nMax = clampPositive(bounds.nMax ?? 1000, 16, 100000)
  const valueMax = clampPositive(bounds.valueMax ?? 1000000, 20, 1000000000)
  const boundaryValues = [1, 2, 3, Math.min(8, nMax)].filter((value, index, array) => array.indexOf(value) === index)
  return {
    version: 1,
    groups: [
      {
        key: "sample",
        title: "样例规模",
        count: 2,
        score: 0,
        isSample: true,
        visible: true,
        generator: {
          type: "array",
          params: {
            n: { min: 1, max: Math.min(5, nMax) },
            value: { min: 0, max: Math.min(20, valueMax) },
          },
        },
      },
      {
        key: "boundary",
        title: "边界组",
        count: 4,
        score: 20,
        generator: {
          type: "array",
          params: {
            n: { values: boundaryValues },
            value: { min: 0, max: Math.min(5, valueMax) },
          },
        },
      },
      {
        key: "random",
        title: "随机组",
        count: 6,
        score: 35,
        generator: {
          type: "array",
          params: {
            n: { min: Math.min(10, nMax), max: Math.max(Math.min(Math.floor(nMax * 0.4), nMax), Math.min(20, nMax)) },
            value: { min: 0, max: valueMax },
          },
        },
      },
      {
        key: "special_sorted",
        title: "特殊结构组",
        count: 3,
        score: 20,
        generator: {
          type: "array",
          params: {
            n: { min: Math.min(20, nMax), max: Math.max(Math.min(Math.floor(nMax * 0.3), nMax), Math.min(30, nMax)) },
            value: { min: 0, max: valueMax },
            sorted: true,
            sortOrder: "asc",
          },
        },
      },
      {
        key: "max",
        title: "极限组",
        count: 4,
        score: 25,
        generator: {
          type: "array",
          params: {
            n: { min: Math.max(1, Math.floor(nMax * 0.85)), max: nMax },
            value: { min: 0, max: valueMax },
          },
        },
      },
    ],
  }
}

function buildStringDraft(bounds: { nMax?: number }) {
  const lengthMax = clampPositive(bounds.nMax ?? 100000, 16, 100000)
  return {
    version: 1,
    groups: [
      {
        key: "sample",
        title: "样例规模",
        count: 2,
        score: 0,
        isSample: true,
        visible: true,
        generator: {
          type: "string",
          params: {
            length: { min: 1, max: Math.min(8, lengthMax) },
            alphabet: "abc",
          },
        },
      },
      {
        key: "boundary",
        title: "边界组",
        count: 4,
        score: 20,
        generator: {
          type: "string",
          params: {
            length: { values: [1, 2, 3, Math.min(10, lengthMax)] },
            alphabet: "ab",
            patternMode: "repeated",
          },
        },
      },
      {
        key: "random",
        title: "随机组",
        count: 6,
        score: 30,
        generator: {
          type: "string",
          params: {
            length: { min: Math.min(16, lengthMax), max: Math.max(Math.min(Math.floor(lengthMax * 0.4), lengthMax), Math.min(32, lengthMax)) },
            alphabet: "abcdefghijklmnopqrstuvwxyz",
            patternMode: "random",
          },
        },
      },
      {
        key: "palindrome",
        title: "特殊结构组",
        count: 3,
        score: 20,
        generator: {
          type: "string",
          params: {
            length: { min: Math.min(8, lengthMax), max: Math.max(Math.min(Math.floor(lengthMax * 0.2), lengthMax), Math.min(20, lengthMax)) },
            alphabet: "abcd",
            patternMode: "palindrome",
          },
        },
      },
      {
        key: "max",
        title: "极限组",
        count: 4,
        score: 30,
        generator: {
          type: "string",
          params: {
            length: { min: Math.max(1, Math.floor(lengthMax * 0.85)), max: lengthMax },
            alphabet: "abcdefghijklmnopqrstuvwxyz",
            patternMode: "random",
          },
        },
      },
    ],
  }
}

function buildIntervalsDraft(bounds: { nMax?: number; valueMax?: number }) {
  const countMax = clampPositive(bounds.nMax ?? 50000, 8, 100000)
  const coordMax = clampPositive(bounds.valueMax ?? 1000000, 100, 1000000000)
  return {
    version: 1,
    groups: [
      {
        key: "sample",
        title: "样例规模",
        count: 2,
        score: 0,
        isSample: true,
        visible: true,
        generator: {
          type: "intervals",
          params: {
            count: { min: 1, max: Math.min(4, countMax) },
            left: { min: 0, max: 20 },
            length: { min: 0, max: 5 },
            overlapMode: "random",
          },
        },
      },
      {
        key: "boundary_disjoint",
        title: "边界组",
        count: 4,
        score: 20,
        generator: {
          type: "intervals",
          params: {
            count: { values: [1, 2, Math.min(6, countMax)] },
            left: { min: 0, max: 20 },
            length: { min: 0, max: 2 },
            overlapMode: "disjoint",
          },
        },
      },
      {
        key: "random",
        title: "随机组",
        count: 6,
        score: 30,
        generator: {
          type: "intervals",
          params: {
            count: { min: Math.min(10, countMax), max: Math.max(Math.min(Math.floor(countMax * 0.4), countMax), Math.min(20, countMax)) },
            left: { min: 0, max: coordMax },
            length: { min: 0, max: Math.max(4, Math.min(1000, coordMax)) },
            overlapMode: "random",
          },
        },
      },
      {
        key: "overlap",
        title: "重叠组",
        count: 4,
        score: 20,
        generator: {
          type: "intervals",
          params: {
            count: { min: Math.min(8, countMax), max: Math.max(Math.min(Math.floor(countMax * 0.2), countMax), Math.min(16, countMax)) },
            left: { min: 0, max: Math.min(50, coordMax) },
            length: { min: 1, max: Math.max(4, Math.min(50, coordMax)) },
            overlapMode: "heavy-overlap",
          },
        },
      },
      {
        key: "max",
        title: "极限组",
        count: 4,
        score: 30,
        generator: {
          type: "intervals",
          params: {
            count: { min: Math.max(1, Math.floor(countMax * 0.85)), max: countMax },
            left: { min: 0, max: coordMax },
            length: { min: 1, max: Math.max(4, Math.min(10000, coordMax)) },
            overlapMode: "nested",
          },
        },
      },
    ],
  }
}

function buildQueriesDraft(bounds: { nMax?: number; qMax?: number; valueMax?: number }, preferMinMax: boolean) {
  const nMax = clampPositive(bounds.nMax ?? 100000, 8, 100000)
  const qMax = clampPositive(bounds.qMax ?? 100000, 8, 100000)
  const valueMax = clampPositive(bounds.valueMax ?? 1000000, 20, 1000000000)
  const queryTemplates = preferMinMax
    ? [{ kind: "point_set", value: { min: 0, max: valueMax } }, { kind: "range_min" }, { kind: "range_max" }]
    : [{ kind: "point_set", value: { min: 0, max: valueMax } }, { kind: "range_add", value: { min: 0, max: Math.max(4, Math.min(1000, valueMax)) } }, { kind: "range_sum" }]

  return {
    version: 1,
    groups: [
      {
        key: "sample",
        title: "样例规模",
        count: 2,
        score: 0,
        isSample: true,
        visible: true,
        generator: {
          type: "queries",
          params: {
            n: { min: 1, max: Math.min(6, nMax) },
            q: { min: 1, max: Math.min(6, qMax) },
            initialValue: { min: 0, max: Math.min(20, valueMax) },
            queryTemplates,
          },
        },
      },
      {
        key: "boundary",
        title: "边界组",
        count: 4,
        score: 20,
        generator: {
          type: "queries",
          params: {
            n: { values: [1, 2, Math.min(6, nMax)] },
            q: { values: [1, 2, Math.min(8, qMax)] },
            initialValue: { min: 0, max: Math.min(10, valueMax) },
            queryTemplates,
          },
        },
      },
      {
        key: "mixed_random",
        title: "随机组",
        count: 6,
        score: 25,
        generator: {
          type: "queries",
          params: {
            n: { min: Math.min(10, nMax), max: Math.max(Math.min(Math.floor(nMax * 0.3), nMax), Math.min(20, nMax)) },
            q: { min: Math.min(10, qMax), max: Math.max(Math.min(Math.floor(qMax * 0.4), qMax), Math.min(20, qMax)) },
            initialValue: { min: 0, max: valueMax },
            queryTemplates,
          },
        },
      },
      {
        key: "query_heavy",
        title: "查询压力组",
        count: 4,
        score: 25,
        generator: {
          type: "queries",
          params: {
            n: { min: Math.min(8, nMax), max: Math.max(Math.min(Math.floor(nMax * 0.2), nMax), Math.min(16, nMax)) },
            q: { min: Math.max(Math.min(50, qMax), 8), max: Math.max(Math.min(Math.floor(qMax * 0.85), qMax), Math.min(64, qMax)) },
            initialValue: { min: 0, max: valueMax },
            queryTemplates,
          },
        },
      },
      {
        key: "max",
        title: "极限组",
        count: 4,
        score: 30,
        generator: {
          type: "queries",
          params: {
            n: { min: Math.max(1, Math.floor(nMax * 0.85)), max: nMax },
            q: { min: Math.max(1, Math.floor(qMax * 0.85)), max: qMax },
            initialValue: { min: 0, max: valueMax },
            queryTemplates,
          },
        },
      },
    ],
  }
}

function buildGridQueriesDraft(bounds: { nMax?: number; mMax?: number; qMax?: number }) {
  // When explicit constraints are absent, keep grid/query defaults conservative.
  const nMax = clampPositive(bounds.nMax ?? 12, 4, 60)
  const mMax = clampPositive(bounds.mMax ?? 12, 4, 60)
  const qMax = clampPositive(bounds.qMax ?? 60, 4, 1000)

  return {
    version: 1,
    groups: [
      {
        key: "boundary",
        title: "边界组",
        count: 3,
        score: 20,
        generator: {
          type: "grid_queries",
          params: {
            n: { values: [2, 3, Math.min(5, nMax)] },
            m: { values: [2, 3, Math.min(5, mMax)] },
            q: { values: [1, 2, Math.min(6, qMax)] },
            movableCellRatio: 0.65,
            maxMovableCells: 18,
            queryArity: 6,
          },
        },
      },
      {
        key: "random",
        title: "随机组",
        count: 4,
        score: 30,
        generator: {
          type: "grid_queries",
          params: {
            n: { min: Math.min(6, nMax), max: Math.max(Math.min(Math.floor(nMax * 0.35), nMax), Math.min(12, nMax)) },
            m: { min: Math.min(6, mMax), max: Math.max(Math.min(Math.floor(mMax * 0.35), mMax), Math.min(12, mMax)) },
            q: { min: Math.min(8, qMax), max: Math.max(Math.min(Math.floor(qMax * 0.3), qMax), Math.min(16, qMax)) },
            movableCellRatio: 0.4,
            maxMovableCells: 48,
            queryArity: 6,
          },
        },
      },
      {
        key: "special_sparse",
        title: "特殊结构组",
        count: 2,
        score: 20,
        generator: {
          type: "grid_queries",
          params: {
            n: { min: Math.min(5, nMax), max: Math.max(Math.min(Math.floor(nMax * 0.25), nMax), Math.min(10, nMax)) },
            m: { min: Math.min(5, mMax), max: Math.max(Math.min(Math.floor(mMax * 0.25), mMax), Math.min(10, mMax)) },
            q: { min: Math.min(6, qMax), max: Math.max(Math.min(Math.floor(qMax * 0.25), qMax), Math.min(12, qMax)) },
            movableCellRatio: 0.25,
            maxMovableCells: 28,
            queryArity: 6,
          },
        },
      },
      {
        key: "max",
        title: "极限组",
        count: 3,
        score: 30,
        generator: {
          type: "grid_queries",
          params: {
            n: { min: Math.max(2, Math.floor(nMax * 0.85)), max: nMax },
            m: { min: Math.max(2, Math.floor(mMax * 0.85)), max: mMax },
            q: { min: Math.max(1, Math.floor(qMax * 0.85)), max: qMax },
            movableCellRatio: 0.45,
            maxMovableCells: 72,
            queryArity: 6,
          },
        },
      },
    ],
  }
}

function getAutoCaseGroups<T extends { key: string }>(groups: T[], testcaseCount: number) {
  const matches = (group: T, token: string) => group.key === token || group.key.includes(token)

  if (testcaseCount <= 1) {
    return groups.filter((group) => matches(group, "max")).slice(0, 1)
  }
  if (testcaseCount === 2) {
    return groups.filter((group) => matches(group, "boundary") || matches(group, "max"))
  }
  if (testcaseCount === 3) {
    return groups.filter(
      (group) => matches(group, "boundary") || matches(group, "random") || matches(group, "max")
    )
  }
  return groups
}

function getGroupWeight(groupKey: string) {
  switch (groupKey) {
    case "boundary":
    case "boundary_disjoint":
      return 2
    case "random":
    case "mixed_random":
      return 4
    case "special":
    case "special_sorted":
    case "overlap":
    case "query_heavy":
      return 2
    case "max":
      return 2
    default:
      return 1
  }
}

function distributeCaseCounts(groupKeys: string[], testcaseCount: number) {
  if (groupKeys.length === 0) return []
  const counts = new Array<number>(groupKeys.length).fill(1)
  const remaining = testcaseCount - groupKeys.length
  if (remaining <= 0) {
    return counts
  }

  const weights = groupKeys.map((groupKey) => getGroupWeight(groupKey))
  const totalWeight = weights.reduce((sum, item) => sum + item, 0) || 1
  let assigned = 0

  weights.forEach((weight, index) => {
    const extra = Math.floor((remaining * weight) / totalWeight)
    counts[index] += extra
    assigned += extra
  })

  let leftover = remaining - assigned
  const order = weights
    .map((weight, index) => ({ weight, index }))
    .sort((a, b) => b.weight - a.weight)

  let cursor = 0
  while (leftover > 0) {
    counts[order[cursor % order.length].index] += 1
    leftover -= 1
    cursor += 1
  }

  return counts
}

function buildAutoCaseDraft(
  draft: Record<string, unknown>,
  testcaseCount: number,
  totalScore: number
) {
  if (!Number.isInteger(testcaseCount) || testcaseCount <= 0) {
    throw new Error("testcase_count_invalid")
  }
  if (!Number.isInteger(totalScore) || totalScore <= 0) {
    throw new Error("total_score_invalid")
  }
  if (totalScore % testcaseCount !== 0) {
    throw new Error("equal_score_not_divisible")
  }

  const root = draft as { version?: unknown; groups?: Array<Record<string, unknown>> }
  const sourceGroups = Array.isArray(root.groups) ? root.groups : []
  const hiddenGroups = sourceGroups.filter((group) => group.isSample !== true)
  const groups = hiddenGroups.length > 0 ? hiddenGroups : sourceGroups
  const selectedGroups = getAutoCaseGroups(groups, testcaseCount)
  const effectiveGroups = selectedGroups.length > 0 ? selectedGroups : groups.slice(0, Math.min(testcaseCount, groups.length))
  const groupKeys = effectiveGroups.map((group) => String(group.key ?? "group"))
  const counts = distributeCaseCounts(groupKeys, testcaseCount)
  const scorePerCase = totalScore / testcaseCount

  return {
    version: 1,
    groups: effectiveGroups.map((group, index) => ({
      ...group,
      count: counts[index],
      score: scorePerCase,
      isSample: false,
      visible: false,
    })),
  }
}

function buildScoreboard(input: ProblemAnalysisInput) {
  const features = extractProblemFeatures(input)
  const scoreboard: Scoreboard = {
    category: new Map(),
    structure: new Map(),
    generator: new Map(),
    pitfalls: new Set(["OFF_BY_ONE"]),
    evidence: [],
    warnings: [],
  }

  const addEvidence = (ruleId: string, message: string, source: RuleEvidence["source"]) => {
    scoreboard.evidence.push({ ruleId, message, source })
  }

  const hasTag = (...patterns: string[]) => features.tagsLower.some((tag) => patterns.some((pattern) => tag.includes(pattern)))

  if (features.formatHints.hasCompositeArrayQueries || features.semanticHints.mentionsQuery || hasTag("query", "数据结构")) {
    addScore(scoreboard.category, "QUERY_SIMULATION", 5)
    addScore(scoreboard.structure, features.formatHints.hasCompositeArrayQueries ? "COMPOSITE" : "QUERIES", 6)
    addScore(scoreboard.structure, "QUERIES", 6)
    addGeneratorScore(scoreboard, "queries", 8, "INPUT_HAS_Q_LINES", {
      ruleId: "queries.detected",
      message: "检测到操作序列或 q 行输入结构",
      source: features.formatHints.hasQueries ? "inputFormat" : "statement",
    }, {
      qMax: features.bounds.qMax,
      nMax: features.bounds.nMax,
    })
    scoreboard.pitfalls.add("LARGE_Q_SMALL_N")
    if (features.bounds.qMax && features.bounds.nMax && features.bounds.nMax > features.bounds.qMax) {
      scoreboard.pitfalls.add("LARGE_N_SMALL_Q")
    }
  }

  if (features.formatHints.hasGridQueries || (features.formatHints.hasMatrixGrid && features.formatHints.hasQueries)) {
    addScore(scoreboard.category, "MATRIX_PROBLEM", 7)
    addScore(scoreboard.category, "QUERY_SIMULATION", 4)
    addScore(scoreboard.structure, "MATRIX", 8)
    addScore(scoreboard.structure, "COMPOSITE", 6)
    addScore(scoreboard.structure, "QUERIES", 4)
    addGeneratorScore(scoreboard, "grid_queries", 12, "GRID_QUERY_FORMAT", {
      ruleId: "grid_queries.detected",
      message: "检测到棋盘/矩阵输入并伴随多组坐标查询",
      source: features.formatHints.hasGridQueries ? "inputFormat" : "statement",
    }, {
      nMax: features.bounds.nMax,
      mMax: features.bounds.mMax,
      qMax: features.bounds.qMax,
    })
    scoreboard.pitfalls.add("MIN_BOUNDARY")
    scoreboard.pitfalls.add("MAX_BOUNDARY")
  }

  if (features.formatHints.hasIntervals || features.semanticHints.mentionsInterval || hasTag("区间", "interval")) {
    addScore(scoreboard.category, "INTERVAL_PROBLEM", 5)
    addScore(scoreboard.structure, "INTERVALS", 6)
    addGeneratorScore(scoreboard, "intervals", 8, "INTERVAL_KEYWORDS", {
      ruleId: "intervals.detected",
      message: "检测到区间类输入或关键词",
      source: features.formatHints.hasIntervals ? "inputFormat" : "statement",
    })
    scoreboard.pitfalls.add("HEAVY_OVERLAP")
  }

  if (features.formatHints.hasString || hasTag("字符串", "string")) {
    addScore(scoreboard.category, "STRING_PROCESSING", 5)
    addScore(scoreboard.structure, "STRING", 6)
    addGeneratorScore(scoreboard, "string", 8, "STRING_KEYWORDS", {
      ruleId: "string.detected",
      message: "检测到字符串类输入或标签",
      source: features.formatHints.hasString ? "inputFormat" : "tags",
    }, {
      nMax: features.bounds.nMax,
    })
    if (features.semanticHints.mentionsPalindrome) {
      scoreboard.pitfalls.add("PALINDROME_STRUCTURE")
    }
    if (features.semanticHints.mentionsSubstring) {
      scoreboard.pitfalls.add("REPEATED_PATTERN")
    }
  }

  if (features.formatHints.hasArray || hasTag("数组", "排序", "前缀和")) {
    addScore(scoreboard.category, "ARRAY_PROCESSING", 4)
    addScore(scoreboard.structure, "ARRAY", 5)
    addGeneratorScore(scoreboard, "array", 7, "ARRAY_LINE_DETECTED", {
      ruleId: "array.detected",
      message: "检测到数组/整数序列输入结构",
      source: features.formatHints.hasArray ? "inputFormat" : "tags",
    }, {
      nMax: features.bounds.nMax,
      valueMax: features.bounds.valueMax,
    })
    scoreboard.pitfalls.add("DUPLICATE_VALUES")
    if (features.semanticHints.mentionsSort) {
      scoreboard.pitfalls.add("STRICTLY_INCREASING")
      scoreboard.pitfalls.add("STRICTLY_DECREASING")
    }
  }

  if (features.formatHints.hasGraphEdges || features.semanticHints.mentionsGraph || hasTag("图", "graph")) {
    addScore(scoreboard.category, "GRAPH_PROBLEM", 6)
    addScore(scoreboard.structure, "GRAPH", 7)
    addGeneratorScore(scoreboard, "graph", 9, "GRAPH_EDGE_FORMAT", {
      ruleId: "graph.detected",
      message: "检测到图的边输入结构",
      source: features.formatHints.hasGraphEdges ? "inputFormat" : "statement",
    })
    scoreboard.pitfalls.add("DISCONNECTED_GRAPH")
    scoreboard.warnings.push("当前自动草稿尚未支持 graph generator，需要人工补充。")
  }

  if (features.formatHints.hasTreeEdges || features.semanticHints.mentionsTree || hasTag("树", "tree")) {
    addScore(scoreboard.category, "TREE_PROBLEM", 6)
    addScore(scoreboard.structure, "TREE", 7)
    addGeneratorScore(scoreboard, "tree", 9, "TREE_EDGE_FORMAT", {
      ruleId: "tree.detected",
      message: "检测到树结构输入或树类标签",
      source: features.formatHints.hasTreeEdges ? "inputFormat" : "statement",
    })
    scoreboard.pitfalls.add("CHAIN_TREE")
    scoreboard.pitfalls.add("STAR_TREE")
    scoreboard.warnings.push("当前自动草稿尚未支持 tree generator，需要人工补充。")
  }

  if (features.bounds.nMax && features.bounds.nMax >= 100000) {
    scoreboard.pitfalls.add("MAX_BOUNDARY")
    addEvidence("bounds.n.large", `检测到 n 上界约为 ${features.bounds.nMax}`, "constraints")
  }
  if (features.bounds.qMax && features.bounds.qMax >= 100000) {
    scoreboard.pitfalls.add("MAX_BOUNDARY")
    addEvidence("bounds.q.large", `检测到 q 上界约为 ${features.bounds.qMax}`, "constraints")
  }
  if ((features.bounds.nMax ?? 0) <= 3 || (features.bounds.qMax ?? 0) <= 3) {
    scoreboard.pitfalls.add("MIN_BOUNDARY")
  }
  if (scoreboard.category.size === 0) {
    addScore(scoreboard.category, "BASIC_IO", 1)
    addScore(scoreboard.structure, "SCALAR", 1)
    scoreboard.warnings.push("未命中明显题型规则，建议人工检查分析结果。")
  }

  return { scoreboard, features }
}

function buildSuggestedGroups(primary: GeneratorType | null, input: ProblemAnalysisInput, features: ReturnType<typeof extractProblemFeatures>): SuggestedGroup[] {
  if (!primary) return []

  const commonRisks: Pitfall[] = []
  if ((features.bounds.nMax ?? 0) >= 100000 || (features.bounds.qMax ?? 0) >= 100000) {
    commonRisks.push("MAX_BOUNDARY")
  }
  commonRisks.push("OFF_BY_ONE")

  switch (primary) {
    case "array":
      return [
        { key: "sample", kind: "SAMPLE", targetCount: 2, goal: "覆盖最小数组输入", recommendedGenerator: "array", paramsHint: { n: { min: 1, max: 5 } }, focusRisks: ["MIN_BOUNDARY"] },
        { key: "boundary", kind: "BOUNDARY", targetCount: 4, goal: "覆盖长度边界与重复值", recommendedGenerator: "array", paramsHint: { n: { values: [1, 2, 3] } }, focusRisks: ["DUPLICATE_VALUES", "MIN_BOUNDARY"] },
        { key: "random", kind: "RANDOM", targetCount: 6, goal: "覆盖一般随机数组", recommendedGenerator: "array", paramsHint: { n: { max: features.bounds.nMax ?? 1000 } }, focusRisks: [] },
        { key: "special", kind: "SPECIAL", targetCount: 3, goal: "覆盖单调或特殊排列", recommendedGenerator: "array", paramsHint: { sorted: true, sortOrder: "asc" }, focusRisks: ["STRICTLY_INCREASING", "STRICTLY_DECREASING"] },
        { key: "max", kind: "MAX", targetCount: 4, goal: "覆盖最大规模数组", recommendedGenerator: "array", paramsHint: { n: { max: features.bounds.nMax ?? 100000 } }, focusRisks: commonRisks },
      ]
    case "string":
      return [
        { key: "sample", kind: "SAMPLE", targetCount: 2, goal: "覆盖最短字符串", recommendedGenerator: "string", paramsHint: { length: { min: 1, max: 8 } }, focusRisks: ["MIN_BOUNDARY"] },
        { key: "boundary", kind: "BOUNDARY", targetCount: 4, goal: "覆盖极短串与重复字符", recommendedGenerator: "string", paramsHint: { patternMode: "repeated" }, focusRisks: ["REPEATED_PATTERN"] },
        { key: "random", kind: "RANDOM", targetCount: 6, goal: "覆盖随机字符串", recommendedGenerator: "string", paramsHint: { alphabet: "abcdefghijklmnopqrstuvwxyz" }, focusRisks: [] },
        { key: "special", kind: "SPECIAL", targetCount: 3, goal: "覆盖回文等特殊模式", recommendedGenerator: "string", paramsHint: { patternMode: "palindrome" }, focusRisks: ["PALINDROME_STRUCTURE"] },
        { key: "max", kind: "MAX", targetCount: 4, goal: "覆盖最大长度字符串", recommendedGenerator: "string", paramsHint: { length: { max: features.bounds.nMax ?? 100000 } }, focusRisks: commonRisks },
      ]
    case "intervals":
      return [
        { key: "sample", kind: "SAMPLE", targetCount: 2, goal: "覆盖最小区间集合", recommendedGenerator: "intervals", paramsHint: { count: { min: 1, max: 4 } }, focusRisks: ["MIN_BOUNDARY"] },
        { key: "boundary", kind: "BOUNDARY", targetCount: 4, goal: "覆盖不相交边界区间", recommendedGenerator: "intervals", paramsHint: { overlapMode: "disjoint" }, focusRisks: ["MIN_BOUNDARY"] },
        { key: "random", kind: "RANDOM", targetCount: 6, goal: "覆盖一般随机区间", recommendedGenerator: "intervals", paramsHint: { overlapMode: "random" }, focusRisks: [] },
        { key: "special", kind: "SPECIAL", targetCount: 4, goal: "覆盖大量重叠/嵌套区间", recommendedGenerator: "intervals", paramsHint: { overlapMode: "heavy-overlap" }, focusRisks: ["HEAVY_OVERLAP"] },
        { key: "max", kind: "MAX", targetCount: 4, goal: "覆盖最大规模区间", recommendedGenerator: "intervals", paramsHint: { count: { max: features.bounds.nMax ?? 50000 } }, focusRisks: commonRisks },
      ]
    case "queries":
      return [
        { key: "sample", kind: "SAMPLE", targetCount: 2, goal: "覆盖最小操作序列", recommendedGenerator: "queries", paramsHint: { n: { min: 1, max: 5 }, q: { min: 1, max: 5 } }, focusRisks: ["MIN_BOUNDARY"] },
        { key: "boundary", kind: "BOUNDARY", targetCount: 4, goal: "覆盖小规模边界操作", recommendedGenerator: "queries", paramsHint: { n: { values: [1, 2, 3] }, q: { values: [1, 2, 3, 8] } }, focusRisks: ["MIN_BOUNDARY"] },
        { key: "random", kind: "RANDOM", targetCount: 6, goal: "覆盖一般随机操作", recommendedGenerator: "queries", paramsHint: { n: { max: features.bounds.nMax ?? 100000 }, q: { max: features.bounds.qMax ?? 100000 } }, focusRisks: [] },
        { key: "special", kind: "SPECIAL", targetCount: 4, goal: "覆盖查询/更新偏置场景", recommendedGenerator: "queries", paramsHint: { queryHeavy: true }, focusRisks: ["LARGE_Q_SMALL_N", "LARGE_N_SMALL_Q"] },
        { key: "max", kind: "MAX", targetCount: 4, goal: "覆盖最大规模输入", recommendedGenerator: "queries", paramsHint: { n: { max: features.bounds.nMax ?? 100000 }, q: { max: features.bounds.qMax ?? 100000 } }, focusRisks: commonRisks },
      ]
    case "grid_queries":
      return [
        { key: "boundary", kind: "BOUNDARY", targetCount: 3, goal: "覆盖小棋盘与少量查询", recommendedGenerator: "grid_queries", paramsHint: { n: { values: [2, 3] }, m: { values: [2, 3] }, q: { values: [1, 2, 4] } }, focusRisks: ["MIN_BOUNDARY"] },
        { key: "random", kind: "RANDOM", targetCount: 4, goal: "覆盖一般棋盘随机查询", recommendedGenerator: "grid_queries", paramsHint: { n: { max: features.bounds.nMax ?? 30 }, m: { max: features.bounds.mMax ?? 30 }, q: { max: features.bounds.qMax ?? 1000 } }, focusRisks: [] },
        { key: "special", kind: "SPECIAL", targetCount: 2, goal: "覆盖稀疏可移动格局", recommendedGenerator: "grid_queries", paramsHint: { movableCellRatio: 0.55 }, focusRisks: ["MIN_BOUNDARY"] },
        { key: "max", kind: "MAX", targetCount: 3, goal: "覆盖最大棋盘和查询规模", recommendedGenerator: "grid_queries", paramsHint: { n: { max: features.bounds.nMax ?? 30 }, m: { max: features.bounds.mMax ?? 30 }, q: { max: features.bounds.qMax ?? 1000 } }, focusRisks: commonRisks },
      ]
    default:
      return []
  }
}

function buildDraft(
  primary: GeneratorType | null,
  features: ReturnType<typeof extractProblemFeatures>,
  options?: AutoDraftOptions
) {
  let draft: Record<string, unknown> | null
  switch (primary) {
    case "array":
      draft = buildArrayDraft(features.bounds)
      break
    case "string":
      draft = buildStringDraft(features.bounds)
      break
    case "intervals":
      draft = buildIntervalsDraft(features.bounds)
      break
    case "queries":
      draft = buildQueriesDraft(features.bounds, features.text.includes("min") || features.text.includes("max"))
      break
    case "grid_queries":
      draft = buildGridQueriesDraft(features.bounds)
      break
    default:
      draft = null
      break
  }

  if (!draft) {
    return null
  }

  if (!options?.testcaseCount) {
    return draft
  }

  return buildAutoCaseDraft(
    draft,
    options.testcaseCount,
    Number.isFinite(options.totalScore) ? Math.floor(options.totalScore as number) : 100
  )
}

export function analyzeProblemForTestdata(
  input: ProblemAnalysisInput,
  options?: AutoDraftOptions
): ProblemAnalysisBundle {
  const { scoreboard, features } = buildScoreboard(input)
  const sortedGenerators = [...scoreboard.generator.entries()]
    .sort((a, b) => b[1].score - a[1].score)
  const primaryGeneratorType = sortedGenerators[0]?.[0] ?? null
  const primaryGenerator = primaryGeneratorType
    ? toRecommendation(primaryGeneratorType, sortedGenerators[0][1])
    : null
  const secondaryGenerators = sortedGenerators
    .slice(1, 3)
    .map(([type, item]) => toRecommendation(type, item))

  const configDraft = buildDraft(primaryGeneratorType, features, options)
  if (!configDraft && primaryGeneratorType) {
    scoreboard.warnings.push(`主推荐 generator 为 ${primaryGeneratorType}，但当前系统尚未自动生成对应配置草稿。`)
  }

  const problemCategory = topEntries(scoreboard.category)
  const inputStructures = topEntries(scoreboard.structure)
  const likelyPitfalls = [...scoreboard.pitfalls]
  const suggestedGroups = buildSuggestedGroups(primaryGeneratorType, input, features)
  const reviewRequired =
    !configDraft ||
    !!primaryGeneratorType && (primaryGeneratorType === "graph" || primaryGeneratorType === "tree") ||
    (primaryGenerator?.score ?? 0) < 0.6 ||
    scoreboard.warnings.length > 0

  const analysis: ProblemAnalysisResult = {
    version: 1,
    summary: {
      problemCategory,
      inputStructures,
      likelyPitfalls,
    },
    recommendations: {
      primaryGenerator,
      secondaryGenerators,
      suggestedGroupPlan: {
        totalGroups: suggestedGroups.length,
        groups: suggestedGroups,
      },
    },
    confidence: {
      overall: primaryGenerator?.score ?? 0.2,
      category: Math.min(1, Number(((scoreboard.category.get(problemCategory[0] ?? "BASIC_IO") ?? 0) / 8).toFixed(2))),
      structure: Math.min(1, Number(((scoreboard.structure.get(inputStructures[0] ?? "SCALAR") ?? 0) / 8).toFixed(2))),
      generator: primaryGenerator?.score ?? 0.2,
    },
    evidence: scoreboard.evidence,
    warnings: scoreboard.warnings,
    reviewRequired,
  }

  return {
    analysis,
    configDraft,
  }
}
