import { z } from "zod"
import { createRandom, pickNumberFromRange } from "@/lib/testdata-gen/rng"
import type {
  GeneratedCase,
  GeneratorContext,
  QueriesGeneratorParams,
  QueryTemplate,
  TestdataGenerator,
} from "@/lib/testdata-gen/types"

const NumericRangeSchema = z.object({
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  values: z.array(z.number().int()).min(1).optional(),
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

const QueriesParamsSchema = z.object({
  n: NumericRangeSchema,
  q: NumericRangeSchema,
  initialValue: NumericRangeSchema,
  queryTemplates: z.array(QueryTemplateSchema).min(1),
})

function pickTemplate(
  random: ReturnType<typeof createRandom>,
  templates: QueryTemplate[]
) {
  const totalWeight = templates.reduce((sum, item) => sum + (item.weight ?? 1), 0)
  let ticket = random.float() * totalWeight
  for (const template of templates) {
    ticket -= template.weight ?? 1
    if (ticket <= 0) {
      return template
    }
  }
  return templates[templates.length - 1]
}

export const queriesGenerator: TestdataGenerator<QueriesGeneratorParams> = {
  type: "queries",
  validateParams(params: unknown) {
    return QueriesParamsSchema.parse(params)
  },
  generate(context: GeneratorContext, params: QueriesGeneratorParams): GeneratedCase {
    const random = createRandom(context.seed)
    const n = pickNumberFromRange(params.n, `${context.seed}:n`)
    const q = pickNumberFromRange(params.q, `${context.seed}:q`)
    const initial = Array.from({ length: n }, (_, index) =>
      pickNumberFromRange(params.initialValue, `${context.seed}:initial:${index}`)
    )
    const lines = [`${n} ${q}`, initial.join(" ")]

    for (let index = 0; index < q; index += 1) {
      const template = pickTemplate(random, params.queryTemplates)
      const left = random.int(1, n)
      const right = random.int(left, n)

      switch (template.kind) {
        case "point_set": {
          const value = pickNumberFromRange(template.value, `${context.seed}:point-set:${index}`)
          lines.push(`${template.op ?? "SET"} ${left} ${value}`)
          break
        }
        case "range_add": {
          const value = pickNumberFromRange(template.value, `${context.seed}:range-add:${index}`)
          lines.push(`${template.op ?? "ADD"} ${left} ${right} ${value}`)
          break
        }
        case "range_sum":
          lines.push(`${template.op ?? "SUM"} ${left} ${right}`)
          break
        case "range_min":
          lines.push(`${template.op ?? "MIN"} ${left} ${right}`)
          break
        case "range_max":
          lines.push(`${template.op ?? "MAX"} ${left} ${right}`)
          break
      }
    }

    return {
      input: `${lines.join("\n")}\n`,
      metadata: { n, q, queryTemplateCount: params.queryTemplates.length },
    }
  },
}
