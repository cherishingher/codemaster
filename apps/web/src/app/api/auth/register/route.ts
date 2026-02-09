import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { hashVerificationCode, normalizeIdentifier } from "@/lib/verification";

const RegisterSchema = z
  .object({
    identifier: z.string().min(3),
    code: z.string().min(4),
    password: z.string().min(8),
    name: z.string().min(1).optional(),
  });

export async function POST(req: NextRequest) {
  const payload = RegisterSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json({ error: "invalid_payload", message: "参数不完整" }, { status: 400 });
  }

  const data = payload.data;
  const normalized = normalizeIdentifier(data.identifier);
  if (!normalized) {
    return NextResponse.json({ error: "invalid_identifier", message: "邮箱或手机号格式错误" }, { status: 400 });
  }

  const { type, target } = normalized;
  const exists = await db.user.findFirst({
    where: type === "email" ? { email: target } : { phone: target },
    select: { id: true },
  });
  if (exists) {
    return NextResponse.json({ error: "user_exists", message: "账号已存在" }, { status: 409 });
  }

  const codeRecord = await db.verificationCode.findFirst({
    where: {
      target,
      type,
      purpose: "register",
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

  const codeHash = hashVerificationCode(data.code, target);
  if (codeHash !== codeRecord.codeHash) {
    await db.verificationCode.update({
      where: { id: codeRecord.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "code_invalid", message: "验证码错误" }, { status: 400 });
  }

  try {
    const password = await hashPassword(data.password);
    const [user] = await db.$transaction([
      db.user.create({
        data: {
          email: type === "email" ? target : undefined,
          phone: type === "phone" ? target : undefined,
          emailVerifiedAt: type === "email" ? new Date() : undefined,
          phoneVerifiedAt: type === "phone" ? new Date() : undefined,
          name: data.name,
          password,
        },
        select: { id: true, email: true, phone: true, name: true },
      }),
      db.verificationCode.update({
        where: { id: codeRecord.id },
        data: { usedAt: new Date() },
      }),
    ]);

    const studentRole = await db.role.upsert({
      where: { name: "student" },
      create: { name: "student" },
      update: {},
    });
    await db.userRole.create({
      data: { userId: user.id, roleId: studentRole.id },
    });

    const bootstrapAdmin = process.env.BOOTSTRAP_ADMIN_EMAIL;
    if (bootstrapAdmin && bootstrapAdmin === user.email) {
      const adminRole = await db.role.upsert({
        where: { name: "admin" },
        create: { name: "admin" },
        update: {},
      });
      await db.userRole.create({
        data: { userId: user.id, roleId: adminRole.id },
      });
    }

    const session = await createSession(user.id);
    const res = NextResponse.json({ user });
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
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "user_exists", message: "账号已存在" }, { status: 409 });
    }
    return NextResponse.json({ error: "server_error", message: "服务器错误" }, { status: 500 });
  }
}
