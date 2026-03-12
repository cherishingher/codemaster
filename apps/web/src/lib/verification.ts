import { createHash } from "crypto"
import { normalizeIdentifier } from "@/lib/identifier"

export { normalizeIdentifier }

function getVerificationSecret() {
  const secret = process.env.AUTH_CODE_SECRET?.trim()
  const unsafeDefaults = new Set(["change-me", "dev", "dev-auth-code-secret"])

  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      throw new Error("AUTH_CODE_SECRET is required in production")
    }
    if (unsafeDefaults.has(secret)) {
      throw new Error("AUTH_CODE_SECRET uses an unsafe default in production")
    }
    return secret
  }

  return secret || "dev"
}

export function hashVerificationCode(code: string, target: string) {
  const secret = getVerificationSecret()
  return createHash("sha256").update(code + "::" + target + "::" + secret).digest("hex")
}
