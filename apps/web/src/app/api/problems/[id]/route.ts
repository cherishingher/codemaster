import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, hasRole } from "@/lib/authz";
import { getDefaultJudgeConfigs, ProblemLifecycleStatus } from "@/lib/oj";

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  const { id: idOrSlug } = await Promise.resolve(ctx.params);
  const { searchParams } = new URL(req.url);
  const versionQuery = searchParams.get("version");

  const problem = await db.problem.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    include: {
      tags: { include: { tag: true } },
      currentVersion: {
        include: {
          judgeConfigs: {
            where: { isEnabled: true },
            orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
          },
        },
      },
      versions: {
        orderBy: { version: "desc" },
        take: 1,
        include: {
          judgeConfigs: {
            where: { isEnabled: true },
            orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
          },
        },
      },
    },
  });

  const user = await getAuthUser(req);
  const isAdmin = !!user && hasRole(user, "admin");

  if (
    !problem ||
    (!isAdmin &&
      (!problem.visible ||
        problem.defunct !== "N" ||
        problem.status < ProblemLifecycleStatus.PUBLISHED ||
        problem.visibility !== "public"))
  ) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let version = null;
  if (versionQuery) {
    const requestedVersion = Number(versionQuery);
    if (Number.isFinite(requestedVersion)) {
      version = await db.problemVersion.findFirst({
        where: {
          problemId: problem.id,
          version: requestedVersion,
        },
        include: {
          judgeConfigs: {
            where: { isEnabled: true },
            orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
          },
        },
      });
    }
  }

  const resolvedVersion = version ?? problem.currentVersion ?? problem.versions[0] ?? null;
  if (!resolvedVersion) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 });
  }

  const judgeConfigs =
    resolvedVersion.judgeConfigs.length > 0
      ? resolvedVersion.judgeConfigs.map((config) => ({
          id: config.id,
          language: config.language,
          languageId: config.languageId,
          judgeMode: config.judgeMode,
          timeLimitMs: config.timeLimitMs,
          memoryLimitMb: config.memoryLimitMb,
          templateCode: config.templateCode,
          entrypoint: config.entrypoint,
          entrySignature: config.entrySignature,
          isDefault: config.isDefault,
          sortOrder: config.sortOrder,
        }))
      : getDefaultJudgeConfigs({
          tags: problem.tags.map((item) => item.tag.name),
          timeLimitMs: resolvedVersion.timeLimitMs,
          memoryLimitMb: resolvedVersion.memoryLimitMb,
        });

  return NextResponse.json({
    id: problem.id,
    slug: problem.slug,
    title: problem.title,
    difficulty: problem.difficulty,
    status: problem.status,
    visibility: problem.visibility,
    source: problem.source,
    publishedAt: problem.publishedAt,
    tags: problem.tags.map((item) => item.tag.name),
    version: resolvedVersion.version,
    currentVersionId: problem.currentVersionId,
    statement: resolvedVersion.statementMd ?? resolvedVersion.statement,
    statementMd: resolvedVersion.statementMd ?? resolvedVersion.statement,
    constraints: resolvedVersion.constraints,
    hints: resolvedVersion.hints ?? resolvedVersion.notes,
    inputFormat: resolvedVersion.inputFormat,
    outputFormat: resolvedVersion.outputFormat,
    samples: resolvedVersion.samples,
    notes: resolvedVersion.notes,
    timeLimitMs: resolvedVersion.timeLimitMs,
    memoryLimitMb: resolvedVersion.memoryLimitMb,
    judgeConfigs,
  });
}
