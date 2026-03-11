import type { ContentAccessResult, ContentTargetType } from "@/lib/content-access"
import type { PaginationMeta, ProductDetailItem, ProductListItem } from "@/lib/products"

export type ContentPackTargetType = Extract<
  ContentTargetType,
  "training_path" | "solution" | "video" | "problem" | "problem_set"
>

export type ContentPackIncludedTarget = {
  type: ContentPackTargetType
  id: string
  title?: string | null
  summary?: string | null
  note?: string | null
}

export type ContentPackIncludedItem = {
  type: ContentPackTargetType
  id: string
  title: string
  summary?: string | null
  note?: string | null
  href?: string | null
  meta?: string | null
  locked: boolean
  access?: ContentAccessResult | null
}

export type ContentPackListItem = ProductListItem & {
  includedTargetCount: number
  previewTargets: ContentPackIncludedItem[]
}

export type ContentPackDetailItem = {
  product: ProductDetailItem
  includedTargets: ContentPackIncludedItem[]
}

export type ContentPackListResponse = {
  data: ContentPackListItem[]
  meta: PaginationMeta
}

export type ContentPackDetailResponse = {
  data: ContentPackDetailItem
}

const CONTENT_PACK_TARGET_TYPES = new Set<ContentPackTargetType>([
  "training_path",
  "solution",
  "video",
  "problem",
  "problem_set",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function parseContentPackIncludedTargets(
  metadata?: Record<string, unknown> | null,
  fallback?: { targetType?: string | null; targetId?: string | null },
) {
  const includedTargets: ContentPackIncludedTarget[] = []
  const seen = new Set<string>()

  const append = (target: ContentPackIncludedTarget | null) => {
    if (!target) return
    const key = `${target.type}:${target.id}`
    if (seen.has(key)) return
    seen.add(key)
    includedTargets.push(target)
  }

  const rawTargets = isRecord(metadata) && Array.isArray(metadata.includedTargets) ? metadata.includedTargets : []

  for (const rawTarget of rawTargets) {
    if (!isRecord(rawTarget)) continue

    const type = typeof rawTarget.type === "string" ? rawTarget.type.trim() : ""
    const id = typeof rawTarget.id === "string" ? rawTarget.id.trim() : ""
    if (!CONTENT_PACK_TARGET_TYPES.has(type as ContentPackTargetType) || !id) continue

    append({
      type: type as ContentPackTargetType,
      id,
      title: typeof rawTarget.title === "string" ? rawTarget.title.trim() || null : null,
      summary: typeof rawTarget.summary === "string" ? rawTarget.summary.trim() || null : null,
      note: typeof rawTarget.note === "string" ? rawTarget.note.trim() || null : null,
    })
  }

  if (
    fallback?.targetType &&
    fallback?.targetId &&
    CONTENT_PACK_TARGET_TYPES.has(fallback.targetType as ContentPackTargetType)
  ) {
    append({
      type: fallback.targetType as ContentPackTargetType,
      id: fallback.targetId,
    })
  }

  return includedTargets
}
