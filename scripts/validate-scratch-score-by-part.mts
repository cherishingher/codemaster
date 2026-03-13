import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  isScratchScoreByPartRuleSet,
  scoreScratchProjectByParts,
} from "../apps/web/src/lib/scratch-judge.ts";

const require = createRequire(import.meta.url);
const Parse = require("unzipper/lib/parse");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultRulesPath = path.resolve(
  __dirname,
  "../tmp/gesp_graphical_level1_full/2025-12/problem_1_scratchRules.json"
);

async function readZipEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  const tasks: Promise<void>[] = [];

  await new Promise<void>((resolve, reject) => {
    Readable.from(buffer)
      .pipe(Parse())
      .on("entry", (entry: { path: string; type?: string; autodrain: () => void; on: Function }) => {
        if (entry.type && entry.type !== "File") {
          entry.autodrain();
          return;
        }

        const task = new Promise<void>((res, rej) => {
          const chunks: Buffer[] = [];
          entry.on("data", (chunk: Buffer) => chunks.push(chunk));
          entry.on("end", () => {
            entries.set(entry.path, Buffer.concat(chunks));
            res();
          });
          entry.on("error", rej);
        });
        tasks.push(task);
      })
      .on("error", reject)
      .on("close", () => {
        Promise.all(tasks).then(() => resolve()).catch(reject);
      });
  });

  return entries;
}

async function parseScratchProject(filePath: string) {
  const buffer = await readFile(filePath);
  if (filePath.toLowerCase().endsWith(".sb3")) {
    const entries = await readZipEntries(buffer);
    const projectEntry =
      entries.get("project.json") ??
      [...entries.entries()].find(([name]) => name.endsWith("/project.json"))?.[1];
    if (!projectEntry) {
      throw new Error("project_json_not_found");
    }
    return JSON.parse(projectEntry.toString("utf8"));
  }

  return JSON.parse(buffer.toString("utf8"));
}

async function main() {
  const projectPath = process.argv[2];
  const rulesPath = process.argv[3] ?? defaultRulesPath;

  if (!projectPath) {
    console.error("Usage: node --experimental-strip-types scripts/validate-scratch-score-by-part.mts <project.sb3|project.json> [rules.json]");
    process.exit(1);
  }

  const [project, rulesRaw] = await Promise.all([
    parseScratchProject(path.resolve(projectPath)),
    readFile(path.resolve(rulesPath), "utf8").then((content) => JSON.parse(content)),
  ]);

  if (!isScratchScoreByPartRuleSet(rulesRaw)) {
    throw new Error("rules_file_must_be_score_by_part");
  }

  const result = scoreScratchProjectByParts(project, rulesRaw);
  console.log(
    JSON.stringify(
      {
        projectPath: path.resolve(projectPath),
        rulesPath: path.resolve(rulesPath),
        result,
      },
      null,
      2
    )
  );

  if (result.score !== result.total || result.passed !== rulesRaw.parts.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
