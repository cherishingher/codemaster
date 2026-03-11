import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createContentAccessEvaluator } from "@/server/modules/content-access/service"

type SolutionViewer = {
  id?: string | null
  roles?: string[]
}

const solutionListArgs = Prisma.validator<Prisma.SolutionDefaultArgs>()({
  select: {
    id: true,
    problemId: true,
    title: true,
    summary: true,
    content: true,
    templateType: true,
    type: true,
    visibility: true,
    accessLevel: true,
    isPremium: true,
    videoUrl: true,
    status: true,
    createdAt: true,
    author: {
      select: { id: true, name: true },
    },
    version: {
      select: { id: true, version: true },
    },
  },
})

type SolutionRecord = Prisma.SolutionGetPayload<typeof solutionListArgs>

const EXPOSED_VISIBILITIES = [
  "public",
  "vip",
  "member",
  "membership",
  "purchase",
  "paid",
  "protected",
  "member_or_purchase",
  "membership_or_purchase",
] as const

const EXPOSED_ACCESS_LEVELS = ["FREE", "MEMBERSHIP", "PURCHASE", "MEMBERSHIP_OR_PURCHASE"] as const

function buildPreviewContent(content: string | null, limit = 180) {
  if (!content) return null

  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!text) return null
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text
}

function resolveSummary(solution: Pick<SolutionRecord, "summary" | "content">) {
  return (typeof solution.summary === "string" ? solution.summary.trim() : "") || buildPreviewContent(solution.content) || null
}

function canExposeSolution(solution: Pick<SolutionRecord, "visibility" | "accessLevel" | "status">, isAdmin: boolean) {
  if (isAdmin) return true
  if (solution.status !== "published") return false

  const accessLevel =
    typeof solution.accessLevel === "string" ? solution.accessLevel.trim().toUpperCase() : ""
  if (accessLevel && EXPOSED_ACCESS_LEVELS.includes(accessLevel as (typeof EXPOSED_ACCESS_LEVELS)[number])) {
    return true
  }

  return EXPOSED_VISIBILITIES.includes(
    solution.visibility.trim().toLowerCase() as (typeof EXPOSED_VISIBILITIES)[number],
  )
}

function buildListWhere(problemId: string, isAdmin: boolean): Prisma.SolutionWhereInput {
  if (isAdmin) {
    return { problemId }
  }

  return {
    problemId,
    status: "published",
    OR: [
      {
        visibility: {
          in: [...EXPOSED_VISIBILITIES],
        },
      },
      {
        accessLevel: {
          in: [...EXPOSED_ACCESS_LEVELS],
        },
      },
    ],
  }
}

async function mapSolutionSummary(
  solution: SolutionRecord,
  evaluator: Awaited<ReturnType<typeof createContentAccessEvaluator>>,
) {
  const access = await evaluator.canAccessSolution({
    id: solution.id,
    problemId: solution.problemId,
    visibility: solution.visibility,
    accessLevel: solution.accessLevel,
    isPremium: solution.isPremium,
  })

  return {
    id: solution.id,
    title: solution.title,
    type: solution.type,
    visibility: solution.visibility,
    accessLevel: solution.accessLevel ?? null,
    isPremium: solution.isPremium,
    summary: resolveSummary(solution),
    previewContent: buildPreviewContent(solution.content),
    hasVideo: Boolean(solution.videoUrl),
    locked: !access.allowed,
    access,
    createdAt: solution.createdAt.toISOString(),
    author: solution.author,
    version: solution.version,
  }
}

function mapSolutionDetailBase(
  solution: SolutionRecord,
  summary: Awaited<ReturnType<typeof mapSolutionSummary>>,
) {
  return {
    ...summary,
    videoUrl: null as string | null,
    content: null as string | null,
  }
}

export async function listProblemSolutions(problemId: string, viewer?: SolutionViewer) {
  const normalizedViewer = {
    id: viewer?.id ?? null,
    roles: viewer?.roles ?? [],
  }
  const isAdmin = normalizedViewer.roles.includes("admin")
  const evaluator = await createContentAccessEvaluator(normalizedViewer)

  const solutions = await db.solution.findMany({
    where: buildListWhere(problemId, isAdmin),
    ...solutionListArgs,
    orderBy: [{ createdAt: "desc" }],
  })

  const visibleSolutions = solutions.filter((solution) => canExposeSolution(solution, isAdmin))

  return Promise.all(visibleSolutions.map((solution) => mapSolutionSummary(solution, evaluator)))
}

export async function getSolutionDetail(solutionId: string, viewer?: SolutionViewer) {
  const normalizedViewer = {
    id: viewer?.id ?? null,
    roles: viewer?.roles ?? [],
  }
  const isAdmin = normalizedViewer.roles.includes("admin")
  const evaluator = await createContentAccessEvaluator(normalizedViewer)

  const solution = await db.solution.findUnique({
    where: { id: solutionId },
    ...solutionListArgs,
  })

  if (!solution || !canExposeSolution(solution, isAdmin)) {
    return null
  }

  const summary = await mapSolutionSummary(solution, evaluator)
  const detail = mapSolutionDetailBase(solution, summary)

  if (summary.access.allowed) {
    detail.content = solution.content
    detail.videoUrl = solution.videoUrl
  }

  return detail
}
