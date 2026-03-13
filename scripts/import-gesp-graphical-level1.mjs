#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const FETCH_SCRIPT = path.join(__dirname, "fetch_gesp_graphical_level1.py");
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, "tmp", "gesp_graphical_level1_full");
const REPORT_PATH = path.join(DEFAULT_OUTPUT_DIR, "_import_report.json");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {
    outputDir: DEFAULT_OUTPUT_DIR,
    fetchLimit: 100,
    skipFetch: false,
    forceFetch: false,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--output-dir") {
      args.outputDir = path.resolve(argv[++i]);
    } else if (arg === "--fetch-limit") {
      args.fetchLimit = Number(argv[++i] ?? "100");
    } else if (arg === "--skip-fetch") {
      args.skipFetch = true;
    } else if (arg === "--force-fetch") {
      args.forceFetch = true;
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function ensureFetched(outputDir, fetchLimit, forceFetch) {
  fs.mkdirSync(outputDir, { recursive: true });
  const args = [FETCH_SCRIPT, "--limit", String(fetchLimit), "--output-dir", outputDir];
  if (forceFetch) args.push("--force");
  const result = spawnSync("python3", args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`fetch script failed with exit code ${result.status ?? "unknown"}`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function extractQuestionTitle(problemText) {
  const firstLine = (problemText.split(/\r?\n/)[0] ?? "").trim();
  const match = firstLine.match(/^\s*\d+[、.．]\s*(.+?)\s*$/);
  return match ? match[1].trim() : firstLine || "未命名题目";
}

function buildSlug(month, questionNo) {
  return `gesp-graphical-level1-${month}-q${questionNo}`;
}

function buildSource(month) {
  return `CCF GESP 图形化编程一级 ${month}`;
}

function buildTags(month) {
  return ["gesp", "ccf", "图形化编程", "一级", "scratch", month];
}

function buildStatement(problemText, manifest, questionNo) {
  const lines = [
    problemText.trim(),
    "",
    "来源信息：",
    `- 月份：${manifest.month}`,
    `- 第 ${questionNo} 题`,
    `- 页面：${manifest.pageUrl}`,
    `- PDF：${manifest.pdfUrl}`,
  ];
  return lines.join("\n");
}

function buildStatementMd(problemText, manifest, questionNo) {
  const title = extractQuestionTitle(problemText);
  const body = problemText
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .join("\n");
  return [
    `# ${title}`,
    "",
    body,
    "",
    "## 来源",
    "",
    `- 月份：${manifest.month}`,
    `- 题号：第 ${questionNo} 题`,
    `- 页面：${manifest.pageUrl}`,
    `- PDF：${manifest.pdfUrl}`,
  ].join("\n");
}

function extractSection(text, title, stops) {
  const startIndex = text.indexOf(title);
  if (startIndex < 0) return "";
  const colonIndex = text.indexOf("：", startIndex);
  const contentStart = colonIndex >= 0 ? colonIndex + 1 : startIndex + title.length;
  const tail = text.slice(contentStart);
  let endIndex = tail.length;
  for (const stop of stops) {
    const hit = tail.indexOf(stop);
    if (hit >= 0 && hit < endIndex) {
      endIndex = hit;
    }
  }
  return tail.slice(0, endIndex).trim();
}

function extractNumberedItems(section) {
  const normalized = section.replace(/\uF06C/g, "\n").trim();
  const regex = /[（(](\d+)[）)]/g;
  const matches = [...normalized.matchAll(regex)];
  const items = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length;
    items.push({
      index: Number(match[1]),
      text: normalized.slice(start, end).replace(/\s*\n\s*/g, " ").trim(),
    });
  }
  return items;
}

function parseRoleHints(notesSection) {
  const map = new Map();
  for (const rawLine of notesSection.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const indexes = [...line.matchAll(/[（(](\d+)[）)]/g)].map((item) => Number(item[1]));
    if (!indexes.length) continue;

    let role = null;
    if (/背景代码区/.test(line)) {
      role = "Stage";
    } else {
      const roleMatch =
        line.match(/角色\s*([A-Za-z0-9_-]+)\s*代码区/) ??
        line.match(/角色\s*([^\s（）()，。,]+)\s*代码区/);
      if (roleMatch?.[1]) role = roleMatch[1];
    }
    if (!role) continue;

    for (const index of indexes) {
      map.set(index, role);
    }
  }
  return map;
}

function distributeScores(totalScore, count) {
  const total = Number.isFinite(totalScore) && totalScore > 0 ? Math.floor(totalScore) : count;
  const base = Math.floor(total / count);
  let remainder = total % count;
  return Array.from({ length: count }, () => {
    const score = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return score;
  });
}

function buildScratchRuleDraft(problemText, totalScore = 100) {
  const implementationSection = extractSection(problemText, "功能实现", ["注意事项", "参考程序"]);
  const items = extractNumberedItems(implementationSection);
  if (!items.length) return null;

  const notesSection = extractSection(problemText, "注意事项", ["参考程序"]);
  const roleMap = parseRoleHints(notesSection);
  const scores = distributeScores(totalScore, items.length);

  return {
    version: 1,
    mode: "score_by_part_draft",
    source: "statement",
    totalScore,
    parts: items.map((item, index) => ({
      id: `r${item.index}`,
      index: item.index,
      title: item.text.slice(0, 32) || `part ${item.index}`,
      description: item.text,
      role: roleMap.get(item.index),
      score: scores[index],
      ordered: /依次|先|后|然后|再|直到/.test(item.text),
      consecutive: /依次|然后|再等待|再切换|再以|之后/.test(item.text),
    })),
  };
}

function buildVersionData(problemText, manifest, questionNo) {
  return {
    version: 1,
    statement: buildStatement(problemText, manifest, questionNo),
    statementMd: buildStatementMd(problemText, manifest, questionNo),
    constraints: "图形化编程题，无标准数值约束；请按照题面描述完成角色、背景、按键、动作与次数要求。",
    inputFormat: "本题为图形化编程实践题，无标准输入。请在图形化编程环境中按题面要求搭建程序。",
    outputFormat: "本题为图形化编程实践题，无标准输出，以最终作品效果与交互逻辑满足题意为准。",
    samples: null,
    hints: "建议根据“准备工作 / 功能实现 / 注意事项”分块实现。",
    notes: `原始 PDF：${manifest.pdfUrl}`,
    scratchRules: buildScratchRuleDraft(problemText),
    timeLimitMs: 1000,
    memoryLimitMb: 256,
  };
}

function buildScratchJudgeConfig(versionId) {
  return {
    versionId,
    language: "scratch-optional",
    languageId: 1001,
    judgeMode: "scratch",
    timeLimitMs: null,
    memoryLimitMb: null,
    isEnabled: true,
    isDefault: true,
    sortOrder: 50,
  };
}

async function ensureTags(tx, problemId, tagNames) {
  for (const tagName of tagNames) {
    const tag = await tx.tag.upsert({
      where: { name: tagName },
      create: { name: tagName },
      update: {},
    });
    await tx.problemTag.upsert({
      where: {
        problemId_tagId: {
          problemId,
          tagId: tag.id,
        },
      },
      create: { problemId, tagId: tag.id },
      update: {},
    });
  }
}

async function upsertProblem(prisma, payload) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.problem.findUnique({
      where: { slug: payload.slug },
      include: {
        currentVersion: true,
        versions: {
          where: { version: 1 },
          take: 1,
        },
      },
    });

    const baseData = {
      slug: payload.slug,
      title: payload.title,
      difficulty: payload.difficulty,
      status: 20,
      visible: true,
      defunct: "N",
      visibility: "public",
      source: payload.source,
      publishedAt: new Date(),
    };

    const problem = existing
      ? await tx.problem.update({
          where: { id: existing.id },
          data: baseData,
        })
      : await tx.problem.create({ data: baseData });

    await ensureTags(tx, problem.id, payload.tags);

    const currentVersion = existing?.versions?.[0] ?? null;
    const version = currentVersion
      ? await tx.problemVersion.update({
          where: { id: currentVersion.id },
          data: payload.versionData,
        })
      : await tx.problemVersion.create({
          data: {
            problemId: problem.id,
            ...payload.versionData,
          },
        });

    await tx.problem.update({
      where: { id: problem.id },
      data: { currentVersionId: version.id },
    });

    const existingScratchConfig = await tx.problemJudgeConfig.findFirst({
      where: { versionId: version.id, judgeMode: "scratch" },
      select: { id: true },
    });

    if (!existingScratchConfig) {
      await tx.problemJudgeConfig.create({
        data: buildScratchJudgeConfig(version.id),
      });
    }

    return { problemId: problem.id, versionId: version.id, existed: Boolean(existing) };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  loadDotEnv(path.join(ROOT_DIR, ".env"));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  if (!args.skipFetch) {
    ensureFetched(args.outputDir, args.fetchLimit, args.forceFetch);
  }

  const monthDirs = fs
    .readdirSync(args.outputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const prisma = new PrismaClient({ log: ["error", "warn"] });
  const report = [];

  try {
    for (const month of monthDirs) {
      const monthDir = path.join(args.outputDir, month);
      const manifestPath = path.join(monthDir, "manifest.json");
      if (!fs.existsSync(manifestPath)) continue;

      const manifest = readJson(manifestPath);
      for (const questionNo of [1, 2]) {
        const filePath = path.join(monthDir, `problem_${questionNo}.txt`);
        const item = {
          month,
          questionNo,
          slug: buildSlug(month, questionNo),
          status: "pending",
        };

        try {
          const problemText = fs.readFileSync(filePath, "utf8").trim();
          if (!problemText) {
            throw new Error("empty problem text");
          }

          const title = extractQuestionTitle(problemText);
          const payload = {
            slug: item.slug,
            title,
            difficulty: 1,
            source: buildSource(month),
            tags: buildTags(month),
            versionData: buildVersionData(problemText, manifest, questionNo),
          };

          if (args.dryRun) {
            item.status = "dry-run";
            item.title = title;
          } else {
            const result = await upsertProblem(prisma, payload);
            item.status = result.existed ? "updated" : "created";
            item.title = title;
            item.problemId = result.problemId;
            item.versionId = result.versionId;
          }
        } catch (error) {
          item.status = "error";
          item.error = error instanceof Error ? error.message : String(error);
        }

        report.push(item);
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  const summary = {
    outputDir: args.outputDir,
    reportPath: REPORT_PATH,
    processed: report.length,
    created: report.filter((item) => item.status === "created").length,
    updated: report.filter((item) => item.status === "updated").length,
    errors: report.filter((item) => item.status === "error").length,
    dryRun: args.dryRun,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
