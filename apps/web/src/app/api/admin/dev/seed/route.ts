import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { storeTextAsset } from "@/lib/storage";

export const POST = withAuth(async (_req, _ctx, user) => {
  const existing = await db.problem.findFirst({
    where: { title: "Two Sum (Seed)" },
  });

  if (existing) {
    return NextResponse.json({ ok: true, created: 0, message: "seed_exists" });
  }

  const created = await db.$transaction(async (tx) => {
    const problem = await tx.problem.create({
      data: {
        title: "Two Sum (Seed)",
        difficulty: 2,
        visibility: "public",
        source: "seed",
      },
    });

    const tag = await tx.tag.upsert({
      where: { name: "array" },
      create: { name: "array" },
      update: {},
    });
    await tx.problemTag.create({
      data: { problemId: problem.id, tagId: tag.id },
    });

    const version = await tx.problemVersion.create({
      data: {
        problemId: problem.id,
        version: 1,
        statement: "Given an array of integers and a target, return indices of the two numbers.",
        inputFormat: "n target\\nnums...",
        outputFormat: "i j",
        constraints: "2 <= n <= 1e5",
        samples: [
          { input: "4 9\\n2 7 11 15", output: "0 1" },
        ],
        timeLimitMs: 1000,
        memoryLimitMb: 256,
      },
    });

    const inputUri = await storeTextAsset("inputs", "4 9\n2 7 11 15\n");
    const outputUri = await storeTextAsset("outputs", "0 1\n");

    await tx.testcase.create({
      data: {
        versionId: version.id,
        inputUri,
        outputUri,
        score: 100,
        isSample: true,
        orderIndex: 1,
      },
    });

    await tx.solution.create({
      data: {
        problemId: problem.id,
        versionId: version.id,
        title: "Hash Map Solution",
        content: "Use a hash map to store visited values and their indices.",
        type: "official",
        visibility: "public",
        authorId: user.id,
      },
    });

    const set = await tx.problemSet.create({
      data: {
        title: "Starter Set (Seed)",
        description: "Basic warm-up problems",
        visibility: "public",
        ownerId: user.id,
      },
    });
    await tx.problemSetItem.create({
      data: {
        setId: set.id,
        problemId: problem.id,
        orderIndex: 1,
      },
    });

    return problem.id;
  });

  return NextResponse.json({ ok: true, created: 1, id: created });
}, { roles: "admin" });
