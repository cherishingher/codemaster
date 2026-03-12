import { NextResponse } from "next/server";
import { isAdminDevRouteEnabled } from "@/lib/admin-dev";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async () => {
  if (!isAdminDevRouteEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [
    problems,
    versions,
    testcases,
    solutions,
    sets,
    submissions,
    stats,
  ] = await Promise.all([
    db.problem.count(),
    db.problemVersion.count(),
    db.testcase.count(),
    db.solution.count(),
    db.problemSet.count(),
    db.submission.count(),
    db.problemStat.count(),
  ]);

  return NextResponse.json({
    ok: true,
    counts: {
      problems,
      versions,
      testcases,
      solutions,
      sets,
      submissions,
      stats,
    },
    timestamp: new Date().toISOString(),
  });
}, { roles: "admin" });
