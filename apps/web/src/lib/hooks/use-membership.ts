"use client"

import useSWR from "swr"
import { api } from "@/lib/api-client"
import type { MembershipBenefitsResponse, MembershipMeResponse } from "@/lib/membership"

export function useMembership(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<MembershipMeResponse>(
    enabled ? "/membership/me" : null,
    () => api.membership.me<MembershipMeResponse>(),
    {
      shouldRetryOnError: false,
    },
  )

  return {
    membership: data?.data ?? null,
    error,
    isLoading,
    mutate,
  }
}

export function useMembershipBenefits() {
  const { data, error, isLoading, mutate } = useSWR<MembershipBenefitsResponse>(
    "/membership/benefits",
    () => api.membership.benefits<MembershipBenefitsResponse>(),
  )

  return {
    benefits: data?.data ?? null,
    error,
    isLoading,
    mutate,
  }
}
