import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/authz";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 30)));
  const q = searchParams.get("q")?.trim();

  const where: any = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { name: { contains: q, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, email: true, phone: true, name: true, status: true, createdAt: true,
        roles: { include: { role: true } },
        _count: { select: { submissions: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({
    items: users.map((u) => ({
      id: u.id, email: u.email, phone: u.phone, name: u.name, status: u.status,
      roles: u.roles.map((r) => r.role.name),
      submissionCount: u._count.submissions,
      createdAt: u.createdAt,
    })),
    page, pageSize, total, totalPages: Math.ceil(total / pageSize),
  });
}, { roles: "admin" });

const UpdateRoleSchema = z.object({
  userId: z.string(),
  action: z.enum(["grant", "revoke"]),
  role: z.string().min(1),
});

export const PATCH = withAuth(async (req) => {
  const data = UpdateRoleSchema.parse(await req.json());
  const role = await db.role.upsert({ where: { name: data.role }, create: { name: data.role }, update: {} });

  if (data.action === "grant") {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: data.userId, roleId: role.id } },
      create: { userId: data.userId, roleId: role.id },
      update: {},
    });
  } else {
    await db.userRole.deleteMany({ where: { userId: data.userId, roleId: role.id } });
  }

  return NextResponse.json({ ok: true });
}, { roles: "admin" });
