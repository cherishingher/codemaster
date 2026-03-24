import { parseTestdataGenerationConfig } from "@/lib/testdata-gen/config-schema"
import { planTestdataCases } from "@/lib/testdata-gen/planner"
import { scalarsGenerator } from "@/lib/testdata-gen/generators/scalars"
import { arrayGenerator } from "@/lib/testdata-gen/generators/array"
import { stringGenerator } from "@/lib/testdata-gen/generators/string"
import { intervalsGenerator } from "@/lib/testdata-gen/generators/intervals"
import { queriesGenerator } from "@/lib/testdata-gen/generators/queries"
import { gridQueriesGenerator } from "@/lib/testdata-gen/generators/grid-queries"
import type {
  CasePlan,
  GeneratedCase,
  TestdataGenerationConfig,
} from "@/lib/testdata-gen/types"

export {
  parseTestdataGenerationConfig,
  planTestdataCases,
  type CasePlan,
  type TestdataGenerationConfig,
}

export function generatePlannedCase(plan: CasePlan): GeneratedCase {
  switch (plan.generator.type) {
    case "scalars": {
      const params = scalarsGenerator.validateParams(plan.generator.params)
      return scalarsGenerator.generate({ seed: plan.caseSeed }, params)
    }
    case "array": {
      const params = arrayGenerator.validateParams(plan.generator.params)
      return arrayGenerator.generate({ seed: plan.caseSeed }, params)
    }
    case "string": {
      const params = stringGenerator.validateParams(plan.generator.params)
      return stringGenerator.generate({ seed: plan.caseSeed }, params)
    }
    case "intervals": {
      const params = intervalsGenerator.validateParams(plan.generator.params)
      return intervalsGenerator.generate({ seed: plan.caseSeed }, params)
    }
    case "queries": {
      const params = queriesGenerator.validateParams(plan.generator.params)
      return queriesGenerator.generate({ seed: plan.caseSeed }, params)
    }
    case "grid_queries": {
      const params = gridQueriesGenerator.validateParams(plan.generator.params)
      return gridQueriesGenerator.generate({ seed: plan.caseSeed }, params)
    }
  }
}

export function validateAndPlanTestdataConfig(
  input: unknown,
  globalSeed: string
): { config: TestdataGenerationConfig; plans: CasePlan[] } {
  const config = parseTestdataGenerationConfig(input)
  return {
    config,
    plans: planTestdataCases(config, globalSeed),
  }
}
