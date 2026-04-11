import { NextResponse } from "next/server"
import { z } from "zod"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"
import {
  buildCyaronFrameworkDraft,
  normalizeFrameworkTargetDir,
  scaffoldCyaronGenerator,
  type SupportedTestdataFramework,
} from "@/lib/testdata-framework"

const DraftSchema = z.object({
  framework: z.enum(["cyaron"]).default("cyaron"),
  testcaseCount: z.number().int().positive().max(200),
  totalScore: z.number().int().positive().max(10000).optional(),
  targetDir: z.string().min(1).optional(),
  scaffold: z.boolean().optional().default(true),
  force: z.boolean().optional().default(false),
})

export const POST = withAuth(async (req, { params }) => {
  try {
    const payload = DraftSchema.parse(await req.json())
    const version = await db.problemVersion.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        problem: {
          select: {
            id: true,
            slug: true,
            title: true,
            source: true,
          },
        },
      },
    })

    if (!version) {
      return NextResponse.json({ error: "version_not_found" }, { status: 404 })
    }

    const framework = payload.framework as SupportedTestdataFramework
    const targetDir = normalizeFrameworkTargetDir(payload.targetDir, version.problem)

    let scaffolded = false
    let scaffoldSkipped = false

    if (framework === "cyaron" && payload.scaffold) {
      const scaffoldResult = await scaffoldCyaronGenerator({
        problem: version.problem,
        targetDir,
        force: payload.force,
      })
      scaffolded = scaffoldResult.scaffolded
      scaffoldSkipped = scaffoldResult.skipped
    }

    const configDraft = buildCyaronFrameworkDraft({
      targetDir,
      testcaseCount: payload.testcaseCount,
      totalScore: payload.totalScore,
    })

    return NextResponse.json({
      ok: true,
      framework,
      targetDir,
      scaffolded,
      scaffoldSkipped,
      configDraft,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status =
      message === "framework_target_dir_invalid" || message === "equal_score_not_divisible"
        ? 422
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}, { roles: "admin" })

export const runtime = "nodejs"
