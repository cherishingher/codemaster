export type NumericRangeSpec = {
  min?: number
  max?: number
  values?: number[]
}

export type TestdataGeneratorType =
  | "array"
  | "string"
  | "intervals"
  | "queries"
  | "grid_queries"

export type ArrayGeneratorParams = {
  n: NumericRangeSpec
  value: NumericRangeSpec
  distinct?: boolean
  sorted?: boolean
  sortOrder?: "asc" | "desc"
  permutation?: boolean
  renderMode?: "count_and_values" | "values_only"
}

export type StringGeneratorParams = {
  length: NumericRangeSpec
  alphabet?: string
  patternMode?: "random" | "repeated" | "palindrome"
  renderMode?: "string_only" | "length_and_string"
}

export type IntervalsGeneratorParams = {
  count: NumericRangeSpec
  left: NumericRangeSpec
  right?: NumericRangeSpec
  length?: NumericRangeSpec
  overlapMode?: "random" | "heavy-overlap" | "disjoint" | "nested"
}

export type QueryTemplate =
  | {
      kind: "point_set"
      op?: string
      weight?: number
      value: NumericRangeSpec
    }
  | {
      kind: "range_add"
      op?: string
      weight?: number
      value: NumericRangeSpec
    }
  | {
      kind: "range_sum" | "range_min" | "range_max"
      op?: string
      weight?: number
    }

export type QueriesGeneratorParams = {
  n: NumericRangeSpec
  q: NumericRangeSpec
  initialValue: NumericRangeSpec
  queryTemplates: QueryTemplate[]
}

export type GridQueriesGeneratorParams = {
  n: NumericRangeSpec
  m: NumericRangeSpec
  q: NumericRangeSpec
  blockedValue?: number
  movableValue?: number
  movableCellRatio?: number
  maxMovableCells?: number
  queryArity?: number
  distinctCoordinatePairs?: boolean
}

export type GeneratorConfig =
  | { type: "array"; params: ArrayGeneratorParams }
  | { type: "string"; params: StringGeneratorParams }
  | { type: "intervals"; params: IntervalsGeneratorParams }
  | { type: "queries"; params: QueriesGeneratorParams }
  | { type: "grid_queries"; params: GridQueriesGeneratorParams }

export type GenerationGroupConfig = {
  key: string
  title?: string
  count: number
  score?: number
  isSample?: boolean
  isPretest?: boolean
  visible?: boolean
  caseType?: number
  subtaskId?: number
  groupId?: string
  orderIndexStart?: number
  generator: GeneratorConfig
}

export type TestdataGenerationConfig = {
  version: 1
  groups: GenerationGroupConfig[]
}

export type CasePlan = {
  ordinal: number
  groupKey: string
  groupTitle?: string
  score: number
  isSample: boolean
  isPretest: boolean
  visible: boolean
  caseType: number
  subtaskId?: number
  groupId?: string
  orderIndex?: number
  caseSeed: string
  generator: GeneratorConfig
}

export type GeneratorContext = {
  seed: string
}

export type GeneratedCase = {
  input: string
  metadata?: Record<string, unknown>
}

export interface TestdataGenerator<TParams> {
  readonly type: TestdataGeneratorType
  validateParams(params: unknown): TParams
  generate(context: GeneratorContext, params: TParams): GeneratedCase
}
