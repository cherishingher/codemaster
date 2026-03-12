export type OpsOverviewPayload = {
  startedAt: string
  health: {
    db: boolean
    redis: boolean
  }
  httpRequests: Record<string, number>
  httpErrors: Record<string, number>
  paymentCallbacks: Record<string, number>
  accessDenials: Record<string, number>
  durations: Record<
    string,
    {
      count: number
      avgMs: number
      maxMs: number
    }
  >
  cache: Record<string, number>
}

export type OpsOverviewResponse = {
  data: OpsOverviewPayload
}
