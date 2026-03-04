import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/lib/db";
import { readZipEntries } from "@/lib/zip";
import {
  MAX_TESTCASE_ZIP_BYTES,
  TestcaseZipError,
  normalizeZipEntries,
  replaceProblemTestcasesFromEntries,
  stripSharedRootFolder,
  type TestcaseZipWarning,
} from "@/lib/testcase-zip";

function shouldIgnoreBatchEntry(entryPath: string) {
  const segments = entryPath.split("/");
  const base = segments[segments.length - 1];
  return (
    segments.includes("__MACOSX") ||
    base === ".DS_Store" ||
    base.startsWith("._")
  );
}

function buildGroupedEntries(entries: Map<string, Buffer>) {
  const warnings: TestcaseZipWarning[] = [];
  const grouped = new Map<string, Map<string, Buffer>>();
  const rootFiles: string[] = [];

  for (const [entryPath, data] of entries.entries()) {
    if (shouldIgnoreBatchEntry(entryPath)) continue;
    const slashIndex = entryPath.indexOf("/");
    if (slashIndex < 0) {
      rootFiles.push(entryPath);
      continue;
    }
    const identifier = entryPath.slice(0, slashIndex).trim();
    const innerPath = entryPath.slice(slashIndex + 1).trim();
    if (!identifier || !innerPath) continue;
    const bucket = grouped.get(identifier) ?? new Map<string, Buffer>();
    bucket.set(innerPath, data);
    grouped.set(identifier, bucket);
  }

  if (rootFiles.length) {
    warnings.push({
      code: "root_files_ignored",
      detail: rootFiles.slice(0, 50),
    });
  }

  return { grouped, warnings };
}

export const POST = withAuth(async (req) => {
  const form = await req.formData();
  const file = form.get("zip");
  const skipSync = String(form.get("skipSync") ?? "").toLowerCase() === "true";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "zip_file_required" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "zip_empty" }, { status: 400 });
  }

  if (file.size > MAX_TESTCASE_ZIP_BYTES) {
    return NextResponse.json(
      {
        error: "zip_too_large",
        detail: { size: file.size, limit: MAX_TESTCASE_ZIP_BYTES },
      },
      { status: 400 }
    );
  }

  if (!(file.name || "").toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "zip_extension_required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const entries = stripSharedRootFolder(normalizeZipEntries(await readZipEntries(buffer)));
  const { grouped, warnings } = buildGroupedEntries(entries);

  if (!grouped.size) {
    return NextResponse.json(
      {
        error: "no_problem_directories_found",
        detail: "expected zip layout: <problem-slug-or-id>/1.in and <problem-slug-or-id>/1.out",
      },
      { status: 400 }
    );
  }

  const results: Array<Record<string, unknown>> = [];
  let succeeded = 0;
  let failed = 0;
  let importedTestcases = 0;

  for (const [identifier, testcaseEntries] of grouped.entries()) {
    const problem = await db.problem.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
      select: { id: true, slug: true, title: true },
    });

    if (!problem) {
      failed += 1;
      results.push({
        identifier,
        ok: false,
        error: "problem_not_found",
      });
      continue;
    }

    try {
      const result = await replaceProblemTestcasesFromEntries(problem.id, testcaseEntries, { skipSync });
      succeeded += 1;
      importedTestcases += result.count;
      results.push({
        identifier,
        problemId: problem.id,
        slug: problem.slug,
        title: problem.title,
        ...result,
      });
    } catch (error) {
      failed += 1;
      if (error instanceof TestcaseZipError) {
        results.push({
          identifier,
          problemId: problem.id,
          slug: problem.slug,
          title: problem.title,
          ok: false,
          status: error.status,
          ...error.body,
        });
      } else {
        results.push({
          identifier,
          problemId: problem.id,
          slug: problem.slug,
          title: problem.title,
          ok: false,
          error: "testcase_batch_import_failed",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    totalProblems: grouped.size,
    succeeded,
    failed,
    importedTestcases,
    warnings: warnings.length ? warnings : undefined,
    results,
  });
}, { roles: "admin" });
