import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { normalizeProblemAlias } from "@/lib/problem-aliases"

export function buildProblemIdentifierWhere(idOrSlugOrAlias: string): Prisma.ProblemWhereInput {
  return {
    OR: [
      { id: idOrSlugOrAlias },
      { slug: idOrSlugOrAlias },
      {
        aliases: {
          some: {
            normalizedValue: normalizeProblemAlias(idOrSlugOrAlias),
          },
        },
      },
    ],
  }
}

export async function resolveProblemId(idOrSlugOrAlias: string) {
  const problem = await db.problem.findFirst({
    where: buildProblemIdentifierWhere(idOrSlugOrAlias),
    select: { id: true },
  })

  return problem?.id ?? null
}
