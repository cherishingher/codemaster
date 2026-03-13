import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROJECT_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const REPORT_PATH = path.join(PROJECT_ROOT, "tmp", "gesp_problem_sets_report.json");

const LEVEL_LABELS = {
  1: "一级",
  2: "二级",
  3: "三级",
  4: "四级",
  5: "五级",
  6: "六级",
  7: "七级",
  8: "八级",
};

function parseArgs(argv) {
  const args = {
    ownerEmail: process.env.BOOTSTRAP_ADMIN_EMAIL ?? null,
    reportPath: REPORT_PATH,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--owner-email") {
      args.ownerEmail = argv[index + 1] ?? null;
      index += 1;
    } else if (value === "--report-path") {
      args.reportPath = path.resolve(argv[index + 1] ?? REPORT_PATH);
      index += 1;
    }
  }
  return args;
}

function parseLevel(problem) {
  const candidates = [
    problem.source ?? "",
    ...problem.tags.map((tag) => tag.tag.name ?? ""),
    problem.title ?? "",
  ];
  for (const text of candidates) {
    if (/八级|8级|level\s*8/i.test(text)) return 8;
    if (/七级|7级|level\s*7/i.test(text)) return 7;
    if (/六级|6级|level\s*6/i.test(text)) return 6;
    if (/五级|5级|level\s*5/i.test(text)) return 5;
    if (/四级|4级|level\s*4/i.test(text)) return 4;
    if (/三级|3级|level\s*3/i.test(text)) return 3;
    if (/二级|2级|level\s*2/i.test(text)) return 2;
    if (/一级|1级|level\s*1/i.test(text)) return 1;
  }
  return null;
}

function compareGespProblems(a, b) {
  const sourceA = a.source ?? "";
  const sourceB = b.source ?? "";
  const monthA = sourceA.match(/(\d{4}-\d{2})/)?.[1] ?? "";
  const monthB = sourceB.match(/(\d{4}-\d{2})/)?.[1] ?? "";
  if (monthA !== monthB) {
    return monthA.localeCompare(monthB);
  }
  return a.slug.localeCompare(b.slug);
}

async function resolveOwner(ownerEmail) {
  if (ownerEmail) {
    const owner = await prisma.user.findUnique({
      where: { email: ownerEmail },
      select: { id: true, email: true, name: true },
    });
    if (owner) return owner;
  }

  const fallback = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true },
  });
  if (!fallback) {
    throw new Error("No user found to own GESP problem sets");
  }
  return fallback;
}

async function ensureProblemSet(ownerId, level, problemIds) {
  const label = LEVEL_LABELS[level];
  const slug = `gesp-level-${level}`;
  const title = `GESP ${label}题单`;
  const summary = `按 GESP ${label} 整理的题目集合。`;
  const description =
    level === 1
      ? "当前已自动收录图形化编程一级题目，后续同等级题目可继续归入该题单。"
      : `预留的 GESP ${label}题单，后续导入对应等级题目后将自动归类。`;

  const set = await prisma.problemSet.upsert({
    where: { slug },
    update: {
      title,
      summary,
      description,
      kind: "problem_set",
      status: "published",
      visibility: "public",
      ownerId,
    },
    create: {
      slug,
      title,
      summary,
      description,
      kind: "problem_set",
      status: "published",
      visibility: "public",
      ownerId,
    },
  });

  await prisma.problemSetItem.deleteMany({
    where: { setId: set.id },
  });

  if (problemIds.length > 0) {
    await prisma.problemSetItem.createMany({
      data: problemIds.map((problemId, index) => ({
        setId: set.id,
        problemId,
        orderIndex: index + 1,
      })),
      skipDuplicates: true,
    });
  }

  return {
    id: set.id,
    slug: set.slug,
    title: set.title,
    itemCount: problemIds.length,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const owner = await resolveOwner(args.ownerEmail);

  const problems = await prisma.problem.findMany({
    where: {
      OR: [
        { source: { contains: "GESP" } },
        { tags: { some: { tag: { name: { equals: "gesp" } } } } },
      ],
    },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });

  const grouped = new Map(Array.from({ length: 8 }, (_, index) => [index + 1, []]));
  const unmatched = [];

  for (const problem of problems) {
    const level = parseLevel(problem);
    if (!level || !grouped.has(level)) {
      unmatched.push({
        slug: problem.slug,
        title: problem.title,
        source: problem.source,
        tags: problem.tags.map((entry) => entry.tag.name),
      });
      continue;
    }
    grouped.get(level).push(problem);
  }

  const sets = [];
  for (let level = 1; level <= 8; level += 1) {
    const rows = grouped.get(level).sort(compareGespProblems);
    const set = await ensureProblemSet(
      owner.id,
      level,
      rows.map((row) => row.id),
    );
    sets.push({
      level,
      ...set,
      problems: rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        source: row.source,
      })),
    });
  }

  const report = {
    owner,
    totalMatchedProblems: problems.length - unmatched.length,
    unmatchedCount: unmatched.length,
    unmatched,
    sets: sets.map((set) => ({
      level: set.level,
      slug: set.slug,
      title: set.title,
      itemCount: set.itemCount,
      sampleProblems: set.problems.slice(0, 5),
    })),
  };

  await fs.mkdir(path.dirname(args.reportPath), { recursive: true });
  await fs.writeFile(args.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    reportPath: args.reportPath,
    owner: owner.email ?? owner.id,
    totalMatchedProblems: report.totalMatchedProblems,
    unmatchedCount: report.unmatchedCount,
    sets: sets.map((set) => ({
      level: set.level,
      slug: set.slug,
      itemCount: set.itemCount,
    })),
  }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
