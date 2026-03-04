#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_GENERATOR_ROOT, REPO_ROOT, writeSummary } from './problem-generator-lib.mjs';

const db = new PrismaClient();
const DEFAULT_SUMMARY_OUTPUT = path.join(REPO_ROOT, 'tmp', 'problem-generator-scaffold.summary.json');

function parseArgs(argv) {
  const options = {
    pids: [],
    from: '',
    to: '',
    limit: 0,
    root: DEFAULT_GENERATOR_ROOT,
    force: false,
    dryRun: false,
    summaryOutput: DEFAULT_SUMMARY_OUTPUT,
    draft: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    switch (arg) {
      case '--help':
      case '-h':
        console.log(`Usage: node scripts/scaffold-problem-generators.mjs [--pids P1002,P1003] [--from P1002 --to P1010] [--force] [--dry-run]`);
        process.exit(0);
        break;
      case '--pids':
        options.pids = String(next ?? '')
          .split(',')
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean);
        index += 1;
        break;
      case '--from':
        options.from = String(next ?? '').trim().toUpperCase();
        index += 1;
        break;
      case '--to':
        options.to = String(next ?? '').trim().toUpperCase();
        index += 1;
        break;
      case '--limit':
        options.limit = Number(next ?? 0) || 0;
        index += 1;
        break;
      case '--root':
        options.root = next ?? DEFAULT_GENERATOR_ROOT;
        index += 1;
        break;
      case '--summary-output':
        options.summaryOutput = next ?? DEFAULT_SUMMARY_OUTPUT;
        index += 1;
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--activate':
        options.draft = false;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.pids.length && !options.from && !options.to) {
    throw new Error('Provide --pids or --from/--to.');
  }

  return options;
}

function parsePidNumber(pid) {
  const match = String(pid).trim().toUpperCase().match(/^P(\d+)$/);
  return match ? Number(match[1]) : null;
}

function normalizeSamples(samples) {
  if (!Array.isArray(samples)) return [];
  return samples
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

function buildGroupPlan(difficulty) {
  if (difficulty >= 3) {
    return { smallRandom: 14, edge: 12, stress: 6, verifySmall: 30, verifyEdge: 15 };
  }
  if (difficulty === 2) {
    return { smallRandom: 12, edge: 10, stress: 5, verifySmall: 24, verifyEdge: 12 };
  }
  return { smallRandom: 10, edge: 8, stress: 4, verifySmall: 20, verifyEdge: 10 };
}

function buildSpec(problem) {
  const pid = String(problem.source).replace(/^luogu:/, '');
  const plan = buildGroupPlan(problem.difficulty ?? 1);
  const tags = Array.isArray(problem.tags)
    ? problem.tags.map((item) => item.tag?.name).filter(Boolean)
    : [];
  return {
    draft: true,
    source: problem.source,
    slug: problem.slug,
    title: problem.title,
    metadata: {
      provider: 'luogu',
      pid,
      difficulty: problem.difficulty,
      tags,
    },
    todo: [
      'Implement std.mjs with a trusted solution.',
      'Implement brute.mjs for small-data differential checks.',
      'Implement gen.mjs with group-specific generators.',
      'Review samples and constraints, then set draft=false when ready.',
    ],
    samples: normalizeSamples(problem.currentVersion?.samples),
    verify: {
      generated: [
        { group: 'small-random', count: plan.verifySmall },
        { group: 'edge', count: plan.verifyEdge },
      ],
    },
    groups: [
      {
        name: 'sample',
        useSamples: true,
        score: 0,
        caseType: 0,
        visible: true,
        isSample: true,
        groupId: 'sample',
      },
      {
        name: 'small-random',
        count: plan.smallRandom,
        score: 40,
        caseType: 1,
        visible: false,
        groupId: 'hidden-small',
      },
      {
        name: 'edge',
        count: plan.edge,
        score: 40,
        caseType: 1,
        visible: false,
        groupId: 'hidden-edge',
      },
      {
        name: 'stress',
        count: plan.stress,
        score: 20,
        caseType: 2,
        visible: false,
        groupId: 'stress',
      },
    ],
  };
}

function buildStdTemplate(problem) {
  return `export function solve(input) {
  throw new Error(${JSON.stringify(`TODO: implement standard solution for ${problem.source} (${problem.title})`)});
}
`;
}

function buildBruteTemplate(problem) {
  return `export function solve(input) {
  throw new Error(${JSON.stringify(`TODO: implement brute-force solution for ${problem.source} (${problem.title})`)});
}
`;
}

function buildGenTemplate(problem) {
  const message = JSON.stringify(`TODO: implement generator for ${problem.source} (${problem.title}) / group=`);
  return `export function generate(context) {
  const { group, helpers } = context;

  // TODO: replace this placeholder with a real generator.
  // helpers: randInt(min, max), randBool(prob), randPick(values), randShuffle(values)
  throw new Error(${message} + group.name);
}
`;
}

function buildReadme(problem, spec) {
  const sampleCount = Array.isArray(spec.samples) ? spec.samples.length : 0;
  const tags = spec.metadata.tags.length ? spec.metadata.tags.join(' / ') : '无';
  return `# ${problem.source} 生成器模板

- 标题：${problem.title}
- slug：${problem.slug}
- 难度：${problem.difficulty}
- 标签：${tags}
- 样例数：${sampleCount}
- 当前状态：${spec.draft ? 'draft' : 'active'}

## 下一步

1. 实现 \`std.mjs\`
2. 实现 \`brute.mjs\`
3. 实现 \`gen.mjs\`
4. 评审分组与分值
5. 把 \`spec.json\` 中的 \`draft\` 改成 \`false\`

## 验证命令

\`\`\`bash
cd /Users/cherisher/Desktop/ccf-master/codemaster
npm run generator:verify -- --dirs ./problem-generators/luogu/${problem.source.replace(/^luogu:/, '')}
\`\`\`
`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeScaffold(problem, rootDir, force, draft) {
  const pid = String(problem.source).replace(/^luogu:/, '');
  const targetDir = path.join(path.resolve(rootDir), 'luogu', pid);
  const spec = buildSpec(problem);
  spec.draft = draft;

  const exists = await fileExists(targetDir);
  if (exists && !force) {
    return { status: 'skipped', dir: targetDir, reason: 'exists' };
  }

  await ensureDir(targetDir);
  await fs.writeFile(path.join(targetDir, 'spec.json'), `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(targetDir, 'std.mjs'), buildStdTemplate(problem), 'utf8');
  await fs.writeFile(path.join(targetDir, 'brute.mjs'), buildBruteTemplate(problem), 'utf8');
  await fs.writeFile(path.join(targetDir, 'gen.mjs'), buildGenTemplate(problem), 'utf8');
  await fs.writeFile(path.join(targetDir, 'README.md'), buildReadme(problem, spec), 'utf8');
  return { status: exists ? 'overwritten' : 'created', dir: targetDir };
}

async function loadLuoguProblems(options) {
  const problems = await db.problem.findMany({
    where: { source: { startsWith: 'luogu:P' } },
    orderBy: { source: 'asc' },
    include: {
      currentVersion: { select: { samples: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  let filtered = problems.filter((problem) => typeof problem.source === 'string');
  if (options.pids.length) {
    const pidSet = new Set(options.pids.map((pid) => `luogu:${pid}`));
    filtered = filtered.filter((problem) => pidSet.has(problem.source));
  } else {
    const from = options.from ? parsePidNumber(options.from) : null;
    const to = options.to ? parsePidNumber(options.to) : null;
    filtered = filtered.filter((problem) => {
      const pid = String(problem.source).replace(/^luogu:/, '');
      const number = parsePidNumber(pid);
      if (number === null) return false;
      if (from !== null && number < from) return false;
      if (to !== null && number > to) return false;
      return true;
    });
  }

  if (options.limit > 0) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const problems = await loadLuoguProblems(options);
  if (!problems.length) {
    throw new Error('No matching Luogu problems found in local database.');
  }

  const results = [];
  for (const problem of problems) {
    const pid = String(problem.source).replace(/^luogu:/, '');
    const targetDir = path.join(path.resolve(options.root), 'luogu', pid);
    if (options.dryRun) {
      const exists = await fileExists(targetDir);
      results.push({ source: problem.source, slug: problem.slug, dir: targetDir, status: exists ? 'would-skip' : 'would-create' });
      continue;
    }
    const result = await writeScaffold(problem, options.root, options.force, options.draft);
    results.push({ source: problem.source, slug: problem.slug, ...result });
    console.log(`${result.status.toUpperCase()} ${problem.source} -> ${result.dir}`);
  }

  await writeSummary(options.summaryOutput, {
    createdAt: new Date().toISOString(),
    draft: options.draft,
    force: options.force,
    dryRun: options.dryRun,
    count: results.length,
    results,
  });
  console.log(`Summary JSON: ${path.resolve(options.summaryOutput)}`);
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
