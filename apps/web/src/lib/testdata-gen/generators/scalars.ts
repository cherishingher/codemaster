import { z } from "zod"
import { pickNumberFromRange } from "@/lib/testdata-gen/rng"
import type {
  GeneratedCase,
  GeneratorContext,
  ScalarsGeneratorParams,
  TestdataGenerator,
} from "@/lib/testdata-gen/types"

const NumericRangeSchema = z.object({
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  values: z.array(z.number().int()).min(1).optional(),
})

const ScalarsParamsSchema = z.object({
  layout: z.array(z.number().int().positive()).min(1),
  value: NumericRangeSchema,
})

export const scalarsGenerator: TestdataGenerator<ScalarsGeneratorParams> = {
  type: "scalars",
  validateParams(params: unknown) {
    return ScalarsParamsSchema.parse(params)
  },
  generate(context: GeneratorContext, params: ScalarsGeneratorParams): GeneratedCase {
    const lines = params.layout.map((count, lineIndex) =>
      Array.from({ length: count }, (_, valueIndex) =>
        pickNumberFromRange(params.value, `${context.seed}:scalar:${lineIndex}:${valueIndex}`)
      ).join(" ")
    )

    return {
      input: `${lines.join("\n")}\n`,
      metadata: {
        lines: params.layout.length,
        layout: params.layout,
        totalValues: params.layout.reduce((sum, item) => sum + item, 0),
      },
    }
  },
}
