import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { normalizeIdentifier } from "@/lib/identifier";

const LoginSchema = z.object({
  identifier: z.string().min(3).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const payload = LoginSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { identifier, email, phone, password } = payload.data;
  const rawIdentifier = identifier ?? email ?? phone;
  if (!rawIdentifier) {
    return NextResponse.json({ error: "email_or_phone_required", message: "请输入邮箱或手机号" }, { status: 400 });
  }

  const normalized = normalizeIdentifier(rawIdentifier);
  if (!normalized) {
    return NextResponse.json({ error: "invalid_identifier", message: "邮箱或手机号格式错误" }, { status: 400 });
  }

  const user = await db.user.findFirst({
    where: normalized.type === "email" ? { email: normalized.target } : { phone: normalized.target },
  });

  if (!user) {
    return NextResponse.json({ error: "invalid_credentials", message: "账号或密码错误" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials", message: "账号或密码错误" }, { status: 401 });
  }

  const session = await createSession(user.id);
  const res = NextResponse.json({
    user: { id: user.id, email: user.email, phone: user.phone, name: user.name },
  });
  res.cookies.set({
    name: "cm_session",
    value: session.token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: session.expiresAt,
    path: "/",
  });

  return res;
}
