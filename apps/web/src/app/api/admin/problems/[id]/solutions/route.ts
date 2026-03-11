import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

function normalizeAccessLevel(value?: string | null) {
  const normalized = value?.trim().toUpperCase()
  if (!normalized) return null

  if (["FREE", "MEMBERSHIP", "PURCHASE", "MEMBERSHIP_OR_PURCHASE"].includes(normalized)) {
    return normalized
  }

  return null
}

const CreateSolutionSchema = z.object({
  title: z.string().min(1),
  summary: z.string().trim().max(1000).optional(),
  content: z.string().min(1),
  type: z.enum(["official", "ugc"]).default("official"),
  visibility: z.enum(["public", "vip", "purchase", "private"]).default("public"),
  accessLevel: z.enum(["FREE", "MEMBERSHIP", "PURCHASE", "MEMBERSHIP_OR_PURCHASE"]).optional(),
  isPremium: z.boolean().optional(),
  versionId: z.string().optional(),
  videoUrl: z.string().url().optional(),
});

export const GET = withAuth(async (_req, { params }) => {
  const solutions = await db.solution.findMany({
    where: { problemId: params.id },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true } },
      version: { select: { id: true, version: true } },
    },
  });

  return NextResponse.json(
    solutions.map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary,
      content: s.content,
      type: s.type,
      visibility: s.visibility,
      accessLevel: s.accessLevel,
      isPremium: s.isPremium,
      videoUrl: s.videoUrl,
      author: s.author,
      version: s.version,
      createdAt: s.createdAt,
    }))
  );
}, { roles: "admin" });

export const POST = withAuth(async (req, { params }, user) => {
  const payload = CreateSolutionSchema.parse(await req.json());
  const accessLevel = normalizeAccessLevel(payload.accessLevel)
  const isPremium = payload.isPremium ?? (accessLevel ? accessLevel !== "FREE" : payload.visibility !== "public")

  const solution = await db.solution.create({
    data: {
      problemId: params.id,
      versionId: payload.versionId,
      title: payload.title,
      summary: payload.summary,
      content: payload.content,
      type: payload.type,
      visibility: payload.visibility,
      accessLevel,
      isPremium,
      videoUrl: payload.videoUrl,
      authorId: user.id,
    },
  });

  return NextResponse.json({ id: solution.id });
}, { roles: "admin" });
