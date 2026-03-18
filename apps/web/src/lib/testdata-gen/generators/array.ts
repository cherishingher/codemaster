import { z } from "zod"
import { createRandom, pickNumberFromRange, resolveRangeBounds } from "@/lib/testdata-gen/rng"
import type {
  ArrayGeneratorParams,
  GeneratedCase,
  GeneratorContext,
  TestdataGenerator,
} from "@/lib/testdata-gen/types"

const ArrayParamsSchema = z.object({
  n: z.object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    values: z.array(z.number().int()).min(1).optional(),
  }),
  value: z.object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    values: z.array(z.number().int()).min(1).optional(),
  }),
  distinct: z.boolean().optional(),
  sorted: z.boolean().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  permutation: z.boolean().optional(),
  renderMode: z.enum(["count_and_values", "values_only"]).optional(),
})

export const arrayGenerator: TestdataGenerator<ArrayGeneratorParams> = {
  type: "array",
  validateParams(params: unknown) {
    return ArrayParamsSchema.parse(params)
  },
  generate(context: GeneratorContext, params: ArrayGeneratorParams): GeneratedCase {
    const random = createRandom(context.seed)
    const n = pickNumberFromRange(params.n, `${context.seed}:n`)
    const values: number[] = []

    if (params.permutation) {
      const permutation = Array.from({ length: n }, (_, index) => index + 1)
      for (let index = permutation.length - 1; index > 0; index -= 1) {
        const swapIndex = random.int(0, index)
        ;[permutation[index], permutation[swapIndex]] = [permutation[swapIndex], permutation[index]]
      }
      values.push(...permutation)
    } else {
      const bounds = resolveRangeBounds(params.value)
      const distinctValues = new Set<number>()
      for (let index = 0; index < n; index += 1) {
        let next = pickNumberFromRange(params.value, `${context.seed}:value:${index}`)
        if (params.distinct) {
          let guard = 0
          while (distinctValues.has(next)) {
            next = random.int(bounds.min, bounds.max)
            guard += 1
            if (guard > 5000) {
              throw new Error("array_distinct_value_space_exhausted")
            }
          }
          distinctValues.add(next)
        }
        values.push(next)
      }
    }

    if (params.sorted) {
      const direction = params.sortOrder === "desc" ? -1 : 1
      values.sort((left, right) => (left - right) * direction)
    }

    const renderMode = params.renderMode ?? "count_and_values"
    const input =
      renderMode === "values_only"
        ? `${values.join(" ")}\n`
        : `${n}\n${values.join(" ")}\n`

    return {
      input,
      metadata: { n, valuesCount: values.length },
    }
  },
}
