import { Prisma } from "@prisma/client"

export class CommunityError extends Error {
  status: number
  code: string

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

export function slugifyCommunity(input: string) {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return normalized || "group"
}

export async function buildUniqueGroupSlug(
  tx: Prisma.TransactionClient,
  seed: string,
  excludeId?: string,
) {
  const base = slugifyCommunity(seed)
  let candidate = base
  let suffix = 1

  while (true) {
    const existing = await tx.studyGroup.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })

    if (!existing) return candidate

    suffix += 1
    candidate = `${base}-${suffix}`
  }
}

export function parseProductRewardPoints(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>).rewardPointsCost
  const value = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.floor(value)
}
