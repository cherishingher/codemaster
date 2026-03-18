import path from "path"
import { mkdir, writeFile } from "fs/promises"
import { createHash, randomUUID } from "crypto"
import type { FileAssetKind, Prisma } from "@prisma/client"
import { db } from "../db.js"

const baseDir = process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "storage")

function normalizeExtension(extension?: string) {
  if (!extension) return ""
  return extension.startsWith(".") ? extension : `.${extension}`
}

export async function storeBufferAsset(
  prefix: string,
  content: Buffer | Uint8Array | string,
  options: { extension?: string; encoding?: BufferEncoding } = {}
) {
  const dir = path.join(baseDir, prefix)
  await mkdir(dir, { recursive: true })
  const extension = normalizeExtension(options.extension)
  const filename = `${prefix}-${randomUUID()}${extension || ".txt"}`
  const filepath = path.join(dir, filename)
  await writeFile(filepath, content, typeof content === "string" ? (options.encoding ?? "utf8") : undefined)
  return {
    uri: `file://${filepath}`,
    fileName: filename,
  }
}

function resolveByteSize(content: Buffer | Uint8Array | string) {
  return typeof content === "string" ? Buffer.byteLength(content, "utf8") : content.byteLength
}

export async function createStoredFileAsset(options: {
  prefix: string
  fileName: string
  content: Buffer | Uint8Array | string
  kind: FileAssetKind
  mimeType?: string | null
  createdById?: string | null
  extension?: string
  metadata?: Prisma.InputJsonValue
}) {
  const extension = normalizeExtension(options.extension || path.extname(options.fileName))
  const stored = await storeBufferAsset(options.prefix, options.content, {
    extension,
    encoding: "utf8",
  })

  return db.fileAsset.create({
    data: {
      kind: options.kind,
      storageProvider: "LOCAL_FILE",
      uri: stored.uri,
      fileName: options.fileName,
      extension: extension ? extension.slice(1) : null,
      mimeType: options.mimeType ?? null,
      byteSize: resolveByteSize(options.content),
      checksumSha256: createHash("sha256").update(options.content).digest("hex"),
      metadata: options.metadata,
      createdById: options.createdById ?? undefined,
    },
  })
}
