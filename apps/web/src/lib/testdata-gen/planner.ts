import { createHash } from "crypto"
import type {
  CasePlan,
  GenerationGroupConfig,
  TestdataGenerationConfig,
} from "@/lib/testdata-gen/types"

function deriveCaseSeed(globalSeed: string, groupKey: string, ordinal: number) {
  return createHash("sha256")
    .update(`${globalSeed}:${groupKey}:${ordinal}`)
    .digest("hex")
    .slice(0, 24)
}

function buildCasePlan(
  group: GenerationGroupConfig,
  globalSeed: string,
  ordinal: number,
  indexInGroup: number
): CasePlan {
  return {
    ordinal,
    groupKey: group.key,
    groupTitle: group.title,
    score: group.score ?? 0,
    isSample: group.isSample ?? false,
    isPretest: group.isPretest ?? false,
    visible: group.visible ?? false,
    caseType: group.caseType ?? 1,
    subtaskId: group.subtaskId,
    groupId: group.groupId ?? group.key,
    orderIndex:
      group.orderIndexStart !== undefined
        ? group.orderIndexStart + indexInGroup
        : ordinal,
    caseSeed: deriveCaseSeed(globalSeed, group.key, ordinal),
    generator: group.generator,
  }
}

export function planTestdataCases(
  config: TestdataGenerationConfig,
  globalSeed: string
): CasePlan[] {
  let ordinal = 1
  const plans: CasePlan[] = []

  for (const group of config.groups) {
    for (let index = 0; index < group.count; index += 1) {
      plans.push(buildCasePlan(group, globalSeed, ordinal, index))
      ordinal += 1
    }
  }

  return plans
}
