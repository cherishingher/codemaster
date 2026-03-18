import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { hashVerificationCode, normalizeIdentifier } from "@/lib/verification";
import { PasswordSchema } from "@/lib/password-policy";

const ResetPasswordSchema = z.object({
  identifier: z.string().min(3),
  code: z.string().min(4),
  password: PasswordSchema,
});

export async function POST(req: NextRequest) {
  const payload = ResetPasswordSchema.safeParse(await req.json());
  if (!payload.success) {
    const firstIssue = payload.error.issues[0];
    return NextResponse.json(
      { error: "invalid_payload", message: firstIssue?.message ?? "参数不完整" },
      { status: 400 }
    );
  }

  const normalized = normalizeIdentifier(payload.data.identifier);
  if (!normalized) {
    return NextResponse.json({ error: "invalid_identifier", message: "邮箱或手机号格式错误" }, { status: 400 });
  }

  const { type, target } = normalized;
  const user = await db.user.findFirst({
    where: type === "email" ? { email: target } : { phone: target },
    select: { id: true, email: true, phone: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "user_not_found", message: "账号不存在" }, { status: 404 });
  }

  const codeRecord = await db.verificationCode.findFirst({
    where: {
      target,
      type,
      purpose: "reset_password",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!codeRecord) {
    return NextResponse.json({ error: "code_invalid", message: "验证码无效或已过期" }, { status: 400 });
  }
  if (codeRecord.attempts >= 5) {
    return NextResponse.json({ error: "code_locked", message: "验证码错误次数过多" }, { status: 429 });
  }

  const codeHash = hashVerificationCode(payload.data.code, target);
  if (codeHash !== codeRecord.codeHash) {
    await db.verificationCode.update({
      where: { id: codeRecord.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "code_invalid", message: "验证码错误" }, { status: 400 });
  }

  const password = await hashPassword(payload.data.password);
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        password,
        emailVerifiedAt: type === "email" ? new Date() : undefined,
        phoneVerifiedAt: type === "phone" ? new Date() : undefined,
      },
    }),
    db.verificationCode.update({
      where: { id: codeRecord.id },
      data: { usedAt: new Date() },
    }),
    db.session.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  const session = await createSession(user.id);
  const res = NextResponse.json({
    user,
    message: "密码已重置",
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
