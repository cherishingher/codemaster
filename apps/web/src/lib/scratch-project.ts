import { readZipEntries } from "./zip"

type ScratchTarget = {
  name: string
  isStage?: boolean
  blocks: Record<string, unknown>
}

export type ScratchProject = {
  targets: ScratchTarget[]
}

function isScratchProject(value: unknown): value is ScratchProject {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { targets?: unknown }).targets)
  )
}

export async function parseScratchProjectBuffer(
  buffer: Buffer,
  name = ""
): Promise<ScratchProject | null> {
  const lowerName = name.toLowerCase()
  if (lowerName.endsWith(".json")) {
    try {
      const parsed = JSON.parse(buffer.toString("utf8"))
      return isScratchProject(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return null
  }

  try {
    const entries = await readZipEntries(buffer)
    const projectEntry =
      entries.get("project.json") ??
      [...entries.entries()].find(([entryName]) => entryName.endsWith("/project.json"))?.[1]
    if (!projectEntry) return null

    const parsed = JSON.parse(projectEntry.toString("utf8"))
    return isScratchProject(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function parseScratchProjectFile(file: File): Promise<ScratchProject | null> {
  const buffer = Buffer.from(await file.arrayBuffer())
  return parseScratchProjectBuffer(buffer, file.name || "")
}

export async function parseScratchProjectCode(code: string): Promise<ScratchProject | null> {
  const trimmed = code.trim()
  if (!trimmed) return null

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed)
      return isScratchProject(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  const base64 = trimmed.startsWith("data:")
    ? trimmed.slice(trimmed.indexOf(",") + 1)
    : trimmed

  try {
    const buffer = Buffer.from(base64, "base64")
    return parseScratchProjectBuffer(buffer)
  } catch {
    return null
  }
}
