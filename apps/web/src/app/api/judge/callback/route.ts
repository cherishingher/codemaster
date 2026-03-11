import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { applyJudgeResult } from "@/lib/judge-stats";

export const runtime = "nodejs";

const CaseSchema = z.object({
  testcaseId: z.string().optional(),
  status: z.string(),
  timeMs: z.number().int().nonnegative(),
  memoryMb: z.number().int().nonnegative(),
  score: z.number().int().nonnegative(),
});

const CallbackSchema = z.object({
  submissionId: z.string(),
  status: z.string(),
  score: z.number().int().nonnegative(),
  cases: z.array(CaseSchema).optional(),
});

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-judge-secret");
  const configured = process.env.JUDGE_CALLBACK_SECRET;
  const expectedBuffer = configured ? Buffer.from(configured) : null;
  const providedBuffer = secret ? Buffer.from(secret) : null;

  const authorized =
    expectedBuffer &&
    providedBuffer &&
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer);

  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = CallbackSchema.parse(await req.json());

  await applyJudgeResult({
    submissionId: payload.submissionId,
    status: payload.status,
    score: payload.score,
    cases: payload.cases,
  });

  return NextResponse.json({ ok: true });
}
