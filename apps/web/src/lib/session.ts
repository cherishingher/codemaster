import { randomBytes } from "crypto";
import { db } from "@/lib/db";

const SESSION_TTL_DAYS = 7;
const CLEANUP_PROBABILITY = 0.01;

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiresAt() {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_TTL_DAYS);
  return expires;
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const expiresAt = sessionExpiresAt();
  await db.session.create({
    data: { userId, token, expiresAt },
  });

  if (Math.random() < CLEANUP_PROBABILITY) {
    db.session
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .catch(() => {});
  }

  return { token, expiresAt };
}

export async function getSessionByToken(token: string) {
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (session && session.expiresAt < new Date()) {
    db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session;
}

export async function deleteSession(token: string) {
  await db.session.deleteMany({ where: { token } });
}
