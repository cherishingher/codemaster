#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const FETCH_SCRIPT = path.join(__dirname, "fetch_gesp_scratch_cpp.py");
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, "tmp", "gesp_scratch_cpp_full");
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
    minLevel: 2,
    maxLevel: 8,
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
    } else if (arg === "--min-level") {
      args.minLevel = Number(argv[++i] ?? "2");
    } else if (arg === "--max-level") {
      args.maxLevel = Number(argv[++i] ?? "8");
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function ensureFetched(outputDir, fetchLimit, forceFetch, minLevel, maxLevel) {
  fs.mkdirSync(outputDir, { recursive: true });
  const args = [
    FETCH_SCRIPT,
    "--limit",
    String(fetchLimit),
    "--min-level",
    String(minLevel),
    "--max-level",
    String(maxLevel),
    "--output-dir",
    outputDir,
  ];
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

function extractGraphicalQuestionTitle(problemText) {
  const lines = problemText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^\s*\d+、\s*(.+?)\s*$/);
    if (match?.[1]) return match[1].trim();
  }

  for (const line of lines) {
    const match = line.match(/^\s*\d+[.．]\s*(.+?)\s*$/);
    if (match?.[1]) return match[1].trim();
  }

  return lines[0] || "未命名题目";
}

function extractCppQuestionTitle(problemText) {
  const match = problemText.match(/试题名称[:：]\s*(.+)/);
  if (match?.[1]) return match[1].trim();
  const lines = problemText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines[1] || lines[0] || "未命名题目";
}

function trackSlug(track) {
  return track === "graphical" ? "graphical" : "cpp";
}

function trackLabel(track) {
  return track === "graphical" ? "图形化编程" : "C++";
}

function trackJudgeTag(track) {
  return track === "graphical" ? "scratch" : "cpp";
}

function buildSlug(month, track, level, questionNo) {
  return `gesp-${trackSlug(track)}-level${level}-${month}-q${questionNo}`;
}

function buildSource(month, track, level) {
  return `CCF GESP ${trackLabel(track)}${LEVEL_LABELS[level]} ${month}`;
}

function buildTags(month, track, level) {
  return ["gesp", "ccf", trackLabel(track), LEVEL_LABELS[level], trackJudgeTag(track), month];
}

function extractSection(problemText, startLabel, endLabels) {
  const start = problemText.indexOf(startLabel);
  if (start < 0) return null;
  let end = problemText.length;
  for (const label of endLabels) {
    const found = problemText.indexOf(label, start + startLabel.length);
    if (found >= 0 && found < end) end = found;
  }
  return problemText.slice(start + startLabel.length, end).trim();
}

function parseCppLimits(problemText) {
  const timeMatch = problemText.match(/时间限制[:：]\s*([0-9.]+)\s*s/i);
  const memoryMatch = problemText.match(/内存限制[:：]\s*([0-9.]+)\s*MB/i);
  return {
    timeLimitMs: timeMatch ? Math.round(Number(timeMatch[1]) * 1000) : 1000,
    memoryLimitMb: memoryMatch ? Math.round(Number(memoryMatch[1])) : 512,
  };
}

function buildGraphicalVersionData(problemText, manifest, questionNo) {
  return {
    version: 1,
    statement: [
      problemText.trim(),
      "",
      "来源信息：",
      `- 月份：${manifest.month}`,
      `- 第 ${questionNo} 题`,
      `- 页面：${manifest.pageUrl}`,
      `- PDF：${manifest.pdfUrl}`,
    ].join("\n"),
    statementMd: [
      `# ${extractGraphicalQuestionTitle(problemText)}`,
      "",
      problemText.trim(),
      "",
      "## 来源",
      "",
      `- 月份：${manifest.month}`,
      `- 题号：第 ${questionNo} 题`,
      `- 页面：${manifest.pageUrl}`,
      `- PDF：${manifest.pdfUrl}`,
    ].join("\n"),
    constraints:
      extractSection(problemText, "【输入描述】", ["【输出描述】", "【输入样例】"]) ??
      "图形化编程题，无标准数值约束；请按题面实现角色、变量、动作与交互要求。",
    inputFormat:
      extractSection(problemText, "【输入描述】", ["【输出描述】", "【输入样例】"]) ??
      "图形化编程题，无标准输入，请按题面给定变量赋值。",
    outputFormat:
      extractSection(problemText, "【输出描述】", ["【输入样例】", "【注意事项】", "注意事项："]) ??
      "图形化编程题，无标准输出，请按题面将结果存入指定变量或完成指定效果。",
    samples: null,
    hints: extractSection(problemText, "【注意事项】", ["【参考程序】"]) ?? extractSection(problemText, "注意事项：", ["【参考程序】"]) ?? "",
    notes: `原始 PDF：${manifest.pdfUrl}`,
    timeLimitMs: 1000,
    memoryLimitMb: 256,
  };
}

function buildCppVersionData(problemText, manifest, questionNo) {
  const limits = parseCppLimits(problemText);
  return {
    version: 1,
    statement: [
      problemText.trim(),
      "",
      "来源信息：",
      `- 月份：${manifest.month}`,
      `- 第 ${questionNo} 题`,
      `- 页面：${manifest.pageUrl}`,
      `- PDF：${manifest.pdfUrl}`,
    ].join("\n"),
    statementMd: [
      `# ${extractCppQuestionTitle(problemText)}`,
      "",
      problemText.trim(),
      "",
      "## 来源",
      "",
      `- 月份：${manifest.month}`,
      `- 题号：第 ${questionNo} 题`,
      `- 页面：${manifest.pageUrl}`,
      `- PDF：${manifest.pdfUrl}`,
    ].join("\n"),
    constraints:
      extractSection(problemText, "3.1.4 样例", ["3.1.5 参考程序"]) ??
      extractSection(problemText, "3.2.4 样例", ["3.2.5 参考程序"]) ??
      "请参考题面中的“对于全部数据，保证有 ……”约束描述。",
    inputFormat:
      extractSection(problemText, "输入格式", ["输出格式", "样例", "参考程序"]) ??
      "请参考题面中的输入格式描述。",
    outputFormat:
      extractSection(problemText, "输出格式", ["样例", "参考程序"]) ??
      "请参考题面中的输出格式描述。",
    samples: null,
    hints: "",
    notes: `原始 PDF：${manifest.pdfUrl}`,
    timeLimitMs: limits.timeLimitMs,
    memoryLimitMb: limits.memoryLimitMb,
  };
}

function buildVersionData(problemText, manifest, questionNo) {
  if (manifest.track === "graphical") {
    return buildGraphicalVersionData(problemText, manifest, questionNo);
  }
  return buildCppVersionData(problemText, manifest, questionNo);
}

function buildJudgeConfig(versionId, manifest) {
  if (manifest.track === "graphical") {
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

  return {
    versionId,
    language: "cpp17",
    languageId: 1,
    judgeMode: "standard",
    timeLimitMs: 1000,
    memoryLimitMb: 512,
    isEnabled: true,
    isDefault: true,
    sortOrder: 10,
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

async function upsertProblem(prisma, payload, manifest) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.problem.findUnique({
      where: { slug: payload.slug },
      include: {
        versions: {
          where: { version: 1 },
          take: 1,
        },
      },
    });

    const baseData = {
      slug: payload.slug,
      title: payload.title,
      difficulty: Math.min(manifest.level, 5),
      status: 20,
      visible: true,
      defunct: "N",
      visibility: "public",
      source: payload.source,
      publishedAt: new Date(),
    };

    const problem = existing
      ? await tx.problem.update({ where: { id: existing.id }, data: baseData })
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

    const judgeConfig = buildJudgeConfig(version.id, manifest);
    const existingConfig = await tx.problemJudgeConfig.findFirst({
      where: {
        versionId: version.id,
        judgeMode: judgeConfig.judgeMode,
        language: judgeConfig.language,
      },
      select: { id: true },
    });

    if (!existingConfig) {
      await tx.problemJudgeConfig.create({ data: judgeConfig });
    }

    return { problemId: problem.id, versionId: version.id, existed: Boolean(existing) };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const reportPath = path.join(args.outputDir, "_import_report.json");
  loadDotEnv(path.join(ROOT_DIR, ".env"));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  if (!args.skipFetch) {
    ensureFetched(args.outputDir, args.fetchLimit, args.forceFetch, args.minLevel, args.maxLevel);
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
      const bundleDirs = fs
        .readdirSync(monthDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      for (const bundle of bundleDirs) {
        const bundleDir = path.join(monthDir, bundle);
        const manifestPath = path.join(bundleDir, "manifest.json");
        if (!fs.existsSync(manifestPath)) continue;
        const manifest = readJson(manifestPath);

        for (const questionNo of [1, 2]) {
          const filePath = path.join(bundleDir, `problem_${questionNo}.txt`);
          const item = {
            month,
            track: manifest.track,
            level: manifest.level,
            questionNo,
            slug: buildSlug(month, manifest.track, manifest.level, questionNo),
            status: "pending",
          };

          try {
            const problemText = fs.readFileSync(filePath, "utf8").trim();
            if (!problemText) {
              throw new Error("empty problem text");
            }

            const title =
              manifest.track === "graphical"
                ? extractGraphicalQuestionTitle(problemText)
                : extractCppQuestionTitle(problemText);

            const payload = {
              slug: item.slug,
              title,
              source: buildSource(month, manifest.track, manifest.level),
              tags: buildTags(month, manifest.track, manifest.level),
              versionData: buildVersionData(problemText, manifest, questionNo),
            };

            if (args.dryRun) {
              item.status = "dry-run";
              item.title = title;
            } else {
              const result = await upsertProblem(prisma, payload, manifest);
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
    }
  } finally {
    await prisma.$disconnect();
  }

  fs.mkdirSync(args.outputDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  const summary = {
    outputDir: args.outputDir,
    reportPath,
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
