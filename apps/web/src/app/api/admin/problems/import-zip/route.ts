import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { storeTextAsset } from "@/lib/storage";
import { readZipEntries } from "@/lib/zip";
import {
  buildJudgeConfigCreateManyInput,
  buildProblemLifecycleData,
  generateUniqueProblemSlug,
} from "@/lib/problem-admin";

const TestcaseSchema = z
  .object({
    inputPath: z.string().optional(),
    outputPath: z.string().optional(),
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
  .refine((val) => val.input || val.inputUri || val.inputPath, {
    message: "input or inputUri or inputPath required",
  })
  .refine((val) => val.output || val.outputUri || val.outputPath, {
    message: "output or outputUri or outputPath required",
  });

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
  timeLimitMs: z.number().int().positive().default(1000),
  memoryLimitMb: z.number().int().positive().default(256),
  testcases: z.array(TestcaseSchema).optional(),
});

const ProblemSchema = z.object({
  title: z.string(),
  difficulty: z.number().int().min(1).max(10),
  visibility: z.enum(["public", "private", "hidden", "contest"]).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  versions: z.array(VersionSchema).optional(),
});

const PayloadSchema = z.object({
  problems: z.array(ProblemSchema).min(1),
});

function normalizePath(path: string) {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

export const POST = withAuth(async (req) => {
  const form = await req.formData();
  const file = form.get("zip");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "zip_file_required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const rawEntries = await readZipEntries(buffer);
  const entries = new Map<string, Buffer>();
  for (const [path, data] of rawEntries.entries()) {
    entries.set(normalizePath(path), data);
  }

  const manifestEntry = entries.get("manifest.json") ?? entries.get("problems.json");
  if (!manifestEntry) {
    return NextResponse.json({ error: "manifest_not_found" }, { status: 400 });
  }

  const manifestText = manifestEntry.toString("utf8");
  const payload = PayloadSchema.parse(JSON.parse(manifestText));

  let created = 0;

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
          const version = await tx.problemVersion.create({
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
              timeLimitMs: v.timeLimitMs,
              memoryLimitMb: v.memoryLimitMb,
            },
          });
          currentVersionId = version.id;

          if (v.testcases?.length) {
            for (const tc of v.testcases) {
              let inputUri = tc.inputUri ?? "";
              let outputUri = tc.outputUri ?? "";
              if (!inputUri) {
                if (tc.inputPath) {
                  const entry = entries.get(normalizePath(tc.inputPath));
                  if (!entry) {
                    throw new Error(`inputPath not found: ${tc.inputPath}`);
                  }
                  const data = entry.toString("utf8");
                  inputUri = await storeTextAsset("inputs", data);
                } else if (tc.input) {
                  inputUri = await storeTextAsset("inputs", tc.input);
                }
              }
              if (!outputUri) {
                if (tc.outputPath) {
                  const entry = entries.get(normalizePath(tc.outputPath));
                  if (!entry) {
                    throw new Error(`outputPath not found: ${tc.outputPath}`);
                  }
                  const data = entry.toString("utf8");
                  outputUri = await storeTextAsset("outputs", data);
                } else if (tc.output) {
                  outputUri = await storeTextAsset("outputs", tc.output);
                }
              }

              await tx.testcase.create({
                data: {
                  versionId: version.id,
                  inputUri,
                  outputUri,
                  title: tc.groupId ?? null,
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
            versionId: version.id,
            tags: item.tags,
            timeLimitMs: version.timeLimitMs,
            memoryLimitMb: version.memoryLimitMb,
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
    });
    created += 1;
  }

  return NextResponse.json({ ok: true, created });
}, { roles: "admin" });
