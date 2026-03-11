import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { TrainingPathListQuerySchema } from "@/server/modules/training-path-center/schemas"
import { listTrainingPaths } from "@/server/modules/training-path-center/service"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user = await getAuthUser(req)
  const query = TrainingPathListQuerySchema.parse({
    q: searchParams.get("q") ?? undefined,
  })

  const result = await listTrainingPaths(
    {
      q: query.q,
    },
    user ?? undefined,
  )

  return NextResponse.json({
    data: result.items,
    meta: {
      total: result.total,
      q: result.q,
    },
  })
}
