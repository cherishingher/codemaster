import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"
import { readStoredTextAssetByUri } from "@/lib/file-assets"
import { problemModeSupportsCode, resolveProblemAdminMode } from "@/lib/problem-admin"
import { analyzeProblemForTestdata } from "@/lib/problem-analysis"

const QuerySchema = z.object({
  testcaseCount: z.coerce.number().int().positive().max(200).optional(),
  totalScore: z.coerce.number().int().positive().max(10000).optional(),
  standardSolutionId: z.string().min(1).optional(),
})

export const GET = withAuth(async (req, { params }) => {
  const query = QuerySchema.safeParse({
    testcaseCount: req.nextUrl.searchParams.get("testcaseCount") ?? undefined,
    totalScore: req.nextUrl.searchParams.get("totalScore") ?? undefined,
    standardSolutionId: req.nextUrl.searchParams.get("standardSolutionId") ?? undefined,
  })
  if (!query.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 })
  }

  const version = await db.problemVersion.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      problemId: true,
      version: true,
      statement: true,
      statementMd: true,
      constraints: true,
      inputFormat: true,
      outputFormat: true,
      problem: {
        select: {
          id: true,
          title: true,
          tags: {
            include: { tag: true },
          },
        },
      },
    },
  })

  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 })
  }
  const problemMode = resolveProblemAdminMode({
    tags: version.problem.tags.map((item) => item.tag.name),
  })
  if (!problemModeSupportsCode(problemMode)) {
    return NextResponse.json(
      { error: "scratch_problem_not_supported", message: "Scratch 题不使用标准输入输出造数据流程。" },
      { status: 422 }
    )
  }

  let solutionSource: string | null = null
  let solutionLanguage: string | null = null
  if (query.data.standardSolutionId) {
    const standardSolution = await db.standardSolution.findUnique({
      where: { id: query.data.standardSolutionId },
      select: {
        problemVersionId: true,
        language: true,
        sourceAsset: {
          select: {
            uri: true,
          },
        },
      },
    })

    if (!standardSolution || standardSolution.problemVersionId !== params.id) {
      return NextResponse.json({ error: "standard_solution_not_found" }, { status: 404 })
    }

    solutionLanguage = standardSolution.language
    solutionSource = await readStoredTextAssetByUri(standardSolution.sourceAsset?.uri).catch(() => null)
  }

  const bundle = analyzeProblemForTestdata({
    problemId: version.problemId,
    versionId: version.id,
    title: version.problem.title,
    statement: version.statement,
    statementMd: version.statementMd,
    solutionSource,
    solutionLanguage,
    constraints: version.constraints,
    inputFormat: version.inputFormat,
    outputFormat: version.outputFormat,
    tags: version.problem.tags.map((item) => item.tag.name),
  }, query.data)

  return NextResponse.json(bundle)
}, { roles: "admin" })

export const runtime = "nodejs"
