import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { getLanguageId } from "@/lib/oj";

const JudgeConfigSchema = z.object({
  id: z.string().optional(),
  language: z.string().min(1),
  judgeMode: z.string().min(1).default("standard"),
  timeLimitMs: z.number().int().positive().nullable().optional(),
  memoryLimitMb: z.number().int().positive().nullable().optional(),
  templateCode: z.string().nullable().optional(),
  templateCodeUri: z.string().nullable().optional(),
  entrypoint: z.string().nullable().optional(),
  entrySignature: z.string().nullable().optional(),
  compileCommand: z.string().nullable().optional(),
  runCommand: z.string().nullable().optional(),
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const PayloadSchema = z.object({
  judgeConfigs: z.array(JudgeConfigSchema),
});

export const GET = withAuth(async (_req, { params }) => {
  const version = await db.problemVersion.findUnique({
    where: { id: params.id },
    include: {
      judgeConfigs: {
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
      },
    },
  });

  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 });
  }

  return NextResponse.json(
    version.judgeConfigs.map((config) => ({
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
    }))
  );
}, { roles: "admin" });

export const PUT = withAuth(async (req, { params }) => {
  const payload = PayloadSchema.parse(await req.json());

  const version = await db.problemVersion.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 });
  }

  const normalizedConfigs = payload.judgeConfigs.map((config, index) => {
    const languageId = getLanguageId(config.language);
    return {
      language: config.language.trim(),
      languageId,
      judgeMode: config.judgeMode.trim(),
      timeLimitMs: config.timeLimitMs ?? null,
      memoryLimitMb: config.memoryLimitMb ?? null,
      templateCode: config.templateCode ?? null,
      templateCodeUri: config.templateCodeUri ?? null,
      entrypoint: config.entrypoint ?? null,
      entrySignature: config.entrySignature ?? null,
      compileCommand: config.compileCommand ?? null,
      runCommand: config.runCommand ?? null,
      isEnabled: config.isEnabled ?? true,
      isDefault: config.isDefault ?? index === 0,
      sortOrder: config.sortOrder ?? (index + 1) * 10,
    };
  });

  const missingLanguageId = normalizedConfigs.find((config) => config.languageId === null);
  if (missingLanguageId) {
    return NextResponse.json(
      { error: "unsupported_language", detail: missingLanguageId.language },
      { status: 400 }
    );
  }

  const duplicateLanguages = new Set<string>();
  const seenLanguages = new Set<string>();
  for (const config of normalizedConfigs) {
    const key = config.language.toLowerCase();
    if (seenLanguages.has(key)) {
      duplicateLanguages.add(config.language);
    }
    seenLanguages.add(key);
  }
  if (duplicateLanguages.size > 0) {
    return NextResponse.json(
      { error: "duplicate_language", detail: Array.from(duplicateLanguages) },
      { status: 400 }
    );
  }

  const defaultCount = normalizedConfigs.filter((config) => config.isDefault).length;
  if (normalizedConfigs.length > 0 && defaultCount !== 1) {
    return NextResponse.json(
      { error: "default_language_required", detail: "exactly_one_default_required" },
      { status: 400 }
    );
  }

  await db.$transaction(async (tx) => {
    await tx.problemJudgeConfig.deleteMany({
      where: { versionId: params.id },
    });

    if (normalizedConfigs.length === 0) {
      return;
    }

    await tx.problemJudgeConfig.createMany({
      data: normalizedConfigs.map((config) => ({
        versionId: params.id,
        language: config.language,
        languageId: config.languageId!,
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
    });
  });

  return NextResponse.json({ ok: true, count: normalizedConfigs.length });
}, { roles: "admin" });
