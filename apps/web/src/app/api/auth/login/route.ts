import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";

const LoginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const payload = LoginSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { email, phone, password } = payload.data;
  if (!email && !phone) {
    return NextResponse.json({ error: "email_or_phone_required" }, { status: 400 });
  }

  const identifiers: Array<{ email: string } | { phone: string }> = [];
  if (email) identifiers.push({ email });
  if (phone) identifiers.push({ phone });

  const user = await db.user.findFirst({
    where: {
      OR: identifiers,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.password);
  if (!ok) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
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
