import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { buildJudgeConfigCreateManyInput } from "@/lib/problem-admin";
import { maybeBuildScratchRuleDraft } from "@/lib/scratch-rule-draft";
import { Prisma } from "@prisma/client";

const CreateVersionSchema = z.object({
  statement: z.string().min(1),
  statementMd: z.string().min(1).optional(),
  constraints: z.string().min(1).optional(),
  inputFormat: z.string().min(1).optional(),
  outputFormat: z.string().min(1).optional(),
  samples: z
    .array(
      z.object({
        input: z.string(),
        output: z.string(),
        explain: z.string().optional(),
      })
    )
    .optional(),
  hints: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  timeLimitMs: z.number().int().positive(),
  memoryLimitMb: z.number().int().positive(),
});

async function resolveProblem(idOrSlug: string) {
  return db.problem.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    select: {
      id: true,
      tags: {
        include: { tag: true },
      },
    },
  })
}

export const GET = withAuth(async (_req, { params }) => {
  const problem = await resolveProblem(params.id)
  if (!problem) {
    return NextResponse.json({ error: "problem_not_found" }, { status: 404 })
  }
  const tags = problem.tags.map((item) => item.tag.name)

  const versions = await db.problemVersion.findMany({
    where: { problemId: problem.id },
    orderBy: { version: "desc" },
    include: {
      judgeConfigs: {
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
      },
      testcases: { orderBy: { orderIndex: "asc" } },
    },
  });

  return NextResponse.json(
    versions.map((v) => ({
      id: v.id,
      version: v.version,
      statement: v.statement,
      statementMd: v.statementMd,
      constraints: v.constraints,
      hints: v.hints,
      inputFormat: v.inputFormat,
      outputFormat: v.outputFormat,
      samples: v.samples,
      scratchRules: v.scratchRules ?? maybeBuildScratchRuleDraft({
        statement: v.statement,
        statementMd: v.statementMd,
        tags,
      }),
      testdataGenerationConfig: v.testdataGenerationConfig,
      notes: v.notes,
      timeLimitMs: v.timeLimitMs,
      memoryLimitMb: v.memoryLimitMb,
      judgeConfigs: v.judgeConfigs.map((config) => ({
        id: config.id,
        language: config.language,
        languageId: config.languageId,
        judgeMode: config.judgeMode,
        timeLimitMs: config.timeLimitMs,
        memoryLimitMb: config.memoryLimitMb,
        templateCode: config.templateCode,
        templateCodeUri: config.templateCodeUri,
        entrypoint: config.entrypoint,
        entrySignature: config.entrySignature,
        compileCommand: config.compileCommand,
        runCommand: config.runCommand,
        isEnabled: config.isEnabled,
        isDefault: config.isDefault,
        sortOrder: config.sortOrder,
      })),
      testcases: v.testcases.map((tc) => ({
        id: tc.id,
        title: tc.title,
        caseType: tc.caseType,
        visible: tc.visible,
        inputUri: tc.inputUri,
        outputUri: tc.outputUri,
        score: tc.score,
        groupId: tc.groupId,
        isSample: tc.isSample,
        sourceType: tc.sourceType,
        generationTaskId: tc.generationTaskId,
        generationOrdinal: tc.generationOrdinal,
        orderIndex: tc.orderIndex,
      })),
    }))
  );
}, { roles: "admin" });

export const POST = withAuth(async (req, { params }) => {
  const payload = CreateVersionSchema.parse(await req.json());

  const created = await db.$transaction(async (tx) => {
    const problem = await tx.problem.findFirst({
      where: {
        OR: [{ id: params.id }, { slug: params.id }],
      },
      select: {
        id: true,
        tags: {
          include: { tag: true },
        },
      },
    });
    if (!problem) {
      throw new Error("problem_not_found")
    }

    const latest = await tx.problemVersion.findFirst({
      where: { problemId: problem.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (latest?.version ?? 0) + 1;
    const tags = problem?.tags.map((item) => item.tag.name);
    const scratchRules = maybeBuildScratchRuleDraft({
      statement: payload.statement,
      statementMd: payload.statementMd,
      tags,
    });

    const version = await tx.problemVersion.create({
      data: {
        problemId: problem.id,
        version: nextVersion,
        statement: payload.statement,
        statementMd: payload.statementMd ?? payload.statement,
        constraints: payload.constraints,
        hints: payload.hints,
        inputFormat: payload.inputFormat,
        outputFormat: payload.outputFormat,
        samples: payload.samples,
        notes: payload.notes,
        scratchRules: scratchRules
          ? (scratchRules as Prisma.InputJsonValue)
          : undefined,
        timeLimitMs: payload.timeLimitMs,
        memoryLimitMb: payload.memoryLimitMb,
      },
    });

    await tx.problem.update({
      where: { id: problem.id },
      data: { currentVersionId: version.id },
    });

    const judgeConfigs = buildJudgeConfigCreateManyInput({
      versionId: version.id,
      tags: problem?.tags.map((item) => item.tag.name),
      timeLimitMs: version.timeLimitMs,
      memoryLimitMb: version.memoryLimitMb,
    });
    if (judgeConfigs.length) {
      await tx.problemJudgeConfig.createMany({
        data: judgeConfigs,
        skipDuplicates: true,
      });
    }

    return version;
  });

  return NextResponse.json({ id: created.id, version: created.version });
}, { roles: "admin" });

export const runtime = "nodejs";
