import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

const CreateSolutionSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  type: z.enum(["official", "ugc"]).default("official"),
  visibility: z.enum(["public", "private"]).default("public"),
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
      content: s.content,
      type: s.type,
      visibility: s.visibility,
      videoUrl: s.videoUrl,
      author: s.author,
      version: s.version,
      createdAt: s.createdAt,
    }))
  );
}, { roles: "admin" });

export const POST = withAuth(async (req, { params }, user) => {
  const payload = CreateSolutionSchema.parse(await req.json());

  const solution = await db.solution.create({
    data: {
      problemId: params.id,
      versionId: payload.versionId,
      title: payload.title,
      content: payload.content,
      type: payload.type,
      visibility: payload.visibility,
      videoUrl: payload.videoUrl,
      authorId: user.id,
    },
  });

  return NextResponse.json({ id: solution.id });
}, { roles: "admin" });
