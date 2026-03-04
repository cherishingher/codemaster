#!/usr/bin/env node

import process from 'process';
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_GENERATOR_ROOT,
  findGeneratorDirs,
  findProblemForSpec,
  loadGeneratorContext,
  verifyGeneratorContext,
} from './problem-generator-lib.mjs';

const db = new PrismaClient();

function parseArgs(argv) {
  const options = {
    dirs: [],
    all: false,
    root: DEFAULT_GENERATOR_ROOT,
    continueOnError: false,
    includeDraft: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--help':
      case '-h':
        console.log(`Usage: node scripts/verify-problem-generator.mjs [--all] [--dirs dir1,dir2] [--continue-on-error]`);
        process.exit(0);
        break;
      case '--all':
        options.all = true;
        break;
      case '--dirs':
        options.dirs = String(next ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        i += 1;
        break;
      case '--root':
        options.root = next ?? DEFAULT_GENERATOR_ROOT;
        i += 1;
        break;
      case '--continue-on-error':
        options.continueOnError = true;
        break;
      case '--include-draft':
        options.includeDraft = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.all && options.dirs.length === 0) {
    options.all = true;
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dirs = await findGeneratorDirs({
    rootDir: options.root,
    dirs: options.dirs,
    all: options.all,
    includeDraft: options.includeDraft,
  });
  if (!dirs.length) {
    throw new Error('No generator directories found.');
  }

  const summary = [];
  for (const dir of dirs) {
    try {
      const ctx = await loadGeneratorContext(dir);
      const problem = await findProblemForSpec(db, ctx.spec);
      if (!problem) {
        throw new Error(`Problem not found for ${ctx.spec.source ?? ctx.spec.slug ?? ctx.spec.problemId}`);
      }
      const result = await verifyGeneratorContext(ctx, problem);
      summary.push({ dir, ok: true, checks: result.checks.length });
      console.log(`OK  ${dir} (${result.checks.length} checks)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.push({ dir, ok: false, error: message });
      console.error(`FAIL ${dir}: ${message}`);
      if (!options.continueOnError) {
        throw error;
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
