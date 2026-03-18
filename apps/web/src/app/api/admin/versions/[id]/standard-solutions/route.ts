import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"
import { createStoredFileAsset } from "@/lib/file-assets"

const JsonPayloadSchema = z.object({
  source: z.string().min(1),
  language: z.string().min(1),
  label: z.string().min(1).optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().min(1).optional(),
})

const languageExtensions: Record<string, string> = {
  cpp11: "cpp",
  cpp14: "cpp",
  cpp17: "cpp",
  python: "py",
}

function resolveSourceFileName(language: string, label?: string | null) {
  const extension = languageExtensions[language] ?? "txt"
  const base = label?.trim().replace(/\s+/g, "-").toLowerCase() || "standard-solution"
  return `${base}.${extension}`
}

export const GET = withAuth(async (_req, { params }) => {
  const version = await db.problemVersion.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 })
  }

  const solutions = await db.standardSolution.findMany({
    where: { problemVersionId: params.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    include: {
      sourceAsset: {
        select: {
          id: true,
          uri: true,
          fileName: true,
          byteSize: true,
          checksumSha256: true,
        },
      },
    },
  })

  return NextResponse.json({
    items: solutions.map((solution) => ({
      id: solution.id,
      label: solution.label,
      language: solution.language,
      status: solution.status,
      isPrimary: solution.isPrimary,
      sourceHash: solution.sourceHash,
      notes: solution.notes,
      sourceAsset: solution.sourceAsset,
      lastVerifiedAt: solution.lastVerifiedAt,
      createdAt: solution.createdAt,
      updatedAt: solution.updatedAt,
    })),
  })
}, { roles: "admin" })

export const POST = withAuth(async (req, { params }, user) => {
  const version = await db.problemVersion.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 })
  }

  const contentType = req.headers.get("content-type") ?? ""
  let source: string
  let language: string
  let label: string | undefined
  let isPrimary = false
  let notes: string | undefined
  let fileName: string

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData()
    const file = form.get("file")
    const sourceText = form.get("source")
    language = String(form.get("language") ?? "").trim()
    label = String(form.get("label") ?? "").trim() || undefined
    notes = String(form.get("notes") ?? "").trim() || undefined
    isPrimary = String(form.get("isPrimary") ?? "").toLowerCase() === "true"

    if (file instanceof File) {
      source = Buffer.from(await file.arrayBuffer()).toString("utf8")
      fileName = file.name || resolveSourceFileName(language, label)
    } else if (typeof sourceText === "string" && sourceText.trim()) {
      source = sourceText
      fileName = resolveSourceFileName(language, label)
    } else {
      return NextResponse.json({ error: "source_file_required" }, { status: 400 })
    }
  } else {
    const payload = JsonPayloadSchema.parse(await req.json())
    source = payload.source
    language = payload.language
    label = payload.label
    isPrimary = payload.isPrimary ?? false
    notes = payload.notes
    fileName = resolveSourceFileName(language, label)
  }

  if (!languageExtensions[language]) {
    return NextResponse.json({ error: "unsupported_language" }, { status: 422 })
  }

  const sourceAsset = await createStoredFileAsset({
    prefix: "reference-solutions",
    fileName,
    content: source,
    kind: "SOURCE_CODE",
    mimeType: "text/plain",
    createdById: user.id,
    metadata: {
      language,
      versionId: params.id,
    } satisfies Prisma.InputJsonValue,
  })

  const created = await db.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.standardSolution.updateMany({
        where: { problemVersionId: params.id },
        data: { isPrimary: false },
      })
    }

    return tx.standardSolution.create({
      data: {
        problemVersionId: params.id,
        label: label ?? fileName,
        language,
        sourceAssetId: sourceAsset.id,
        sourceHash: sourceAsset.checksumSha256,
        status: "ACTIVE",
        isPrimary,
        notes,
        uploadedById: user.id,
      },
      include: {
        sourceAsset: {
          select: {
            id: true,
            uri: true,
            fileName: true,
            byteSize: true,
            checksumSha256: true,
          },
        },
      },
    })
  })

  return NextResponse.json({
    ok: true,
    solution: {
      id: created.id,
      problemVersionId: created.problemVersionId,
      label: created.label,
      language: created.language,
      status: created.status,
      isPrimary: created.isPrimary,
      sourceAsset: created.sourceAsset,
      uploadedById: created.uploadedById,
      createdAt: created.createdAt,
    },
  }, { status: 201 })
}, { roles: "admin" })

export const runtime = "nodejs"
