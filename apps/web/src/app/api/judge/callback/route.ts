import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
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

function secureCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.JUDGE_CALLBACK_SECRET;
  if (!expectedSecret) {
    console.error("[judge/callback] JUDGE_CALLBACK_SECRET is not set");
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const secret = req.headers.get("x-judge-secret");
  if (!secret || !secureCompare(secret, expectedSecret)) {
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
