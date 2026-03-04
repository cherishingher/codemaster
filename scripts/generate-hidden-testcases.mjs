#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_GENERATOR_ROOT,
  REPO_ROOT,
  buildGeneratedCases,
  findGeneratorDirs,
  findProblemForSpec,
  loadGeneratorContext,
  prepareEmptyDir,
  verifyGeneratorContext,
  writeProblemCaseDirectory,
  writeSummary,
  zipDirectory,
} from './problem-generator-lib.mjs';

const db = new PrismaClient();
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'tmp', 'generated-hidden-testcases');
const DEFAULT_ZIP_OUTPUT = path.join(REPO_ROOT, 'tmp', 'generated-hidden-testcases.zip');
const IMPORT_PATH = '/api/admin/testcases/import-zip';

function parseArgs(argv) {
  const options = {
    dirs: [],
    all: false,
    root: DEFAULT_GENERATOR_ROOT,
    outputDir: DEFAULT_OUTPUT_DIR,
    zipOutput: DEFAULT_ZIP_OUTPUT,
    skipVerify: false,
    continueOnError: false,
    baseUrl: '',
    importUrl: '',
    cookie: process.env.CM_SESSION_COOKIE ?? '',
    skipSync: true,
    includeDraft: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--help':
      case '-h':
        console.log(`Usage: node scripts/generate-hidden-testcases.mjs [--all] [--dirs dir1,dir2] [--base-url http://127.0.0.1:3001 --cookie 'cm_session=...']`);
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
      case '--output-dir':
        options.outputDir = next ?? DEFAULT_OUTPUT_DIR;
        i += 1;
        break;
      case '--zip-output':
        options.zipOutput = next ?? DEFAULT_ZIP_OUTPUT;
        i += 1;
        break;
      case '--skip-verify':
        options.skipVerify = true;
        break;
      case '--continue-on-error':
        options.continueOnError = true;
        break;
      case '--base-url':
        options.baseUrl = next ?? '';
        i += 1;
        break;
      case '--import-url':
        options.importUrl = next ?? '';
        i += 1;
        break;
      case '--cookie':
        options.cookie = next ?? '';
        i += 1;
        break;
      case '--skip-sync':
        options.skipSync = true;
        break;
      case '--sync-hustoj':
        options.skipSync = false;
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
  if (options.baseUrl && !options.importUrl) {
    options.importUrl = `${options.baseUrl.replace(/\/+$/, '')}${IMPORT_PATH}`;
  }
  if (options.importUrl && !options.cookie) {
    throw new Error('Direct import requires --cookie or CM_SESSION_COOKIE.');
  }
  return options;
}

async function importZip(importUrl, cookie, zipPath, skipSync) {
  const buffer = await fs.readFile(zipPath);
  const form = new FormData();
  form.append('zip', new Blob([buffer]), path.basename(zipPath));
  form.append('skipSync', String(skipSync));

  const res = await fetch(importUrl, {
    method: 'POST',
    headers: { cookie },
    body: form,
  });
  const text = await res.text();
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
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

  const outputDir = await prepareEmptyDir(options.outputDir);
  const summary = [];

  for (const dir of dirs) {
    try {
      const ctx = await loadGeneratorContext(dir);
      const problem = await findProblemForSpec(db, ctx.spec);
      if (!problem) {
        throw new Error(`Problem not found for ${ctx.spec.source ?? ctx.spec.slug ?? ctx.spec.problemId}`);
      }
      if (!options.skipVerify) {
        await verifyGeneratorContext(ctx, problem);
      }
      const cases = await buildGeneratedCases(ctx, problem);
      if (!cases.length) {
        throw new Error(`No cases generated for ${dir}`);
      }
      await writeProblemCaseDirectory(outputDir, problem.slug, cases);
      summary.push({
        dir,
        ok: true,
        slug: problem.slug,
        source: problem.source,
        generatedCases: cases.length,
      });
      console.log(`OK  ${problem.slug}: generated ${cases.length} cases`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.push({ dir, ok: false, error: message });
      console.error(`FAIL ${dir}: ${message}`);
      if (!options.continueOnError) {
        throw error;
      }
    }
  }

  const successful = summary.filter((item) => item.ok);
  if (!successful.length) {
    throw new Error('No testcase directories were generated successfully.');
  }

  const zipPath = await zipDirectory(outputDir, options.zipOutput);
  const summaryPath = path.join(path.dirname(zipPath), `${path.basename(zipPath, '.zip')}.summary.json`);
  await writeSummary(summaryPath, { outputDir, zipPath, summary });

  console.log(`Generated directory: ${outputDir}`);
  console.log(`Generated ZIP: ${zipPath}`);
  console.log(`Summary JSON: ${summaryPath}`);

  if (options.importUrl) {
    console.log(`Importing into ${options.importUrl} ...`);
    console.log(await importZip(options.importUrl, options.cookie, zipPath, options.skipSync));
  } else {
    console.log('Import skipped. Pass --base-url/--import-url and --cookie for direct import.');
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
