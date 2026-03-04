import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";
import { storeTextAsset } from "@/lib/storage";
import {
  buildJudgeConfigCreateManyInput,
  buildProblemLifecycleData,
  generateUniqueProblemSlug,
} from "@/lib/problem-admin";

type SeedProblem = {
  title: string;
  difficulty: number;
  visibility: "public" | "private" | "hidden" | "contest";
  source: string;
  tags: string[];
  statement: string;
  hints: string;
  constraints: string;
  inputFormat: string;
  outputFormat: string;
  samples: Array<{ input: string; output: string }>;
  testcases: Array<{
    input: string;
    output: string;
    score: number;
    isSample?: boolean;
    orderIndex: number;
  }>;
  solutionTitle: string;
  solutionContent: string;
};

const DEMO_PROBLEMS: SeedProblem[] = [
  {
    title: "Two Sum (Seed)",
    difficulty: 2,
    visibility: "public",
    source: "seed",
    tags: ["array", "hash-map"],
    statement: "Given an array of integers and a target, return the indices of the two numbers whose sum equals target.",
    hints: "Use a hash map to remember the numbers you have already seen.",
    constraints: "2 <= n <= 1e5",
    inputFormat: "n target\\nnums...",
    outputFormat: "i j",
    samples: [{ input: "4 9\\n2 7 11 15", output: "0 1" }],
    testcases: [
      { input: "4 9\\n2 7 11 15\\n", output: "0 1\\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "5 6\\n3 2 4 1 9\\n", output: "1 2\\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "Hash Map Solution",
    solutionContent: "Use a hash map to store visited values and their indices.",
  },
  {
    title: "A + B (Seed)",
    difficulty: 1,
    visibility: "public",
    source: "seed",
    tags: ["implementation", "math"],
    statement: "Read two integers and output their sum.",
    hints: "Read two numbers from stdin and print their sum directly.",
    constraints: "-1e9 <= a, b <= 1e9",
    inputFormat: "a b",
    outputFormat: "a + b",
    samples: [{ input: "1 2", output: "3" }],
    testcases: [
      { input: "1 2\\n", output: "3\\n", score: 50, isSample: true, orderIndex: 1 },
      { input: "-5 10\\n", output: "5\\n", score: 50, orderIndex: 2 },
    ],
    solutionTitle: "Direct Addition",
    solutionContent: "Read input, add the numbers, and print the result.",
  },
];

export const POST = withAuth(async (_req, _ctx, user) => {
  const existing = await db.problem.findMany({
    where: {
      title: {
        in: DEMO_PROBLEMS.map((item) => item.title),
      },
    },
    select: { title: true },
  });

  const existingTitles = new Set(existing.map((item) => item.title));
  const pending = DEMO_PROBLEMS.filter((item) => !existingTitles.has(item.title));

  if (!pending.length) {
    return NextResponse.json({ ok: true, created: 0, message: "seed_exists" });
  }

  const createdIds: string[] = [];

  for (const item of pending) {
    const createdId = await db.$transaction(async (tx) => {
      const slug = await generateUniqueProblemSlug(tx, item.title);
      const lifecycle = buildProblemLifecycleData(item.visibility);

      const problem = await tx.problem.create({
        data: {
          slug,
          title: item.title,
          difficulty: item.difficulty,
          status: lifecycle.status,
          visible: lifecycle.visible,
          defunct: lifecycle.defunct,
          visibility: item.visibility,
          source: item.source,
          publishedAt: lifecycle.publishedAt,
        },
      });

      for (const tagName of item.tags) {
        const tag = await tx.tag.upsert({
          where: { name: tagName },
          create: { name: tagName },
          update: {},
        });
        await tx.problemTag.create({
          data: { problemId: problem.id, tagId: tag.id },
        });
      }

      const version = await tx.problemVersion.create({
        data: {
          problemId: problem.id,
          version: 1,
          statement: item.statement,
          statementMd: item.statement,
          constraints: item.constraints,
          hints: item.hints,
          inputFormat: item.inputFormat,
          outputFormat: item.outputFormat,
          samples: item.samples,
          notes: item.solutionContent,
          timeLimitMs: 1000,
          memoryLimitMb: 256,
        },
      });

      await tx.problem.update({
        where: { id: problem.id },
        data: { currentVersionId: version.id },
      });

      for (const testcase of item.testcases) {
        const inputUri = await storeTextAsset("inputs", testcase.input);
        const outputUri = await storeTextAsset("outputs", testcase.output);
        await tx.testcase.create({
          data: {
            versionId: version.id,
            title: testcase.isSample ? "sample" : "hidden",
            caseType: testcase.isSample ? 0 : 1,
            visible: testcase.isSample ?? false,
            inputUri,
            outputUri,
            score: testcase.score,
            isSample: testcase.isSample ?? false,
            orderIndex: testcase.orderIndex,
          },
        });
      }

      const judgeConfigs = buildJudgeConfigCreateManyInput({
        versionId: version.id,
        tags: item.tags,
        timeLimitMs: version.timeLimitMs,
        memoryLimitMb: version.memoryLimitMb,
      });
      if (judgeConfigs.length) {
        await tx.problemJudgeConfig.createMany({
          data: judgeConfigs,
          skipDuplicates: true,
        });
      }

      await tx.solution.create({
        data: {
          problemId: problem.id,
          versionId: version.id,
          title: item.solutionTitle,
          content: item.solutionContent,
          type: "official",
          visibility: "public",
          authorId: user.id,
        },
      });

      return problem.id;
    });

    createdIds.push(createdId);
  }

  return NextResponse.json({ ok: true, created: createdIds.length, ids: createdIds });
}, { roles: "admin" });
