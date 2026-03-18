import { z } from "zod"
import { createRandom, pickNumberFromRange } from "@/lib/testdata-gen/rng"
import type {
  GeneratedCase,
  GeneratorContext,
  StringGeneratorParams,
  TestdataGenerator,
} from "@/lib/testdata-gen/types"

const StringParamsSchema = z.object({
  length: z.object({
    min: z.number().int().optional(),
    max: z.number().int().optional(),
    values: z.array(z.number().int()).min(1).optional(),
  }),
  alphabet: z.string().min(1).optional(),
  patternMode: z.enum(["random", "repeated", "palindrome"]).optional(),
  renderMode: z.enum(["string_only", "length_and_string"]).optional(),
})

export const stringGenerator: TestdataGenerator<StringGeneratorParams> = {
  type: "string",
  validateParams(params: unknown) {
    return StringParamsSchema.parse(params)
  },
  generate(context: GeneratorContext, params: StringGeneratorParams): GeneratedCase {
    const random = createRandom(context.seed)
    const length = pickNumberFromRange(params.length, `${context.seed}:length`)
    const alphabet = params.alphabet ?? "abcdefghijklmnopqrstuvwxyz"
    const patternMode = params.patternMode ?? "random"
    const chars = alphabet.split("")
    let content = ""

    if (patternMode === "repeated") {
      const tokenLength = Math.max(1, Math.min(4, chars.length))
      const token = Array.from({ length: tokenLength }, () => random.pick(chars)).join("")
      while (content.length < length) {
        content += token
      }
      content = content.slice(0, length)
    } else if (patternMode === "palindrome") {
      const half = Array.from({ length: Math.ceil(length / 2) }, () => random.pick(chars))
      const mirrored = [...half]
      const tail = length % 2 === 0 ? mirrored.reverse() : mirrored.slice(0, -1).reverse()
      content = half.join("") + tail.join("")
    } else {
      content = Array.from({ length }, () => random.pick(chars)).join("")
    }

    const renderMode = params.renderMode ?? "string_only"
    const input =
      renderMode === "length_and_string"
        ? `${length}\n${content}\n`
        : `${content}\n`

    return {
      input,
      metadata: { length, alphabetSize: chars.length, patternMode },
    }
  },
}
