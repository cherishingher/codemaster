export type ProblemCategory =
  | "ARRAY_PROCESSING"
  | "STRING_PROCESSING"
  | "MATRIX_PROBLEM"
  | "GRAPH_PROBLEM"
  | "TREE_PROBLEM"
  | "INTERVAL_PROBLEM"
  | "QUERY_SIMULATION"
  | "BASIC_IO"

export type InputStructure =
  | "SCALAR"
  | "ARRAY"
  | "STRING"
  | "MATRIX"
  | "GRAPH"
  | "TREE"
  | "INTERVALS"
  | "QUERIES"
  | "COMPOSITE"

export type Pitfall =
  | "OFF_BY_ONE"
  | "MIN_BOUNDARY"
  | "MAX_BOUNDARY"
  | "DUPLICATE_VALUES"
  | "ALL_EQUAL_VALUES"
  | "STRICTLY_INCREASING"
  | "STRICTLY_DECREASING"
  | "HEAVY_OVERLAP"
  | "REPEATED_PATTERN"
  | "PALINDROME_STRUCTURE"
  | "LARGE_Q_SMALL_N"
  | "LARGE_N_SMALL_Q"
  | "DISCONNECTED_GRAPH"
  | "CHAIN_TREE"
  | "STAR_TREE"

export type GeneratorType = "array" | "string" | "graph" | "tree" | "intervals" | "queries"
  | "grid_queries"

export type ProblemAnalysisInput = {
  problemId?: string
  versionId?: string
  title?: string | null
  statement?: string | null
  statementMd?: string | null
  tags: string[]
  constraints?: string | null
  inputFormat?: string | null
  outputFormat?: string | null
}

export type RuleEvidence = {
  ruleId: string
  message: string
  source: "title" | "statement" | "statementMd" | "constraints" | "inputFormat" | "tags" | "derived"
}

export type GeneratorRecommendation = {
  type: GeneratorType
  score: number
  reasonCodes: string[]
  paramsHint?: Record<string, unknown>
}

export type SuggestedGroup = {
  key: string
  kind: "SAMPLE" | "BOUNDARY" | "RANDOM" | "SPECIAL" | "MAX"
  targetCount: number
  goal: string
  recommendedGenerator: GeneratorType
  paramsHint: Record<string, unknown>
  focusRisks: Pitfall[]
}

export type ProblemAnalysisResult = {
  version: 1
  summary: {
    problemCategory: ProblemCategory[]
    inputStructures: InputStructure[]
    likelyPitfalls: Pitfall[]
  }
  recommendations: {
    primaryGenerator: GeneratorRecommendation | null
    secondaryGenerators: GeneratorRecommendation[]
    suggestedGroupPlan: {
      totalGroups: number
      groups: SuggestedGroup[]
    }
  }
  confidence: {
    overall: number
    category: number
    structure: number
    generator: number
  }
  evidence: RuleEvidence[]
  warnings: string[]
  reviewRequired: boolean
}

export type ProblemAnalysisBundle = {
  analysis: ProblemAnalysisResult
  configDraft: Record<string, unknown> | null
}
