export type PaginationItem =
  | { type: "page"; page: number }
  | { type: "ellipsis"; key: string }

export type PaginationRange = {
  from: number
  to: number
  total: number
}

export function buildPaginationItems(
  currentPage: number,
  totalPages: number,
  options?: {
    siblings?: number
    boundaries?: number
  }
): PaginationItem[] {
  const total = Math.max(1, Math.floor(totalPages))
  const current = Math.min(Math.max(1, Math.floor(currentPage)), total)
  const siblings = Math.max(0, options?.siblings ?? 1)
  const boundaries = Math.max(1, options?.boundaries ?? 1)

  const pages = new Set<number>()

  for (let page = 1; page <= Math.min(boundaries, total); page += 1) {
    pages.add(page)
  }
  for (let page = Math.max(total - boundaries + 1, 1); page <= total; page += 1) {
    pages.add(page)
  }
  for (
    let page = Math.max(current - siblings, 1);
    page <= Math.min(current + siblings, total);
    page += 1
  ) {
    pages.add(page)
  }

  const sortedPages = Array.from(pages).sort((a, b) => a - b)
  const items: PaginationItem[] = []
  let previousPage = 0

  for (const page of sortedPages) {
    if (previousPage && page - previousPage > 1) {
      items.push({
        type: "ellipsis",
        key: `${previousPage}-${page}`,
      })
    }
    items.push({
      type: "page",
      page,
    })
    previousPage = page
  }

  return items
}

export function getPaginationRange(input: {
  page: number
  pageSize: number
  total: number
  visibleCount?: number
}): PaginationRange {
  const total = Math.max(0, Math.floor(input.total))
  if (!total) {
    return {
      from: 0,
      to: 0,
      total: 0,
    }
  }

  const pageSize = Math.max(1, Math.floor(input.pageSize))
  const page = Math.max(1, Math.floor(input.page))
  const from = Math.min((page - 1) * pageSize + 1, total)
  const visibleCount = typeof input.visibleCount === "number" ? Math.max(0, Math.floor(input.visibleCount)) : 0
  const fallbackTo = Math.min(page * pageSize, total)
  const to =
    visibleCount > 0 ? Math.min(from + visibleCount - 1, total) : fallbackTo

  return {
    from,
    to,
    total,
  }
}
