import { NextResponse } from "next/server"

export type ApiListMeta = {
  total?: number
  page?: number
  pageSize?: number
  totalPages?: number
  nextCursor?: string | null
  limit?: number
}

export function jsonData<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init)
}

export function jsonList<T>(
  data: T[],
  meta: ApiListMeta,
  legacy?: Record<string, unknown>,
  init?: ResponseInit,
) {
  return NextResponse.json(
    {
      data,
      meta,
      ...(legacy ?? {}),
    },
    init,
  )
}
