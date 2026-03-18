import { Prisma } from "@prisma/client"

export function normalizeProblemAlias(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "")
}

export function buildSourceDerivedAliases(source: string | null | undefined) {
  const raw = source?.trim()
  if (!raw) return []
  const match = raw.match(/^([a-z0-9_-]+):([A-Za-z0-9._-]+)$/i)
  if (!match) return []

  const provider = match[1].trim()
  const externalId = match[2].trim()
  if (!provider || !externalId) return []

  return [`${provider}${externalId}`]
}

export function sanitizeProblemAliases(values: string[] | null | undefined) {
  const seen = new Set<string>()
  const sanitized: string[] = []

  for (const raw of values ?? []) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const normalized = normalizeProblemAlias(trimmed)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    sanitized.push(trimmed)
  }

  return sanitized
}

export function buildProblemAliases(input: {
  source?: string | null
  aliases?: string[] | null
}) {
  return sanitizeProblemAliases([
    ...buildSourceDerivedAliases(input.source),
    ...(input.aliases ?? []),
  ])
}

export async function replaceProblemAliases(
  tx: Prisma.TransactionClient,
  problemId: string,
  input: {
    source?: string | null
    aliases?: string[] | null
  }
) {
  const sanitized = buildProblemAliases(input)

  await tx.problemAlias.deleteMany({
    where: { problemId },
  })

  if (sanitized.length === 0) {
    return
  }

  await tx.problemAlias.createMany({
    data: sanitized.map((value, index) => ({
      problemId,
      value,
      normalizedValue: normalizeProblemAlias(value),
      sortOrder: index,
    })),
  })
}
