import type { GeneratorConfig, TestdataGeneratorType } from "@/lib/testdata-gen/types"
import { arrayGenerator } from "@/lib/testdata-gen/generators/array"
import { stringGenerator } from "@/lib/testdata-gen/generators/string"
import { intervalsGenerator } from "@/lib/testdata-gen/generators/intervals"
import { queriesGenerator } from "@/lib/testdata-gen/generators/queries"
import { gridQueriesGenerator } from "@/lib/testdata-gen/generators/grid-queries"

const generators = {
  array: arrayGenerator,
  string: stringGenerator,
  intervals: intervalsGenerator,
  queries: queriesGenerator,
  grid_queries: gridQueriesGenerator,
} as const

export function getTestdataGenerator(type: TestdataGeneratorType) {
  return generators[type]
}

export function validateGeneratorConfig(config: GeneratorConfig) {
  const generator = getTestdataGenerator(config.type)
  return generator.validateParams(config.params)
}
