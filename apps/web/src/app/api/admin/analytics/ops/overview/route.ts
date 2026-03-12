import { NextResponse } from "next/server"
import { withAuth } from "@/lib/authz"
import { db } from "@/lib/db"
import type { OpsOverviewResponse } from "@/lib/ops-monitoring"
import { snapshotOpsMetrics } from "@/lib/ops-metrics"
import { pingRedis } from "@/lib/redis"

export const GET = withAuth(
  async () => {
    const [dbCheck, redisCheck] = await Promise.allSettled([db.$queryRaw`SELECT 1`, pingRedis()])

    const response: OpsOverviewResponse = {
      data: {
        startedAt: snapshotOpsMetrics().startedAt,
        health: {
          db: dbCheck.status === "fulfilled",
          redis: redisCheck.status === "fulfilled" ? redisCheck.value.ok : false,
        },
        httpRequests: snapshotOpsMetrics().httpRequests,
        httpErrors: snapshotOpsMetrics().httpErrors,
        paymentCallbacks: snapshotOpsMetrics().paymentCallbacks,
        accessDenials: snapshotOpsMetrics().accessDenials,
        durations: snapshotOpsMetrics().durations,
        cache: snapshotOpsMetrics().cache,
      },
    }

    return NextResponse.json(response)
  },
  { roles: "admin" },
)
