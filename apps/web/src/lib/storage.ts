import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"

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
  return `file://${filepath}`
}

export async function storeTextAsset(
  prefix: string,
  content: string,
  options: { extension?: string } = {}
) {
  return storeBufferAsset(prefix, content, { extension: options.extension, encoding: "utf8" })
}
