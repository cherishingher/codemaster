import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";

  const problems = await db.problem.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      tags: { include: { tag: true } },
      versions: {
        orderBy: { version: "asc" },
        include: { testcases: true },
      },
      solutions: {
        orderBy: { createdAt: "asc" },
        include: { author: true, version: true },
      },
    },
  });

  if (format === "csv") {
    const header = [
      "id",
      "title",
      "difficulty",
      "visibility",
      "source",
      "tags",
      "latestVersion",
      "createdAt",
    ].join(",");
    const rows = problems.map((p) => {
      const tags = p.tags.map((t) => t.tag.name).join("|");
      const latestVersion = p.versions.at(-1)?.version ?? "";
      return [
        p.id,
        JSON.stringify(p.title),
        p.difficulty,
        p.visibility,
        JSON.stringify(p.source ?? ""),
        JSON.stringify(tags),
        latestVersion,
        p.createdAt.toISOString(),
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=problems.csv",
      },
    });
  }

  const payload = problems.map((p) => ({
    id: p.id,
    title: p.title,
    difficulty: p.difficulty,
    visibility: p.visibility,
    source: p.source,
    tags: p.tags.map((t) => t.tag.name),
    versions: p.versions.map((v) => ({
      version: v.version,
      statement: v.statement,
      statementMd: v.statementMd,
      constraints: v.constraints,
      hints: v.hints,
      inputFormat: v.inputFormat,
      outputFormat: v.outputFormat,
      samples: v.samples,
      notes: v.notes,
      timeLimitMs: v.timeLimitMs,
      memoryLimitMb: v.memoryLimitMb,
      testcases: v.testcases.map((tc) => ({
        inputUri: tc.inputUri,
        outputUri: tc.outputUri,
        score: tc.score,
        timeLimitMs: tc.timeLimitMs,
        memoryLimitKb: tc.memoryLimitKb,
        subtaskId: tc.subtaskId,
        isPretest: tc.isPretest,
        groupId: tc.groupId,
        isSample: tc.isSample,
        orderIndex: tc.orderIndex,
      })),
    })),
    solutions: p.solutions.map((s) => ({
      title: s.title,
      content: s.content,
      type: s.type,
      visibility: s.visibility,
      versionId: s.versionId,
      videoUrl: s.videoUrl,
      authorId: s.authorId,
      createdAt: s.createdAt,
    })),
  }));

  return Response.json({ problems: payload });
}, { roles: "admin" });
