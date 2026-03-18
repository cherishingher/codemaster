import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { storeTextAsset } from "@/lib/storage";

const TestcaseSchema = z
  .object({
    input: z.string().optional(),
    output: z.string().optional(),
    inputUri: z.string().optional(),
    outputUri: z.string().optional(),
    score: z.number().int().min(0),
    timeLimitMs: z.number().int().positive().optional(),
    memoryLimitKb: z.number().int().positive().optional(),
    subtaskId: z.number().int().positive().optional(),
    isPretest: z.boolean().optional(),
    groupId: z.string().min(1).optional(),
    isSample: z.boolean().optional(),
    orderIndex: z.number().int().optional(),
  })
  .refine((val) => val.input || val.inputUri, { message: "input or inputUri required" })
  .refine((val) => val.output || val.outputUri, { message: "output or outputUri required" });

const PayloadSchema = z.object({
  testcases: z.array(TestcaseSchema).min(1),
});

export const GET = withAuth(async (_req, { params }) => {
  const testcases = await db.testcase.findMany({
    where: { versionId: params.id },
    orderBy: { orderIndex: "asc" },
  });

  return NextResponse.json(
    testcases.map((tc) => ({
      id: tc.id,
      inputUri: tc.inputUri,
      outputUri: tc.outputUri,
      score: tc.score,
      timeLimitMs: tc.timeLimitMs,
      memoryLimitKb: tc.memoryLimitKb,
      subtaskId: tc.subtaskId,
      isPretest: tc.isPretest ?? false,
      groupId: tc.groupId,
      isSample: tc.isSample,
      sourceType: tc.sourceType,
      generationTaskId: tc.generationTaskId,
      generationOrdinal: tc.generationOrdinal,
      orderIndex: tc.orderIndex,
    }))
  );
}, { roles: "admin" });

export const POST = withAuth(async (req, { params }) => {
  const payload = PayloadSchema.parse(await req.json());

  const version = await db.problemVersion.findUnique({
    where: { id: params.id },
  });

  if (!version) {
    return NextResponse.json({ error: "version_not_found" }, { status: 404 });
  }

  const rows = [] as {
    inputUri: string;
    outputUri: string;
    score: number;
    timeLimitMs?: number;
    memoryLimitKb?: number;
    subtaskId?: number;
    isPretest?: boolean;
    groupId?: string;
    isSample?: boolean;
    orderIndex?: number;
  }[];
  for (const tc of payload.testcases) {
    const inputUri = tc.inputUri ?? (await storeTextAsset("inputs", tc.input ?? ""));
    const outputUri = tc.outputUri ?? (await storeTextAsset("outputs", tc.output ?? ""));
    rows.push({
      inputUri,
      outputUri,
      score: tc.score,
      timeLimitMs: tc.timeLimitMs,
      memoryLimitKb: tc.memoryLimitKb,
      subtaskId: tc.subtaskId,
      isPretest: tc.isPretest ?? false,
      groupId: tc.groupId,
      isSample: tc.isSample ?? false,
      orderIndex: tc.orderIndex,
    });
  }

  await db.testcase.createMany({
    data: rows.map((r) => ({
      versionId: params.id,
      inputUri: r.inputUri,
      outputUri: r.outputUri,
      score: r.score,
      timeLimitMs: r.timeLimitMs,
      memoryLimitKb: r.memoryLimitKb,
      subtaskId: r.subtaskId,
      isPretest: r.isPretest ?? false,
      groupId: r.groupId,
      isSample: r.isSample ?? false,
      sourceType: "MANUAL",
      orderIndex: r.orderIndex,
    })),
  });

  return NextResponse.json({ ok: true, count: rows.length });
}, { roles: "admin" });
