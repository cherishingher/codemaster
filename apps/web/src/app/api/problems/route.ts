import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthUser, hasRole } from "@/lib/authz";
import { normalizeProblemAlias } from "@/lib/problem-aliases";
import { ProblemLifecycleStatus, UserProblemStatus } from "@/lib/oj";
import { getDifficultyValuesForLuoguBand, isLuoguDifficultyBandId } from "@/lib/problem-difficulty";

function parseIntParam(value: string | null, fallback: number, max?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

function parseCsvParams(
  searchParams: URLSearchParams,
  name: string
) {
  return [
    ...searchParams.getAll(name),
    ...(searchParams.get(name)?.split(",") ?? []),
  ]
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDifficultyFilter(searchParams: URLSearchParams) {
  return parseCsvParams(searchParams, "difficulty")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function parseUserStatusFilter(raw: string | null) {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  switch (normalized) {
    case "0":
    case "NOT_STARTED":
      return UserProblemStatus.NOT_STARTED;
    case "10":
    case "ATTEMPTED":
      return UserProblemStatus.ATTEMPTED;
    case "20":
    case "ACCEPTED":
      return UserProblemStatus.ACCEPTED;
    default:
      return null;
  }
}

function parseProblemStatusFilter(raw: string | null) {
  if (!raw) return null;
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return parsed;
  switch (raw.trim().toUpperCase()) {
    case "DRAFT":
      return ProblemLifecycleStatus.DRAFT;
    case "REVIEW":
      return ProblemLifecycleStatus.REVIEW;
    case "PUBLISHED":
      return ProblemLifecycleStatus.PUBLISHED;
    case "ARCHIVED":
      return ProblemLifecycleStatus.ARCHIVED;
    default:
      return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("keyword")?.trim() || searchParams.get("q")?.trim() || "";
  const normalizedKeyword = keyword ? normalizeProblemAlias(keyword) : "";
  const tagQuery = searchParams.get("tagQuery")?.trim() || "";
  const tags = parseCsvParams(searchParams, "tags");
  const singleTag = searchParams.get("tag")?.trim();
  if (singleTag) tags.push(singleTag);
  const difficultyBand = searchParams.get("difficultyBand")?.trim().toLowerCase();
  const difficulty =
    difficultyBand && isLuoguDifficultyBandId(difficultyBand)
      ? getDifficultyValuesForLuoguBand(difficultyBand)
      : parseDifficultyFilter(searchParams);
  const userStatus = parseUserStatusFilter(searchParams.get("userStatus"));
  const problemStatus = parseProblemStatusFilter(searchParams.get("status"));
  const page = parseIntParam(searchParams.get("page"), 1);
  const limit = parseIntParam(searchParams.get("limit"), 20, 100);

  const user = await getAuthUser(req);
  const isAdmin = !!user && hasRole(user, "admin");

  if (userStatus !== null && !user) {
    return NextResponse.json({
      data: [],
      meta: { total: 0, page, limit, totalPages: 0 },
    });
  }

  const where: Prisma.ProblemWhereInput = isAdmin
    ? {}
    : {
        visibility: "public",
        visible: true,
        defunct: "N",
        status: { gte: ProblemLifecycleStatus.PUBLISHED },
      };

  if (keyword) {
    where.OR = [
      { title: { contains: keyword, mode: "insensitive" } },
      { slug: { contains: keyword, mode: "insensitive" } },
      { source: { contains: keyword, mode: "insensitive" } },
      {
        aliases: {
          some: {
            value: { contains: keyword, mode: "insensitive" },
          },
        },
      },
      ...(normalizedKeyword
        ? [
            {
              aliases: {
                some: {
                  normalizedValue: { contains: normalizedKeyword },
                },
              },
            } satisfies Prisma.ProblemWhereInput,
          ]
        : []),
      {
        tags: {
          some: {
            tag: {
              name: { contains: keyword, mode: "insensitive" },
            },
          },
        },
      },
    ];
  }

  const andFilters: Prisma.ProblemWhereInput[] = [];

  if (difficulty.length) {
    andFilters.push({ difficulty: { in: difficulty } });
  }

  if (tags.length) {
    andFilters.push({
      tags: {
        some: {
          tag: {
            name: { in: tags },
          },
        },
      },
    });
  }

  if (tagQuery) {
    andFilters.push({
      tags: {
        some: {
          tag: {
            name: { contains: tagQuery, mode: "insensitive" },
          },
        },
      },
    });
  }

  if (problemStatus !== null) {
    andFilters.push({ status: problemStatus });
  }

  if (user && userStatus !== null) {
    if (userStatus === UserProblemStatus.NOT_STARTED) {
      andFilters.push({
        progress: {
          none: {
            userId: user.id,
          },
        },
      });
    } else {
      andFilters.push({
        progress: {
          some: {
            userId: user.id,
            status: userStatus,
          },
        },
      });
    }
  }

  if (andFilters.length) {
    const existingAnd = Array.isArray(where.AND)
      ? where.AND
      : where.AND
        ? [where.AND]
        : [];
    where.AND = [...existingAnd, ...andFilters];
  }

  const [total, problems] = await Promise.all([
    db.problem.count({ where }),
    db.problem.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        currentVersion: {
          select: { id: true, version: true },
        },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: { id: true, version: true },
        },
        tags: {
          include: { tag: true },
        },
        aliases: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { value: true },
        },
        ...(user
          ? {
              progress: {
                where: { userId: user.id },
                take: 1,
                select: {
                  status: true,
                  attempts: true,
                  bestScore: true,
                  lastStatus: true,
                  solvedAt: true,
                },
              },
            }
          : {}),
      },
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return NextResponse.json({
    data: problems.map((problem) => {
      const latestVersion = problem.currentVersion ?? problem.versions[0] ?? null;
      const progress = "progress" in problem ? problem.progress?.[0] : undefined;
      return {
        id: problem.id,
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        status: problem.status,
        visibility: problem.visibility,
        source: problem.source,
        publishedAt: problem.publishedAt,
        version: latestVersion?.version ?? null,
        tags: problem.tags.map((item) => item.tag.name),
        aliases: problem.aliases.map((item) => item.value),
        totalSubmissions: problem.totalSubmissions,
        acceptedSubmissions: problem.acceptedSubmissions,
        passRate: problem.passRate,
        userStatus: progress?.status ?? UserProblemStatus.NOT_STARTED,
        bestScore: progress?.bestScore ?? 0,
      };
    }),
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  });
}
