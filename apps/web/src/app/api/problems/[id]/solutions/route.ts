import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/authz"
import { resolveProblemId } from "@/lib/problem-identifiers"
import { listProblemSolutions } from "@/server/modules/solution-center/service"

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> },
) {
  const { id } = await Promise.resolve(ctx.params)
  const user = await getAuthUser(req)
  const problemId = (await resolveProblemId(id)) ?? id
  const data = await listProblemSolutions(problemId, user ?? undefined)
  return NextResponse.json({ data })
}
