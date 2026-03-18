import { z } from "zod"
import type { TestdataGenerationConfig } from "@/lib/testdata-gen/types"

const NumericRangeSchema = z
  .object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    values: z.array(z.number().int()).min(1).optional(),
  })
  .refine((value) => value.values?.length || value.min !== undefined || value.max !== undefined, {
    message: "numeric range requires values or min/max",
  })
  .refine((value) => {
    if (value.values?.length) return true
    if (value.min === undefined || value.max === undefined) return false
    return value.min <= value.max
  }, {
    message: "numeric range min/max invalid",
  })

const ArrayGeneratorSchema = z.object({
  type: z.literal("array"),
  params: z.object({
    n: NumericRangeSchema,
    value: NumericRangeSchema,
    distinct: z.boolean().optional(),
    sorted: z.boolean().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    permutation: z.boolean().optional(),
    renderMode: z.enum(["count_and_values", "values_only"]).optional(),
  }),
})

const StringGeneratorSchema = z.object({
  type: z.literal("string"),
  params: z.object({
    length: NumericRangeSchema,
    alphabet: z.string().min(1).optional(),
    patternMode: z.enum(["random", "repeated", "palindrome"]).optional(),
    renderMode: z.enum(["string_only", "length_and_string"]).optional(),
  }),
})

const IntervalsGeneratorSchema = z.object({
  type: z.literal("intervals"),
  params: z.object({
    count: NumericRangeSchema,
    left: NumericRangeSchema,
    right: NumericRangeSchema.optional(),
    length: NumericRangeSchema.optional(),
    overlapMode: z.enum(["random", "heavy-overlap", "disjoint", "nested"]).optional(),
  }),
})

const QueryTemplateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("point_set"),
    op: z.string().min(1).optional(),
    weight: z.number().positive().optional(),
    value: NumericRangeSchema,
  }),
  z.object({
    kind: z.literal("range_add"),
    op: z.string().min(1).optional(),
    weight: z.number().positive().optional(),
    value: NumericRangeSchema,
  }),
  z.object({
    kind: z.literal("range_sum"),
    op: z.string().min(1).optional(),
    weight: z.number().positive().optional(),
  }),
  z.object({
    kind: z.literal("range_min"),
    op: z.string().min(1).optional(),
    weight: z.number().positive().optional(),
  }),
  z.object({
    kind: z.literal("range_max"),
    op: z.string().min(1).optional(),
    weight: z.number().positive().optional(),
  }),
])

const QueriesGeneratorSchema = z.object({
  type: z.literal("queries"),
  params: z.object({
    n: NumericRangeSchema,
    q: NumericRangeSchema,
    initialValue: NumericRangeSchema,
    queryTemplates: z.array(QueryTemplateSchema).min(1),
  }),
})

const GridQueriesGeneratorSchema = z.object({
  type: z.literal("grid_queries"),
  params: z.object({
    n: NumericRangeSchema,
    m: NumericRangeSchema,
    q: NumericRangeSchema,
    blockedValue: z.number().int().optional(),
    movableValue: z.number().int().optional(),
    movableCellRatio: z.number().positive().max(1).optional(),
    maxMovableCells: z.number().int().positive().optional(),
    queryArity: z.number().int().positive().optional(),
    distinctCoordinatePairs: z.boolean().optional(),
  }),
})

const GeneratorSchema = z.discriminatedUnion("type", [
  ArrayGeneratorSchema,
  StringGeneratorSchema,
  IntervalsGeneratorSchema,
  QueriesGeneratorSchema,
  GridQueriesGeneratorSchema,
])

const GenerationGroupSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1).optional(),
  count: z.number().int().positive(),
  score: z.number().int().min(0).optional(),
  isSample: z.boolean().optional(),
  isPretest: z.boolean().optional(),
  visible: z.boolean().optional(),
  caseType: z.number().int().positive().optional(),
  subtaskId: z.number().int().positive().optional(),
  groupId: z.string().min(1).optional(),
  orderIndexStart: z.number().int().positive().optional(),
  generator: GeneratorSchema,
})

export const TestdataGenerationConfigSchema = z.object({
  version: z.literal(1),
  groups: z.array(GenerationGroupSchema).min(1),
})

export function parseTestdataGenerationConfig(
  value: unknown
): TestdataGenerationConfig {
  return TestdataGenerationConfigSchema.parse(value)
}
