import path from "path"
import { createHash } from "crypto"
import { readFile } from "fs/promises"
import { Prisma, type FileAssetKind, type FileStorageProvider } from "@prisma/client"
import { db } from "@/lib/db"
import { storeBufferAsset } from "@/lib/storage"

type CreateFileAssetOptions = {
  prefix: string
  fileName: string
  content: Buffer | Uint8Array | string
  kind: FileAssetKind
  mimeType?: string | null
  createdById?: string | null
  extension?: string
  metadata?: Prisma.InputJsonValue
  storageProvider?: FileStorageProvider
}

function resolveExtension(fileName: string, explicitExtension?: string) {
  if (explicitExtension) {
    return explicitExtension.startsWith(".") ? explicitExtension.slice(1) : explicitExtension
  }
  const ext = path.extname(fileName)
  return ext ? ext.slice(1) : undefined
}

function resolveByteSize(content: Buffer | Uint8Array | string) {
  return typeof content === "string" ? Buffer.byteLength(content, "utf8") : content.byteLength
}

function checksumSha256(content: Buffer | Uint8Array | string) {
  return createHash("sha256").update(content).digest("hex")
}

export async function createStoredFileAsset(options: CreateFileAssetOptions) {
  const extension = resolveExtension(options.fileName, options.extension)
  const uri = await storeBufferAsset(options.prefix, options.content, { extension })
  return db.fileAsset.create({
    data: {
      kind: options.kind,
      storageProvider: options.storageProvider ?? "LOCAL_FILE",
      uri,
      fileName: options.fileName,
      extension,
      mimeType: options.mimeType ?? null,
      byteSize: resolveByteSize(options.content),
      checksumSha256: checksumSha256(options.content),
      metadata: options.metadata,
      createdById: options.createdById ?? undefined,
    },
  })
}

export async function readStoredTextAssetByUri(uri?: string | null) {
  if (!uri) return null
  if (!uri.startsWith("file://")) return null

  const filePath = new URL(uri).pathname
  return readFile(filePath, "utf8")
}
