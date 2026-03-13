import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/lib/db";
import { readZipEntries } from "@/lib/zip";
import {
  MAX_TESTCASE_ZIP_BYTES,
  TestcaseZipError,
  normalizeZipEntries,
  replaceProblemTestcasesFromEntries,
} from "@/lib/testcase-zip";

async function resolveProblem(idOrSlug: string) {
  return db.problem.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    select: { id: true, slug: true },
  })
}

export const POST = withAuth(async (req, { params }) => {
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

  const problem = await resolveProblem(params.id);
  if (!problem) {
    return NextResponse.json({ error: "problem_not_found" }, { status: 404 });
  }

  const filename = file.name || "";
  if (!filename.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "zip_extension_required" }, { status: 400 });
  }
  const baseName = filename.slice(0, -4);
  if (baseName !== problem.id && baseName !== problem.slug) {
    return NextResponse.json(
      { error: "zip_name_mismatch", detail: `expected ${problem.id}.zip or ${problem.slug}.zip` },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const entries = normalizeZipEntries(await readZipEntries(buffer));
    const result = await replaceProblemTestcasesFromEntries(problem.id, entries, { skipSync });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TestcaseZipError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    return NextResponse.json(
      { error: "testcase_zip_upload_failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}, { roles: "admin" });
