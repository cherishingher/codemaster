"use client"

import useSWR from "swr"
import { api } from "@/lib/api-client"
import type { ContentAccessCheckResponse, ContentResourceType } from "@/lib/content-access"

export function useContentAccessCheck(resourceType?: ContentResourceType, resourceId?: string | null) {
  const enabled = Boolean(resourceType && resourceId)

  const { data, error, isLoading, mutate } = useSWR<ContentAccessCheckResponse>(
    enabled
      ? `/access/check?resourceType=${encodeURIComponent(resourceType!)}&resourceId=${encodeURIComponent(resourceId!)}`
      : null,
    () =>
      api.access.check<ContentAccessCheckResponse>({
        resourceType: resourceType!,
        resourceId: resourceId!,
      }),
  )

  return {
    access: data?.data ?? null,
    error,
    isLoading,
    refresh: mutate,
  }
}
