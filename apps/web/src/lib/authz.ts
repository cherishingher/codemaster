import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  roles: string[];
};

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get("cm_session")?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          roles: {
            include: { role: true },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) return null;

  const roles = session.user.roles.map((r) => r.role.name);
  return {
    id: session.user.id,
    email: session.user.email,
    phone: session.user.phone,
    name: session.user.name,
    roles,
  };
}

export function hasRole(user: AuthUser, roles: string[] | string) {
  const list = Array.isArray(roles) ? roles : [roles];
  return list.some((r) => user.roles.includes(r));
}

type HandlerCtx = { params: Record<string, string> | Promise<Record<string, string>> };

type ResolvedHandlerCtx = { params: Record<string, string> };

type AuthedHandler = (
  req: NextRequest,
  ctx: ResolvedHandlerCtx,
  user: AuthUser
) => Promise<Response>;

type AuthOptions = { roles?: string[] | string };

export function withAuth(handler: AuthedHandler, options: AuthOptions = {}) {
  return async (req: NextRequest, ctx: HandlerCtx) => {
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (options.roles && !hasRole(user, options.roles)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const params = await Promise.resolve(ctx.params);
    return handler(req, { params }, user);
  };
}
