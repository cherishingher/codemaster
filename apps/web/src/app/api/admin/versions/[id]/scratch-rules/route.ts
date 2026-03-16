import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"
import {
  evaluateScratchProject,
  isSupportedScratchRuleSet,
  type ScratchAnyRuleSet,
} from "@/lib/scratch-judge"
import { parseScratchProjectFile } from "@/lib/scratch-project"
import {
  completeScratchRuleDraft,
  isScratchRuleDraft,
  resolveScratchRuleDraft,
  type ScratchRuleDraft,
} from "@/lib/scratch-rule-draft"

export const runtime = "nodejs"

const VERSION_SELECT = {
  id: true,
  version: true,
  statement: true,
  statementMd: true,
  scratchRules: true,
  problem: {
    select: {
      id: true,
      slug: true,
      title: true,
      tags: {
        select: {
          tag: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProblemVersionSelect

type ScratchVersionRecord = Prisma.ProblemVersionGetPayload<{
  select: typeof VERSION_SELECT
}>

function normalizeScratchRulesInput(value: unknown) {
  if (value && typeof value === "object" && "scratchRules" in value) {
    return (value as { scratchRules?: unknown }).scratchRules ?? null
  }
  return value ?? null
}

async function findVersion(id: string) {
  return db.problemVersion.findUnique({
    where: { id },
    select: VERSION_SELECT,
  })
}

function deriveScratchRuleDraft(version: ScratchVersionRecord) {
  return resolveScratchRuleDraft(version.scratchRules, {
    statement: version.statement,
    statementMd: version.statementMd,
    tags: version.problem.tags.map((item) => item.tag.name),
  })
}

function resolveStoredOrDerivedScratchRules(version: ScratchVersionRecord) {
  return version.scratchRules ?? deriveScratchRuleDraft(version)
}

function isScratchRulePayload(
  value: unknown
): value is ScratchAnyRuleSet | ScratchRuleDraft {
  return isSupportedScratchRuleSet(value) || isScratchRuleDraft(value)
}

function resolveScratchRuleKind(rules: ScratchAnyRuleSet | ScratchRuleDraft) {
  if ("mode" in rules && rules.mode === "score_by_part_draft") return "draft"
  if ("mode" in rules && rules.mode === "score_by_part") return "score_by_part"
  if ("rules" in rules) return "score"
  return "plain"
}

export const GET = withAuth(
  async (_req, { params }) => {
    const version = await findVersion(params.id)
    if (!version) {
      return NextResponse.json({ error: "version_not_found" }, { status: 404 })
    }

    return NextResponse.json({
      id: version.id,
      version: version.version,
      problem: {
        id: version.problem.id,
        slug: version.problem.slug,
        title: version.problem.title,
      },
      scratchRules: resolveStoredOrDerivedScratchRules(version),
    })
  },
  { roles: "admin" }
)

export const PUT = withAuth(
  async (req, { params }) => {
    const version = await findVersion(params.id)
    if (!version) {
      return NextResponse.json({ error: "version_not_found" }, { status: 404 })
    }

    let payload: unknown
    try {
      payload = await req.json()
    } catch {
      return NextResponse.json({ error: "scratch_rules_payload_invalid" }, { status: 400 })
    }

    const scratchRules = normalizeScratchRulesInput(payload)
    if (scratchRules !== null && !isScratchRulePayload(scratchRules)) {
      return NextResponse.json({ error: "scratch_rules_invalid" }, { status: 400 })
    }

    await db.problemVersion.update({
      where: { id: version.id },
      data: {
        scratchRules: scratchRules === null
          ? Prisma.DbNull
          : scratchRules as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({
      ok: true,
      versionId: version.id,
      hasScratchRules: scratchRules !== null,
      ruleKind: scratchRules === null ? null : resolveScratchRuleKind(scratchRules),
    })
  },
  { roles: "admin" }
)

export const POST = withAuth(
  async (req, { params }) => {
    const version = await findVersion(params.id)
    if (!version) {
      return NextResponse.json({ error: "version_not_found" }, { status: 404 })
    }

    const form = await req.formData()
    const file = form.get("answer")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "answer_file_required" }, { status: 400 })
    }

    let scratchRules: unknown = resolveStoredOrDerivedScratchRules(version)
    const scratchRulesText = form.get("scratchRules")
    const hasScratchRulesOverride =
      typeof scratchRulesText === "string" && Boolean(scratchRulesText.trim())
    const usedStoredDraft = isScratchRuleDraft(version.scratchRules)
    const usedDerivedDraft = !version.scratchRules && isScratchRuleDraft(scratchRules)
    if (hasScratchRulesOverride) {
      try {
        scratchRules = JSON.parse(scratchRulesText as string)
      } catch {
        return NextResponse.json({ error: "scratch_rules_json_invalid" }, { status: 400 })
      }
    }

    if (!scratchRules) {
      return NextResponse.json({ error: "scratch_rules_not_configured" }, { status: 400 })
    }
    if (!isScratchRulePayload(scratchRules)) {
      return NextResponse.json({ error: "scratch_rules_invalid" }, { status: 400 })
    }

    const project = await parseScratchProjectFile(file)
    if (!project) {
      return NextResponse.json({ error: "scratch_project_invalid" }, { status: 400 })
    }

    let effectiveRules: ScratchAnyRuleSet
    if (isScratchRuleDraft(scratchRules)) {
      try {
        effectiveRules = completeScratchRuleDraft(project, scratchRules)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "scratch_draft_completion_failed"
        return NextResponse.json({ error: message }, { status: 400 })
      }
    } else {
      effectiveRules = scratchRules
    }

    const result = evaluateScratchProject(
      project as Parameters<typeof evaluateScratchProject>[0],
      effectiveRules
    )
    return NextResponse.json({
      ok: true,
      versionId: version.id,
      status: result.status,
      score: result.score,
      total: result.total,
      passed: result.passed,
      errors: result.errors,
      ruleKind: resolveScratchRuleKind(effectiveRules),
      completedFromDraft: isScratchRuleDraft(scratchRules),
      draftSource: isScratchRuleDraft(scratchRules)
        ? hasScratchRulesOverride
          ? "request"
          : usedStoredDraft
          ? "stored"
          : usedDerivedDraft
            ? "statement"
            : "request"
        : null,
    })
  },
  { roles: "admin" }
)
