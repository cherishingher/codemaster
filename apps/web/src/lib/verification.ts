import { createHash } from "crypto"
import { z } from "zod"

export type VerificationTarget = {
  type: "email" | "phone"
  target: string
}

const EmailSchema = z.string().email()

export function normalizeIdentifier(identifier: string): VerificationTarget | null {
  const raw = identifier.trim()
  if (!raw) return null

  const emailCheck = EmailSchema.safeParse(raw)
  if (emailCheck.success) {
    return { type: "email", target: raw.toLowerCase() }
  }

  const phone = raw.replace(/[\s-]/g, "")
  if (/^\+?\d{6,15}$/.test(phone)) {
    return { type: "phone", target: phone }
  }

  return null
}

export function hashVerificationCode(code: string, target: string) {
  const secret = process.env.AUTH_CODE_SECRET ?? "dev"
  return createHash("sha256").update(code + "::" + target + "::" + secret).digest("hex")
}
