import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { snapshotOpsMetrics } from "@/lib/ops-metrics"
import { pingRedis } from "@/lib/redis"

export const dynamic = "force-dynamic"

export async function GET() {
  const [dbCheck, redisCheck] = await Promise.allSettled([db.$queryRaw`SELECT 1`, pingRedis()])

  const dbOk = dbCheck.status === "fulfilled"
  const redisStatus =
    redisCheck.status === "fulfilled"
      ? redisCheck.value
      : {
          enabled: Boolean(process.env.REDIS_URL),
          ok: false,
          message: "redis_ping_failed",
        }

  const payload = {
    ok: dbOk && (!redisStatus.enabled || redisStatus.ok),
    env: process.env.NODE_ENV ?? "development",
    uptimeSec: Math.floor(process.uptime()),
    checks: {
      db: {
        ok: dbOk,
      },
      redis: redisStatus,
    },
    metrics: snapshotOpsMetrics(),
  }

  return NextResponse.json(payload, {
    status: payload.ok ? 200 : 503,
  })
}
