import {
  type ScratchScoreByPartRuleSet,
  type ScratchRuleSet,
  type GroupRule,
  type BlockRule,
} from "./scratch-judge"
import { generateScratchRuleSet } from "./scratch-rules-gen"

type ScratchTarget = {
  name: string
  isStage?: boolean
}

type ScratchProject = {
  targets: ScratchTarget[]
}

export type ScratchRuleDraftPart = {
  id: string
  index: number
  title: string
  description: string
  role?: string
  score?: number
  ordered?: boolean
  consecutive?: boolean
}

export type ScratchRuleDraft = {
  version: 1
  mode: "score_by_part_draft"
  source: "statement"
  totalScore: number
  parts: ScratchRuleDraftPart[]
}

export type ScratchRuleDraftSeed = {
  statement?: string | null
  statementMd?: string | null
  tags?: string[] | null
  totalScore?: number
}

const SECTION_BREAKS = ["注意事项", "参考程序", "来源信息", "## 来源"]

const INIT_OPCODES = new Set([
  "motion_gotoxy",
  "motion_setx",
  "motion_sety",
  "motion_pointindirection",
  "motion_setrotationstyle",
  "looks_switchcostumeto",
  "looks_setsizeto",
  "looks_switchbackdropto",
  "looks_hide",
  "looks_show",
])

const CONTROL_OPCODES = new Set([
  "control_repeat",
  "control_repeat_until",
  "control_forever",
  "control_wait_until",
  "control_wait",
])

const TERMINAL_OPCODES = new Set([
  "control_stop",
  "looks_sayforsecs",
  "looks_hide",
  "looks_switchbackdropto",
  "motion_sety",
])

export function isScratchRuleDraft(value: unknown): value is ScratchRuleDraft {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { mode?: unknown }).mode === "score_by_part_draft" &&
      Array.isArray((value as { parts?: unknown }).parts)
  )
}

export function buildScratchRuleDraftFromStatement(
  statement: string,
  totalScore = 100
): ScratchRuleDraft {
  const statementBody = normalizeStatement(statement)
  const implementationSection = extractSection(statementBody, "功能实现", SECTION_BREAKS)
  const items = extractNumberedItems(implementationSection)
  if (!items.length) {
    throw new Error("scratch_statement_points_not_found")
  }

  const notesSection = extractSection(statementBody, "注意事项", ["参考程序", "来源信息", "## 来源"])
  const roleMap = parseRoleHints(notesSection)
  const scores = distributeScores(totalScore, items.length)

  return {
    version: 1,
    mode: "score_by_part_draft",
    source: "statement",
    totalScore,
    parts: items.map((item, index) => {
      const description = item.text.trim()
      const role = roleMap.get(item.index)
      return {
        id: `r${item.index}`,
        index: item.index,
        title: buildPartTitle(description, role, item.index),
        description,
        role,
        score: scores[index],
        ordered: /依次|先|后|然后|再|直到/.test(description),
        consecutive: /依次|然后|再等待|再切换|再以|之后/.test(description),
      } satisfies ScratchRuleDraftPart
    }),
  }
}

export function maybeBuildScratchRuleDraft(seed: ScratchRuleDraftSeed): ScratchRuleDraft | null {
  const statement = pickDraftStatement(seed.statementMd, seed.statement)
  if (!statement) return null
  if (!shouldAttemptScratchRuleDraft(statement, seed.tags)) return null

  try {
    return buildScratchRuleDraftFromStatement(statement, seed.totalScore ?? 100)
  } catch {
    return null
  }
}

export function resolveScratchRuleDraft(
  scratchRules: unknown,
  seed: ScratchRuleDraftSeed
): ScratchRuleDraft | null {
  if (isScratchRuleDraft(scratchRules)) {
    return scratchRules
  }
  return maybeBuildScratchRuleDraft(seed)
}

export function completeScratchRuleDraft(
  project: ScratchProject,
  draft: ScratchRuleDraft
): ScratchScoreByPartRuleSet {
  if (!project?.targets?.length) {
    throw new Error("project_invalid")
  }

  const partsByRole = new Map<string, ScratchRuleDraftPart[]>()
  for (const part of draft.parts) {
    const role = part.role ?? inferFallbackRole(project, part)
    if (!role) {
      throw new Error(`draft_part_role_missing:${part.id}`)
    }
    const list = partsByRole.get(role) ?? []
    list.push({ ...part, role })
    partsByRole.set(role, list)
  }

  const completedParts: ScratchScoreByPartRuleSet["parts"] = []
  for (const part of draft.parts) {
    const role = part.role ?? inferFallbackRole(project, part)
    if (!role) {
      throw new Error(`draft_part_role_missing:${part.id}`)
    }
    const roleParts = partsByRole.get(role)
    if (!roleParts) {
      throw new Error(`draft_role_not_found:${role}`)
    }
    if (completedParts.some((item) => item.id === part.id)) continue

    const generated = completeRoleParts(project, role, roleParts)
    completedParts.push(...generated)
  }

  completedParts.sort((a, b) => partIndex(a.id ?? "") - partIndex(b.id ?? ""))

  return {
    version: 1,
    mode: "score_by_part",
    totalScore: draft.totalScore,
    parts: completedParts,
  }
}

function normalizeStatement(statement: string) {
  return statement
    .replace(/^# .*\n+/m, "")
    .replace(/\r/g, "")
    .trim()
}

function pickDraftStatement(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim()
    }
  }
  return ""
}

function shouldAttemptScratchRuleDraft(statement: string, tags: string[] | null | undefined) {
  if (!/功能实现/.test(statement) || !/[（(]\d+[）)]/.test(statement)) {
    return false
  }

  const normalizedTags = (tags ?? [])
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  const hasScratchTag = normalizedTags.some((tag) =>
    ["scratch", "图形化编程", "图形化", "gesp", "一级"].includes(tag)
  )

  if (hasScratchTag) return true
  return /角色|背景|绿旗|造型|积木|舞台/.test(statement)
}

function extractSection(text: string, title: string, stops: string[]) {
  const startIndex = text.indexOf(title)
  if (startIndex < 0) return ""
  const contentStart = text.indexOf("：", startIndex) >= 0
    ? text.indexOf("：", startIndex) + 1
    : startIndex + title.length
  const tail = text.slice(contentStart)
  let endIndex = tail.length
  for (const stop of stops) {
    const hit = tail.indexOf(stop)
    if (hit >= 0 && hit < endIndex) {
      endIndex = hit
    }
  }
  return tail.slice(0, endIndex).trim()
}

function extractNumberedItems(section: string) {
  const normalized = section.replace(/\uF06C/g, "\n").trim()
  const regex = /[（(](\d+)[）)]/g
  const matches = [...normalized.matchAll(regex)]
  const items: Array<{ index: number; text: string }> = []
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    const start = (match.index ?? 0) + match[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length
    items.push({
      index: Number(match[1]),
      text: normalized.slice(start, end).replace(/\s*\n\s*/g, " ").trim(),
    })
  }
  return items
}

function parseRoleHints(notesSection: string) {
  const map = new Map<number, string>()
  for (const rawLine of notesSection.split(/\n+/)) {
    const line = rawLine.trim()
    if (!line) continue
    const indexes = [...line.matchAll(/[（(](\d+)[）)]/g)].map((item) => Number(item[1]))
    if (!indexes.length) continue

    let role: string | null = null
    if (/背景代码区/.test(line)) {
      role = "Stage"
    } else {
      const roleMatch =
        line.match(/角色\s*([A-Za-z0-9_-]+)\s*代码区/) ??
        line.match(/角色\s*([^\s（）()，。,]+)\s*代码区/)
      if (roleMatch?.[1]) {
        role = roleMatch[1]
      }
    }

    if (!role) continue
    for (const index of indexes) {
      map.set(index, role)
    }
  }
  return map
}

function distributeScores(totalScore: number, count: number) {
  const total = Number.isFinite(totalScore) && totalScore > 0 ? Math.floor(totalScore) : count
  const base = Math.floor(total / count)
  let remainder = total % count
  return Array.from({ length: count }, () => {
    const score = base + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
    return score
  })
}

function buildPartTitle(description: string, role: string | undefined, index: number) {
  const prefix = role ? `${role} ` : ""
  const compact = description.replace(/\s+/g, " ").trim()
  return `${prefix}${compact.slice(0, 32) || `part ${index}`}`
}

function inferFallbackRole(project: ScratchProject, part: ScratchRuleDraftPart) {
  if (/背景|舞台/.test(part.description)) return "Stage"
  const spriteTargets = project.targets.filter((target) => !target.isStage)
  if (spriteTargets.length === 1) return spriteTargets[0].name
  return null
}

function completeRoleParts(
  project: ScratchProject,
  role: string,
  roleParts: ScratchRuleDraftPart[]
) {
  const ruleSet = generateScratchRuleSet(project as Parameters<typeof generateScratchRuleSet>[0], {
    role,
    substackMode: "unordered",
  })
  if (!ruleSet.scripts.length) {
    throw new Error(`draft_role_script_missing:${role}`)
  }

  if (ruleSet.scripts.length > 1) {
    return completeMultiScriptRole(role, roleParts, ruleSet)
  }

  const script = ruleSet.scripts[0]
  const primaryGroup = script.groups[0] ?? { mode: "ordered", blocks: [] as BlockRule[] }
  const units = splitBlocksIntoUnits(primaryGroup.blocks)
  if (!units.length) {
    throw new Error(`draft_role_units_empty:${role}`)
  }

  let cursor = 0
  return roleParts.map((part, index) => {
    const remainingParts = roleParts.length - index
    const selectedUnitCount = decideUnitCount(part, units, cursor, remainingParts)
    const selectedUnits = units.slice(cursor, cursor + selectedUnitCount)
    cursor += selectedUnitCount
    if (!selectedUnits.length) {
      throw new Error(`draft_part_units_empty:${part.id}`)
    }

    const allBlocks = selectedUnits.flatMap((unit) => unit.blocks)
    const groupMode = resolvePartGroupMode(part, selectedUnits, allBlocks, primaryGroup.mode)
    const completedRule: ScratchRuleSet = {
      role,
      scripts: [
        {
          hat: script.hat,
          groups: [
            {
              mode: groupMode,
              blocks: allBlocks,
            },
          ],
        },
      ],
    }

    return {
      id: part.id,
      title: part.title,
      role,
      score: part.score ?? 0,
      rule: completedRule,
    }
  })
}

function completeMultiScriptRole(
  role: string,
  roleParts: ScratchRuleDraftPart[],
  ruleSet: ScratchRuleSet
) {
  let scriptCursor = 0
  return roleParts.map((part, index) => {
    const remainingScripts = ruleSet.scripts.length - scriptCursor
    const remainingParts = roleParts.length - index
    const takeCount = remainingParts === 1 ? remainingScripts : 1
    const scripts = ruleSet.scripts.slice(scriptCursor, scriptCursor + takeCount)
    scriptCursor += takeCount
    return {
      id: part.id,
      title: part.title,
      role,
      score: part.score ?? 0,
      rule: {
        role,
        scripts,
      },
    }
  })
}

type ScriptUnit = {
  kind: "init" | "control" | "terminal" | "trigger" | "other"
  blocks: BlockRule[]
}

function splitBlocksIntoUnits(blocks: BlockRule[]) {
  const units: ScriptUnit[] = []
  let cursor = 0

  const initBlocks: BlockRule[] = []
  while (cursor < blocks.length && isInitBlock(blocks[cursor])) {
    initBlocks.push(blocks[cursor])
    cursor += 1
  }
  if (initBlocks.length) {
    units.push({ kind: "init", blocks: initBlocks })
  }

  while (cursor < blocks.length) {
    const current = blocks[cursor]
    const next = blocks[cursor + 1]

    if (
      current.opcode === "control_wait_until" &&
      next &&
      (next.opcode === "looks_show" || next.opcode === "looks_switchcostumeto")
    ) {
      const grouped = [current]
      cursor += 1
      while (cursor < blocks.length && ["looks_show", "looks_switchcostumeto"].includes(blocks[cursor].opcode)) {
        grouped.push(blocks[cursor])
        cursor += 1
      }
      units.push({ kind: "trigger", blocks: grouped })
      continue
    }

    if (
      current.opcode === "control_wait" &&
      next &&
      (CONTROL_OPCODES.has(next.opcode) || next.opcode === "looks_switchcostumeto")
    ) {
      const grouped = [current, next]
      cursor += 2
      units.push({ kind: "control", blocks: grouped })
      continue
    }

    if (
      TERMINAL_OPCODES.has(current.opcode) &&
      next &&
      TERMINAL_OPCODES.has(next.opcode)
    ) {
      units.push({ kind: "terminal", blocks: [current, next] })
      cursor += 2
      continue
    }

    units.push({
      kind: classifyUnitKind(current),
      blocks: [current],
    })
    cursor += 1
  }

  return units
}

function isInitBlock(block: BlockRule) {
  return INIT_OPCODES.has(block.opcode)
}

function classifyUnitKind(block: BlockRule): ScriptUnit["kind"] {
  if (CONTROL_OPCODES.has(block.opcode)) return "control"
  if (TERMINAL_OPCODES.has(block.opcode)) return "terminal"
  return "other"
}

function decideUnitCount(
  part: ScratchRuleDraftPart,
  units: ScriptUnit[],
  cursor: number,
  remainingParts: number
) {
  const remainingUnits = units.length - cursor
  if (remainingParts <= 1) return remainingUnits
  if (remainingUnits <= remainingParts) return 1

  const current = units[cursor]
  const next = units[cursor + 1]
  const lower = part.description

  if (current?.kind === "init") return 1
  if (/之后|然后|恢复|等待|依次|再/.test(lower) && next) {
    if (current?.kind === "control" && next.kind === "control") return 2
    if (current?.blocks[0]?.opcode === "control_wait" && next.kind === "control") return 2
    if (current?.kind === "trigger" && next.kind !== "init") return 2
    if (current?.kind === "terminal" && next.kind === "terminal") return 2
  }
  if (/并且|同时|一边/.test(lower) && next && next.kind !== "init") {
    return 2
  }

  return 1
}

function resolvePartGroupMode(
  part: ScratchRuleDraftPart,
  units: ScriptUnit[],
  blocks: BlockRule[],
  fallbackMode: GroupRule["mode"] | undefined
): GroupRule["mode"] {
  if (units.every((unit) => unit.kind === "init")) return "unordered"
  if (part.consecutive || units.length > 1 && /之后|然后|再|依次|直到/.test(part.description)) {
    return "ordered_consecutive"
  }
  if (part.ordered) return "ordered"
  return fallbackMode ?? "ordered"
}

function partIndex(id: string) {
  const match = id.match(/(\d+)/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}
