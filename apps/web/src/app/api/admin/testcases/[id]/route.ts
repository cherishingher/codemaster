import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const UpdateTestcaseSchema = z.object({
  title: z.string().nullable().optional(),
  caseType: z.number().int().min(0).max(2).optional(),
  visible: z.boolean().optional(),
  score: z.number().int().min(0).optional(),
  groupId: z.string().nullable().optional(),
  isSample: z.boolean().optional(),
  orderIndex: z.number().int().nullable().optional(),
});

export const GET = withAuth(async (_req, { params }) => {
  const testcase = await db.testcase.findUnique({
    where: { id: params.id },
  });

  if (!testcase) {
    return NextResponse.json({ error: "testcase_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: testcase.id,
    versionId: testcase.versionId,
    title: testcase.title,
    caseType: testcase.caseType,
    visible: testcase.visible,
    score: testcase.score,
    groupId: testcase.groupId,
    isSample: testcase.isSample,
    orderIndex: testcase.orderIndex,
  });
}, { roles: "admin" });

export const PATCH = withAuth(async (req, { params }) => {
  const payload = UpdateTestcaseSchema.parse(await req.json());

  const existing = await db.testcase.findUnique({
    where: { id: params.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "testcase_not_found" }, { status: 404 });
  }

  const nextCaseType = payload.caseType ?? existing.caseType;
  const nextIsSample = payload.isSample ?? nextCaseType === 0;
  const nextVisible =
    payload.visible ?? (nextCaseType === 0 ? true : existing.visible);

  const updated = await db.testcase.update({
    where: { id: params.id },
    data: {
      title: payload.title === undefined ? undefined : payload.title,
      caseType: nextCaseType,
      visible: nextVisible,
      score: payload.score,
      groupId: payload.groupId === undefined ? undefined : payload.groupId,
      isSample: nextIsSample,
      orderIndex:
        payload.orderIndex === undefined ? undefined : payload.orderIndex,
    },
  });

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    caseType: updated.caseType,
    visible: updated.visible,
    score: updated.score,
    groupId: updated.groupId,
    isSample: updated.isSample,
    orderIndex: updated.orderIndex,
  });
}, { roles: "admin" });

export const DELETE = withAuth(async (_req, { params }) => {
  const existing = await db.testcase.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "testcase_not_found" }, { status: 404 });
  }

  await db.testcase.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ ok: true, id: params.id });
}, { roles: "admin" });
