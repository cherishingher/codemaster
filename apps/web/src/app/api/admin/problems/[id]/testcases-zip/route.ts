import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { readZipEntries } from "@/lib/zip";
import {
  MAX_TESTCASE_ZIP_BYTES,
  TestcaseZipError,
  normalizeZipEntries,
  replaceProblemTestcasesFromEntries,
} from "@/lib/testcase-zip";

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

  const problemId = params.id;
  const filename = file.name || "";
  if (!filename.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "zip_extension_required" }, { status: 400 });
  }
  const baseName = filename.slice(0, -4);
  if (baseName !== problemId) {
    return NextResponse.json(
      { error: "zip_name_mismatch", detail: `expected ${problemId}.zip` },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const entries = normalizeZipEntries(await readZipEntries(buffer));
    const result = await replaceProblemTestcasesFromEntries(problemId, entries, { skipSync });
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
