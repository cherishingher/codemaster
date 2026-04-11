import type { ExternalGeneratorParams, GeneratorConfig } from "@/lib/testdata-gen/types"
import { scalarsGenerator } from "@/lib/testdata-gen/generators/scalars"
import { arrayGenerator } from "@/lib/testdata-gen/generators/array"
import { stringGenerator } from "@/lib/testdata-gen/generators/string"
import { intervalsGenerator } from "@/lib/testdata-gen/generators/intervals"
import { queriesGenerator } from "@/lib/testdata-gen/generators/queries"
import { gridQueriesGenerator } from "@/lib/testdata-gen/generators/grid-queries"

const generators = {
  scalars: scalarsGenerator,
  array: arrayGenerator,
  string: stringGenerator,
  intervals: intervalsGenerator,
  queries: queriesGenerator,
  grid_queries: gridQueriesGenerator,
} as const

export function getTestdataGenerator(type: keyof typeof generators) {
  return generators[type]
}

export function validateGeneratorConfig(config: GeneratorConfig) {
  if (config.type === "external") {
    return config.params as ExternalGeneratorParams
  }
  const generator = getTestdataGenerator(config.type)
  return generator.validateParams(config.params)
}
