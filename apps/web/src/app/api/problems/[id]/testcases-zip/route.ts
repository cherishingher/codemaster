import { NextRequest, NextResponse } from "next/server"
import { getAuthUser, hasRole } from "@/lib/authz"
import { db } from "@/lib/db"
import { ProblemLifecycleStatus } from "@/lib/oj"
import { buildProblemIdentifierWhere } from "@/lib/problem-identifiers"
import { buildProblemTestcasePackage, ProblemTestcasePackageError } from "@/lib/problem-testcase-package"

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const { id: idOrSlug } = await Promise.resolve(ctx.params)
  const { searchParams } = new URL(req.url)
  const versionIdQuery = searchParams.get("versionId")?.trim()
  const versionNumberQuery = searchParams.get("version")?.trim()

  const problem = await db.problem.findFirst({
    where: buildProblemIdentifierWhere(idOrSlug),
    select: {
      id: true,
      slug: true,
      title: true,
      visible: true,
      defunct: true,
      status: true,
      visibility: true,
      currentVersionId: true,
    },
  })

  const user = await getAuthUser(req)
  const isAdmin = !!user && hasRole(user, "admin")

  if (
    !problem ||
    (!isAdmin &&
      (!problem.visible ||
        problem.defunct !== "N" ||
        problem.status < ProblemLifecycleStatus.PUBLISHED ||
        problem.visibility !== "public"))
  ) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  let versionWhere: { id?: string; problemId: string; version?: number } = { problemId: problem.id }
  if (isAdmin && versionIdQuery) {
    versionWhere = { problemId: problem.id, id: versionIdQuery }
  } else if (isAdmin && versionNumberQuery) {
    const version = Number(versionNumberQuery)
    if (Number.isFinite(version)) {
      versionWhere = { problemId: problem.id, version }
    }
  } else if (problem.currentVersionId) {
    versionWhere = { problemId: problem.id, id: problem.currentVersionId }
  }

  const version = await db.problemVersion.findFirst({
    where: versionWhere,
    orderBy: versionWhere.id || versionWhere.version ? undefined : { version: "desc" },
    select: {
      id: true,
      version: true,
      testcases: {
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          caseType: true,
          visible: true,
          score: true,
          groupId: true,
          isSample: true,
          orderIndex: true,
          inputUri: true,
          outputUri: true,
        },
      },
    },
  })

  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 })
  }

  try {
    const result = await buildProblemTestcasePackage({
      problem: {
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
      },
      version: {
        id: version.id,
        version: version.version,
      },
      testcases: version.testcases,
    })

    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(result.buffer.byteLength),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(result.fileName)}"; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof ProblemTestcasePackageError) {
      return NextResponse.json(
        {
          error: error.code,
          detail: error.message,
        },
        { status: error.status },
      )
    }
    return NextResponse.json(
      {
        error: "testcase_package_download_failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
