import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const CreateVersionSchema = z.object({
  statement: z.string().min(1),
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
  notes: z.string().min(1).optional(),
  timeLimitMs: z.number().int().positive(),
  memoryLimitMb: z.number().int().positive(),
});

export const GET = withAuth(async (_req, { params }) => {
  const versions = await db.problemVersion.findMany({
    where: { problemId: params.id },
    orderBy: { version: "desc" },
    include: {
      testcases: { orderBy: { orderIndex: "asc" } },
    },
  });

  return NextResponse.json(
    versions.map((v) => ({
      id: v.id,
      version: v.version,
      statement: v.statement,
      constraints: v.constraints,
      inputFormat: v.inputFormat,
      outputFormat: v.outputFormat,
      samples: v.samples,
      notes: v.notes,
      timeLimitMs: v.timeLimitMs,
      memoryLimitMb: v.memoryLimitMb,
      testcases: v.testcases.map((tc) => ({
        id: tc.id,
        inputUri: tc.inputUri,
        outputUri: tc.outputUri,
        score: tc.score,
        groupId: tc.groupId,
        isSample: tc.isSample,
        orderIndex: tc.orderIndex,
      })),
    }))
  );
}, { roles: "admin" });

export const POST = withAuth(async (req, { params }) => {
  const payload = CreateVersionSchema.parse(await req.json());

  const latest = await db.problemVersion.findFirst({
    where: { problemId: params.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const nextVersion = (latest?.version ?? 0) + 1;

  const created = await db.problemVersion.create({
    data: {
      problemId: params.id,
      version: nextVersion,
      statement: payload.statement,
      constraints: payload.constraints,
      inputFormat: payload.inputFormat,
      outputFormat: payload.outputFormat,
      samples: payload.samples,
      notes: payload.notes,
      timeLimitMs: payload.timeLimitMs,
      memoryLimitMb: payload.memoryLimitMb,
    },
  });

  return NextResponse.json({ id: created.id, version: created.version });
}, { roles: "admin" });

export const runtime = "nodejs";
