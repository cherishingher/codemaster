import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";

  const sets = await db.problemSet.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: { orderBy: { orderIndex: "asc" } },
    },
  });

  if (format === "csv") {
    const header = ["id", "title", "visibility", "ownerId", "problemIds"].join(",");
    const rows = sets.map((s) => {
      const ids = s.items.map((i) => i.problemId).join("|");
      return [
        s.id,
        JSON.stringify(s.title),
        s.visibility,
        s.ownerId,
        JSON.stringify(ids),
      ].join(",");
    });
    const csv = [header, ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=problem-sets.csv",
      },
    });
  }

  return Response.json({
    sets: sets.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      visibility: s.visibility,
      ownerId: s.ownerId,
      items: s.items.map((i) => ({
        problemId: i.problemId,
        orderIndex: i.orderIndex,
      })),
    })),
  });
}, { roles: "admin" });
