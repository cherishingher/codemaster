import { z } from "zod"
import { createRandom, pickNumberFromRange } from "@/lib/testdata-gen/rng"
import type {
  GeneratedCase,
  GeneratorContext,
  IntervalsGeneratorParams,
  TestdataGenerator,
} from "@/lib/testdata-gen/types"

const IntervalsParamsSchema = z.object({
  count: z.object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    values: z.array(z.number().int()).min(1).optional(),
  }),
  left: z.object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    values: z.array(z.number().int()).min(1).optional(),
  }),
  right: z.object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    values: z.array(z.number().int()).min(1).optional(),
  }).optional(),
  length: z.object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    values: z.array(z.number().int()).min(1).optional(),
  }).optional(),
  overlapMode: z.enum(["random", "heavy-overlap", "disjoint", "nested"]).optional(),
})

export const intervalsGenerator: TestdataGenerator<IntervalsGeneratorParams> = {
  type: "intervals",
  validateParams(params: unknown) {
    return IntervalsParamsSchema.parse(params)
  },
  generate(context: GeneratorContext, params: IntervalsGeneratorParams): GeneratedCase {
    const random = createRandom(context.seed)
    const count = pickNumberFromRange(params.count, `${context.seed}:count`)
    const intervals: Array<[number, number]> = []
    const mode = params.overlapMode ?? "random"

    let baseLeft = pickNumberFromRange(params.left, `${context.seed}:base-left`)
    for (let index = 0; index < count; index += 1) {
      let left = pickNumberFromRange(params.left, `${context.seed}:left:${index}`)
      if (mode === "heavy-overlap" || mode === "nested") {
        left = baseLeft + random.int(0, 3)
      }
      if (mode === "disjoint") {
        left = baseLeft + index * 10
      }

      const right = params.length
        ? left + pickNumberFromRange(params.length, `${context.seed}:length:${index}`)
        : Math.max(left, pickNumberFromRange(params.right ?? params.left, `${context.seed}:right:${index}`))

      intervals.push(
        mode === "nested" ? [left, right + (count - index)] : [left, right]
      )
      if (mode === "random") {
        baseLeft = left
      }
    }

    const lines = intervals.map(([left, right]) => `${left} ${right}`)
    return {
      input: `${count}\n${lines.join("\n")}\n`,
      metadata: { count, overlapMode: mode },
    }
  },
}
