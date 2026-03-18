import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"
import { parseTestdataGenerationConfig } from "@/lib/testdata-gen"

export const GET = withAuth(async (_req, { params }) => {
  const version = await db.problemVersion.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      version: true,
      problem: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
      testdataGenerationConfig: true,
    },
  })

  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 })
  }

  return NextResponse.json({
    id: version.id,
    version: version.version,
    problem: version.problem,
    testdataGenerationConfig: version.testdataGenerationConfig,
  })
}, { roles: "admin" })

export const PUT = withAuth(async (req, { params }) => {
  const version = await db.problemVersion.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 })
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "testdata_generation_config_invalid" }, { status: 400 })
  }

  const config = parseTestdataGenerationConfig(payload)

  await db.problemVersion.update({
    where: { id: params.id },
    data: {
      testdataGenerationConfig: config as Prisma.InputJsonValue,
    },
  })

  return NextResponse.json({
    ok: true,
    versionId: params.id,
    groups: config.groups.length,
  })
}, { roles: "admin" })
