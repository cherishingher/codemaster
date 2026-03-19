import { createHash } from "crypto"
import { normalizeIdentifier } from "@/lib/identifier"

export { normalizeIdentifier }

export function hashVerificationCode(code: string, target: string) {
  const secret = process.env.AUTH_CODE_SECRET
  if (!secret) {
    throw new Error("AUTH_CODE_SECRET environment variable is required")
  }
  return createHash("sha256").update(code + "::" + target + "::" + secret).digest("hex")
}
