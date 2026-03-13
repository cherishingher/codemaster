import { NextResponse } from "next/server";
import { withAuth } from "@/lib/authz";
import { db } from "@/lib/db";
import { syncHustojProblem } from "@/lib/hustoj";

export const runtime = "nodejs";

const syncHandler = withAuth(async (req, { params }) => {
  const path = new URL(req.url).pathname;
  const segments = path.split("/").filter(Boolean);
  const fallbackId = segments.length >= 3 ? segments[segments.length - 2] : "";
  const problemKey = params?.id || fallbackId;
  if (!problemKey) {
    return NextResponse.json({ error: "problem_id_required" }, { status: 400 });
  }

  const problem = await db.problem.findFirst({
    where: {
      OR: [{ id: problemKey }, { slug: problemKey }],
    },
    select: { id: true },
  });
  if (!problem) {
    return NextResponse.json({ error: "problem_not_found" }, { status: 404 });
  }

  try {
    const hustojProblemId = await syncHustojProblem(problem.id);
    return NextResponse.json({ ok: true, hustojProblemId });
  } catch (err) {
    return NextResponse.json(
      { error: "sync_failed", detail: String(err) },
      { status: 500 }
    );
  }
}, { roles: "admin" });

export const POST = syncHandler;
export const GET = syncHandler;
