type CounterMap = Record<string, number>

type DurationStats = {
  count: number
  totalMs: number
  maxMs: number
}

type OpsMetricsState = {
  startedAt: string
  httpRequests: CounterMap
  httpErrors: CounterMap
  paymentCallbacks: CounterMap
  accessDenials: CounterMap
  durations: Record<string, DurationStats>
  cache: CounterMap
}

declare global {
  var __webOpsMetrics: OpsMetricsState | undefined
}

function ensureState(): OpsMetricsState {
  if (!globalThis.__webOpsMetrics) {
    globalThis.__webOpsMetrics = {
      startedAt: new Date().toISOString(),
      httpRequests: {},
      httpErrors: {},
      paymentCallbacks: {},
      accessDenials: {},
      durations: {},
      cache: {},
    }
  }

  return globalThis.__webOpsMetrics
}

function increment(map: CounterMap, key: string, amount = 1) {
  map[key] = (map[key] ?? 0) + amount
}

export function recordHttpMetric(route: string, status: number) {
  const state = ensureState()
  increment(state.httpRequests, route)
  if (status >= 500) {
    increment(state.httpErrors, route)
  }
}

export function recordPaymentCallbackMetric(status: "succeeded" | "failed" | "replayed") {
  const state = ensureState()
  increment(state.paymentCallbacks, status)
}

export function recordAccessDecisionMetric(reasonCode: string, allowed: boolean) {
  if (allowed) {
    return
  }

  const state = ensureState()
  increment(state.accessDenials, reasonCode)
}

export function recordDurationMetric(metric: string, durationMs: number) {
  const state = ensureState()
  const current = state.durations[metric] ?? { count: 0, totalMs: 0, maxMs: 0 }
  current.count += 1
  current.totalMs += durationMs
  current.maxMs = Math.max(current.maxMs, durationMs)
  state.durations[metric] = current
}

export function recordCacheMetric(result: "hit" | "miss") {
  const state = ensureState()
  increment(state.cache, result)
}

export function snapshotOpsMetrics() {
  const state = ensureState()

  const durations = Object.fromEntries(
    Object.entries(state.durations).map(([metric, value]) => [
      metric,
      {
        count: value.count,
        avgMs: value.count > 0 ? Number((value.totalMs / value.count).toFixed(2)) : 0,
        maxMs: value.maxMs,
      },
    ]),
  )

  return {
    startedAt: state.startedAt,
    httpRequests: { ...state.httpRequests },
    httpErrors: { ...state.httpErrors },
    paymentCallbacks: { ...state.paymentCallbacks },
    accessDenials: { ...state.accessDenials },
    durations,
    cache: { ...state.cache },
  }
}
