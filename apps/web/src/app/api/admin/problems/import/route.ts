import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { storeTextAsset } from "@/lib/storage";
import { maybeBuildScratchRuleDraft } from "@/lib/scratch-rule-draft";
import {
  buildJudgeConfigCreateManyInput,
  buildProblemLifecycleData,
  generateUniqueProblemSlug,
} from "@/lib/problem-admin";
import { Prisma } from "@prisma/client";

const TestcaseSchema = z
  .object({
    input: z.string().optional(),
    output: z.string().optional(),
    inputUri: z.string().optional(),
    outputUri: z.string().optional(),
    score: z.number().int().min(0).default(0),
    timeLimitMs: z.number().int().positive().optional(),
    memoryLimitKb: z.number().int().positive().optional(),
    subtaskId: z.number().int().positive().optional(),
    isPretest: z.boolean().optional(),
    groupId: z.string().optional(),
    isSample: z.boolean().optional(),
    orderIndex: z.number().int().optional(),
  })
  .refine((val) => val.input || val.inputUri, { message: "input or inputUri required" })
  .refine((val) => val.output || val.outputUri, { message: "output or outputUri required" });

const VersionSchema = z.object({
  version: z.number().int().positive().optional(),
  statement: z.string(),
  statementMd: z.string().optional(),
  constraints: z.string().optional(),
  inputFormat: z.string().optional(),
  outputFormat: z.string().optional(),
  samples: z.any().optional(),
  hints: z.string().optional(),
  notes: z.string().optional(),
  scratchRules: z.unknown().optional(),
  timeLimitMs: z.number().int().positive().default(1000),
  memoryLimitMb: z.number().int().positive().default(256),
  testcases: z.array(TestcaseSchema).optional(),
});

const SolutionSchema = z.object({
  title: z.string(),
  content: z.string(),
  type: z.enum(["official", "ugc"]).optional(),
  visibility: z.enum(["public", "vip", "purchase", "private"]).optional(),
  versionId: z.string().optional(),
  videoUrl: z.string().optional(),
});

const ProblemSchema = z.object({
  title: z.string(),
  difficulty: z.number().int().min(1).max(10),
  visibility: z.enum(["public", "private", "hidden", "contest"]).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  versions: z.array(VersionSchema).optional(),
  solutions: z.array(SolutionSchema).optional(),
});

const PayloadSchema = z.object({
  problems: z.array(ProblemSchema).min(1),
});

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  const header = lines[0].split(",");
  const idx = (name: string) => header.indexOf(name);
  const col = {
    title: idx("title"),
    difficulty: idx("difficulty"),
    visibility: idx("visibility"),
    source: idx("source"),
    tags: idx("tags"),
  };

  const parseLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current);
    return cells;
  };

  const rows = lines.slice(1).map(parseLine);
  return rows
    .map((cells) => {
      const titleRaw = cells[col.title] ?? "";
      const sourceRaw = cells[col.source] ?? "";
      const tagsRaw = cells[col.tags] ?? "";
      const title = titleRaw ? JSON.parse(titleRaw) : "";
      const source = sourceRaw ? JSON.parse(sourceRaw) : undefined;
      const tags = tagsRaw ? JSON.parse(tagsRaw).split("|").filter(Boolean) : undefined;
      return {
        title,
        difficulty: Number(cells[col.difficulty] ?? 1),
        visibility: (cells[col.visibility] ?? "public") as "public" | "private" | "hidden" | "contest",
        source,
        tags,
      };
    })
    .filter((row) => row.title);
}

export const POST = withAuth(async (req, _ctx, user) => {
  const contentType = req.headers.get("content-type") ?? "";
  const payload = PayloadSchema.parse(
    contentType.includes("text/csv") || contentType.includes("application/csv")
      ? { problems: parseCsv(await req.text()) }
      : await req.json()
  );

  let createdCount = 0;

  for (const item of payload.problems) {
    await db.$transaction(async (tx) => {
      const slug = await generateUniqueProblemSlug(tx, item.title);
      const lifecycle = buildProblemLifecycleData(item.visibility ?? "public");
      const problem = await tx.problem.create({
        data: {
          slug,
          title: item.title,
          difficulty: item.difficulty,
          status: lifecycle.status,
          visible: lifecycle.visible,
          defunct: lifecycle.defunct,
          visibility: item.visibility ?? "public",
          source: item.source,
          publishedAt: lifecycle.publishedAt,
        },
      });

      if (item.tags?.length) {
        for (const tagName of item.tags) {
          const tag = await tx.tag.upsert({
            where: { name: tagName },
            create: { name: tagName },
            update: {},
          });
          await tx.problemTag.create({
            data: { problemId: problem.id, tagId: tag.id },
          });
        }
      }

      if (item.versions?.length) {
        let autoVersion = 1;
        let currentVersionId: string | null = null;
        for (const v of item.versions) {
          const scratchRules =
            v.scratchRules ??
            maybeBuildScratchRuleDraft({
              statement: v.statement,
              statementMd: v.statementMd,
              tags: item.tags,
            });

          const createdVersion = await tx.problemVersion.create({
            data: {
              problemId: problem.id,
              version: v.version ?? autoVersion++,
              statement: v.statement,
              statementMd: v.statementMd ?? v.statement,
              constraints: v.constraints,
              hints: v.hints,
              inputFormat: v.inputFormat,
              outputFormat: v.outputFormat,
              samples: v.samples,
              notes: v.notes,
              scratchRules: scratchRules
                ? (scratchRules as Prisma.InputJsonValue)
                : undefined,
              timeLimitMs: v.timeLimitMs,
              memoryLimitMb: v.memoryLimitMb,
            },
          });
          currentVersionId = createdVersion.id;

          if (v.testcases?.length) {
            for (const tc of v.testcases) {
              const inputUri =
                tc.inputUri ?? (tc.input ? await storeTextAsset("inputs", tc.input) : "");
              const outputUri =
                tc.outputUri ?? (tc.output ? await storeTextAsset("outputs", tc.output) : "");
              await tx.testcase.create({
                data: {
                  versionId: createdVersion.id,
                  inputUri,
                  outputUri,
                  title: tc.groupId ?? (tc.isSample ? "sample" : "hidden"),
                  caseType:
                    tc.isSample ?? false
                      ? 0
                      : tc.groupId?.toLowerCase() === "stress"
                        ? 2
                        : 1,
                  visible: tc.isSample ?? false,
                  score: tc.score,
                  timeLimitMs: tc.timeLimitMs,
                  memoryLimitKb: tc.memoryLimitKb,
                  subtaskId: tc.subtaskId,
                  isPretest: tc.isPretest ?? false,
                  groupId: tc.groupId,
                  isSample: tc.isSample ?? false,
                  orderIndex: tc.orderIndex,
                },
              });
            }
          }

          const judgeConfigs = buildJudgeConfigCreateManyInput({
            versionId: createdVersion.id,
            tags: item.tags,
            timeLimitMs: createdVersion.timeLimitMs,
            memoryLimitMb: createdVersion.memoryLimitMb,
          });
          if (judgeConfigs.length) {
            await tx.problemJudgeConfig.createMany({
              data: judgeConfigs,
              skipDuplicates: true,
            });
          }
        }

        if (currentVersionId) {
          await tx.problem.update({
            where: { id: problem.id },
            data: { currentVersionId },
          });
        }
      }

      if (item.solutions?.length) {
        for (const s of item.solutions) {
          await tx.solution.create({
            data: {
              problemId: problem.id,
              title: s.title,
              content: s.content,
              type: s.type ?? "official",
              visibility: s.visibility ?? "public",
              versionId: s.versionId,
              videoUrl: s.videoUrl,
              authorId: user.id,
            },
          });
        }
      }
    });

    createdCount += 1;
  }

  return NextResponse.json({ ok: true, created: createdCount });
}, { roles: "admin" });
