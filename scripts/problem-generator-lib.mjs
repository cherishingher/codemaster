#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath, pathToFileURL } from 'url';

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
export const DEFAULT_GENERATOR_ROOT = path.join(REPO_ROOT, 'problem-generators');

function hashSeed(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRng(seedInput) {
  let seed = hashSeed(String(seedInput));
  const nextNumber = () => {
    seed += 0x6d2b79f5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next() {
      return nextNumber();
    },
    int(min, max) {
      const lower = Math.ceil(Math.min(min, max));
      const upper = Math.floor(Math.max(min, max));
      return lower + Math.floor(nextNumber() * (upper - lower + 1));
    },
    bool(probability = 0.5) {
      return nextNumber() < probability;
    },
    pick(values) {
      if (!Array.isArray(values) || values.length === 0) {
        throw new Error('Cannot pick from an empty array');
      }
      return values[this.int(0, values.length - 1)];
    },
    shuffle(values) {
      const copy = [...values];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = this.int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

export function normalizeOutputText(value) {
  return String(value ?? '').replace(/\r\n/g, '\n').trimEnd();
}

export function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeRunner(config, fallbackEntry, fallbackExport) {
  if (!config || typeof config !== 'object') {
    return { type: 'module', entry: fallbackEntry, export: fallbackExport };
  }

  if (config.type === 'command') {
    if (!Array.isArray(config.command) || config.command.length === 0) {
      throw new Error('command runner requires a non-empty command array');
    }
    return {
      type: 'command',
      command: config.command.map((item) => String(item)),
    };
  }

  return {
    type: 'module',
    entry: String(config.entry ?? fallbackEntry),
    export: String(config.export ?? fallbackExport),
  };
}

export async function loadGeneratorContext(generatorDir) {
  const absoluteDir = path.resolve(generatorDir);
  const specPath = path.join(absoluteDir, 'spec.json');
  const spec = await readJson(specPath);
  const bruteEntry = path.join(absoluteDir, 'brute.mjs');

  if (!Array.isArray(spec.groups) || spec.groups.length === 0) {
    throw new Error(`Generator spec at ${specPath} must contain non-empty groups`);
  }

  const hasDefaultBrute = await pathExists(bruteEntry);

  return {
    dir: absoluteDir,
    specPath,
    spec,
    solutionRunner: normalizeRunner(spec.solution, 'std.mjs', 'solve'),
    bruteRunner: spec.brute
      ? normalizeRunner(spec.brute, 'brute.mjs', 'solve')
      : hasDefaultBrute
        ? normalizeRunner({}, 'brute.mjs', 'solve')
        : null,
    generatorRunner: normalizeRunner(spec.generator, 'gen.mjs', 'generate'),
  };
}

async function invokeModuleRunner(filePath, exportName, args) {
  const mod = await import(`${pathToFileURL(filePath).href}?v=${Date.now()}`);
  const fn = mod?.[exportName];
  if (typeof fn !== 'function') {
    throw new Error(`Module ${filePath} does not export function ${exportName}`);
  }
  return fn(...args);
}

async function invokeCommandRunner(command, { cwd, input = '', context = null }) {
  const [binary, ...args] = command;
  const env = {
    ...process.env,
    GENERATOR_CONTEXT_JSON: context ? JSON.stringify(context) : '',
  };
  const { stdout } = await execFileAsync(binary, args, {
    cwd,
    env,
    input,
    maxBuffer: 20 * 1024 * 1024,
  });
  return stdout;
}

async function invokeRunner(runner, role, ctx, payload) {
  if (runner.type === 'command') {
    return invokeCommandRunner(runner.command, {
      cwd: ctx.dir,
      input: role === 'solution' ? payload.input ?? '' : '',
      context: role === 'generator' ? payload.context : payload.context,
    });
  }

  const entryPath = path.join(ctx.dir, runner.entry);
  if (role === 'generator') {
    return invokeModuleRunner(entryPath, runner.export, [payload.context]);
  }
  return invokeModuleRunner(entryPath, runner.export, [payload.input ?? '', payload.context]);
}

export async function runSolution(ctx, input, extraContext = {}) {
  const output = await invokeRunner(ctx.solutionRunner, 'solution', ctx, {
    input,
    context: {
      spec: ctx.spec,
      generatorDir: ctx.dir,
      ...extraContext,
    },
  });
  return normalizeOutputText(output);
}

export async function runBrute(ctx, input, extraContext = {}) {
  if (!ctx.bruteRunner) {
    throw new Error(`No brute runner configured for ${ctx.specPath}`);
  }
  const output = await invokeRunner(ctx.bruteRunner, 'solution', ctx, {
    input,
    context: {
      spec: ctx.spec,
      generatorDir: ctx.dir,
      ...extraContext,
    },
  });
  return normalizeOutputText(output);
}

export async function generateInput(ctx, group, caseIndex, globalIndex, overrides = {}) {
  const rng = createSeededRng(
    JSON.stringify({
      generator: ctx.spec.source ?? ctx.spec.slug ?? ctx.dir,
      group: group.name,
      caseIndex,
      globalIndex,
      seed: group.seed ?? overrides.seed ?? null,
    })
  );
  const result = await invokeRunner(ctx.generatorRunner, 'generator', ctx, {
    context: {
      spec: ctx.spec,
      generatorDir: ctx.dir,
      group,
      caseIndex,
      globalIndex,
      rng,
      helpers: {
        randInt: (min, max) => rng.int(min, max),
        randBool: (probability) => rng.bool(probability),
        randPick: (values) => rng.pick(values),
        randShuffle: (values) => rng.shuffle(values),
      },
      ...overrides,
    },
  });
  return String(result ?? '');
}

function distributeScore(totalScore, count) {
  const total = Number(totalScore ?? 0);
  if (!Number.isFinite(total) || total <= 0 || count <= 0) {
    return Array.from({ length: count }, () => 0);
  }
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function defaultCaseType(group) {
  if (group.caseType !== undefined) return Number(group.caseType);
  if (group.useSamples || group.name === 'sample') return 0;
  if (group.name.includes('stress')) return 2;
  return 1;
}

export async function resolveSampleCases(ctx, dbProblem) {
  const localSamples = Array.isArray(ctx.spec.samples)
    ? ctx.spec.samples
    : Array.isArray(ctx.spec.verify?.samples)
      ? ctx.spec.verify.samples
      : Array.isArray(dbProblem?.currentVersion?.samples)
        ? dbProblem.currentVersion.samples
        : [];

  return localSamples
    .map((sample, index) => {
      if (!sample || typeof sample !== 'object') return null;
      if (typeof sample.input !== 'string' || typeof sample.output !== 'string') return null;
      return {
        input: sample.input,
        output: sample.output,
        title: sample.title ?? `sample-${index + 1}`,
      };
    })
    .filter(Boolean);
}

export async function buildGeneratedCases(ctx, dbProblem) {
  const sampleCases = await resolveSampleCases(ctx, dbProblem);
  const cases = [];
  let globalIndex = 1;

  for (const group of ctx.spec.groups) {
    const groupCount = group.useSamples ? sampleCases.length : parsePositiveInt(group.count, 0);
    if (groupCount <= 0) continue;
    const scores = distributeScore(group.score ?? 0, groupCount);
    const caseType = defaultCaseType(group);
    const visible = group.visible ?? caseType === 0;
    const isSample = group.isSample ?? caseType === 0;

    for (let caseIndex = 0; caseIndex < groupCount; caseIndex += 1) {
      const orderIndex = globalIndex;
      let input;
      let output;
      let title;

      if (group.useSamples) {
        input = String(sampleCases[caseIndex].input ?? '');
        output = normalizeOutputText(sampleCases[caseIndex].output ?? '');
        title = String(sampleCases[caseIndex].title ?? `${group.name}-${caseIndex + 1}`);
      } else {
        input = await generateInput(ctx, group, caseIndex, globalIndex);
        output = await runSolution(ctx, input, {
          group,
          caseIndex,
          globalIndex,
          phase: 'generate',
        });
        title = String(group.titlePrefix ?? group.name ?? 'case');
      }

      cases.push({
        input: String(input ?? ''),
        output: normalizeOutputText(output),
        meta: {
          score: scores[caseIndex] ?? 0,
          isSample,
          visible,
          caseType,
          title: group.useSamples ? title : `${title}-${caseIndex + 1}`,
          groupId: group.groupId ?? group.name,
          orderIndex,
          timeLimitMs: group.timeLimitMs ?? null,
          memoryLimitKb: group.memoryLimitKb ?? null,
          subtaskId: group.subtaskId ?? null,
          isPretest: group.isPretest ?? false,
        },
      });
      globalIndex += 1;
    }
  }

  return cases;
}

export function buildConfigYaml(cases) {
  return cases
    .map((item, index) => {
      const lines = [`${index + 1}.in:`];
      const entries = [
        ['score', item.meta.score],
        ['isSample', item.meta.isSample],
        ['visible', item.meta.visible],
        ['caseType', item.meta.caseType],
        ['title', item.meta.title],
        ['groupId', item.meta.groupId],
        ['orderIndex', item.meta.orderIndex],
        ['timeLimitMs', item.meta.timeLimitMs],
        ['memoryLimitKb', item.meta.memoryLimitKb],
        ['subtaskId', item.meta.subtaskId],
        ['isPretest', item.meta.isPretest],
      ];
      for (const [key, value] of entries) {
        if (value === null || value === undefined || value === '') continue;
        lines.push(`  ${key}: ${typeof value === 'string' ? value : String(value)}`);
      }
      return lines.join('\n');
    })
    .join('\n\n')
    .concat('\n');
}

export async function writeProblemCaseDirectory(outputDir, problemSlug, cases) {
  const targetDir = path.join(outputDir, problemSlug);
  await fs.mkdir(targetDir, { recursive: true });
  for (let index = 0; index < cases.length; index += 1) {
    const order = index + 1;
    await fs.writeFile(path.join(targetDir, `${order}.in`), `${cases[index].input}`, 'utf8');
    await fs.writeFile(path.join(targetDir, `${order}.out`), `${cases[index].output}\n`, 'utf8');
  }
  await fs.writeFile(path.join(targetDir, 'config.yml'), buildConfigYaml(cases), 'utf8');
  return targetDir;
}

export async function findProblemForSpec(prisma, spec) {
  const where = [];
  if (spec.problemId) where.push({ id: String(spec.problemId) });
  if (spec.slug) where.push({ slug: String(spec.slug) });
  if (spec.source) where.push({ source: String(spec.source) });
  if (!where.length) {
    throw new Error('Generator spec must define problemId, slug, or source');
  }
  return prisma.problem.findFirst({
    where: { OR: where },
    include: {
      currentVersion: {
        include: {
          testcases: { select: { id: true }, take: 1 },
        },
      },
    },
  });
}

export async function verifyGeneratorContext(ctx, dbProblem, options = {}) {
  const checks = [];
  const sampleCases = await resolveSampleCases(ctx, dbProblem);
  for (let index = 0; index < sampleCases.length; index += 1) {
    const input = sampleCases[index].input;
    const expected = normalizeOutputText(sampleCases[index].output);
    const actual = await runSolution(ctx, input, { phase: 'verify-sample', index });
    if (actual !== expected) {
      throw new Error(
        `Sample mismatch for ${ctx.spec.source ?? ctx.spec.slug ?? ctx.dir} at sample ${index + 1}`
      );
    }
    checks.push({ kind: 'sample', index: index + 1 });
  }

  const generatedChecks = Array.isArray(ctx.spec.verify?.generated) ? ctx.spec.verify.generated : [];
  if (generatedChecks.length && !ctx.bruteRunner) {
    throw new Error(`Generator ${ctx.specPath} defines verify.generated but no brute runner`);
  }

  for (const item of generatedChecks) {
    const group = ctx.spec.groups.find((candidate) => candidate.name === item.group);
    if (!group) {
      throw new Error(`verify.generated references unknown group ${item.group}`);
    }
    const count = parsePositiveInt(item.count, 1);
    for (let caseIndex = 0; caseIndex < count; caseIndex += 1) {
      const globalIndex = caseIndex + 1;
      const input = await generateInput(ctx, group, caseIndex, globalIndex, {
        phase: 'verify-generated',
      });
      const stdOutput = await runSolution(ctx, input, {
        group,
        caseIndex,
        globalIndex,
        phase: 'verify-generated',
      });
      const bruteOutput = await runBrute(ctx, input, {
        group,
        caseIndex,
        globalIndex,
        phase: 'verify-generated',
      });
      if (stdOutput !== bruteOutput) {
        throw new Error(
          `Differential check failed for ${ctx.spec.source ?? ctx.spec.slug ?? ctx.dir}, group ${group.name}, case ${caseIndex + 1}`
        );
      }
      checks.push({ kind: 'generated', group: group.name, index: caseIndex + 1 });
    }
  }

  return { ok: true, checks };
}

export async function findGeneratorDirs({
  rootDir = DEFAULT_GENERATOR_ROOT,
  dirs = [],
  all = false,
  includeDraft = false,
}) {
  if (dirs.length) {
    return dirs.map((dir) => path.resolve(dir));
  }
  if (!all) {
    return [];
  }

  const results = [];
  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const hasSpec = entries.some((entry) => entry.isFile() && entry.name === 'spec.json');
    if (hasSpec) {
      if (includeDraft) {
        results.push(currentDir);
        return;
      }
      try {
        const spec = await readJson(path.join(currentDir, 'spec.json'));
        if (!spec?.draft) {
          results.push(currentDir);
        }
      } catch {
        results.push(currentDir);
      }
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      await walk(path.join(currentDir, entry.name));
    }
  }

  await walk(path.resolve(rootDir));
  return results.sort();
}

export async function prepareEmptyDir(targetDir) {
  const resolved = path.resolve(targetDir);
  await fs.rm(resolved, { recursive: true, force: true });
  await fs.mkdir(resolved, { recursive: true });
  return resolved;
}

export async function zipDirectory(sourceDir, zipPath) {
  const absoluteZip = path.resolve(zipPath);
  await fs.mkdir(path.dirname(absoluteZip), { recursive: true });
  await fs.rm(absoluteZip, { force: true });
  await execFileAsync('zip', ['-qr', absoluteZip, '.'], { cwd: sourceDir });
  return absoluteZip;
}

export async function writeSummary(summaryPath, payload) {
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(summaryPath, JSON.stringify(payload, null, 2), 'utf8');
}
