import { z } from "zod";

export type NormalizedIdentifier = {
  type: "email" | "phone";
  target: string;
};

const EmailSchema = z.string().email();

export function normalizeIdentifier(identifier: string): NormalizedIdentifier | null {
  const raw = identifier.trim();
  if (!raw) return null;

  const email = raw.toLowerCase();
  const emailCheck = EmailSchema.safeParse(email);
  if (emailCheck.success) {
    return { type: "email", target: email };
  }

  const phone = raw.replace(/[\s\-()]/g, "");
  if (/^\+?\d{6,15}$/.test(phone)) {
    return { type: "phone", target: phone };
  }

  return null;
}
