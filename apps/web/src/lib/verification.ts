import { createHash } from "crypto"
import { normalizeIdentifier } from "@/lib/identifier"

export { normalizeIdentifier }

export function hashVerificationCode(code: string, target: string) {
  const secret = process.env.AUTH_CODE_SECRET ?? "dev"
  return createHash("sha256").update(code + "::" + target + "::" + secret).digest("hex")
}
