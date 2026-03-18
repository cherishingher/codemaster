import { Prisma } from "@prisma/client";
import { normalizeProblemAlias } from "@/lib/problem-aliases";

export type AdminProblemFilters = {
  q?: string | null;
  difficulty?: number | null;
  visibility?: string | null;
  status?: number | null;
};

export function buildAdminProblemWhere(filters: AdminProblemFilters): Prisma.ProblemWhereInput {
  const q = filters.q?.trim();
  const normalizedQuery = q ? normalizeProblemAlias(q) : "";
  const visibility = filters.visibility?.trim();

  return {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { source: { contains: q, mode: "insensitive" } },
            ...(normalizedQuery
              ? [
                  {
                    aliases: {
                      some: {
                        normalizedValue: { contains: normalizedQuery },
                      },
                    },
                  } as Prisma.ProblemWhereInput,
                ]
              : []),
            {
              tags: {
                some: {
                  tag: {
                    name: { contains: q, mode: "insensitive" },
                  },
                },
              },
            },
          ],
        }
      : {}),
    ...(Number.isFinite(filters.difficulty) ? { difficulty: filters.difficulty as number } : {}),
    ...(visibility &&
    ["public", "private", "hidden", "contest"].includes(visibility)
      ? { visibility }
      : {}),
    ...(Number.isFinite(filters.status) ? { status: filters.status as number } : {}),
  };
}
