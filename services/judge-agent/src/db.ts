import { PrismaClient } from "@prisma/client"

declare global {
  // eslint-disable-next-line no-var
  var __judgeAgentPrisma: PrismaClient | undefined
}

export const db =
  globalThis.__judgeAgentPrisma ??
  new PrismaClient({
    log: ["error", "warn"],
  })

if (process.env.NODE_ENV !== "production") {
  globalThis.__judgeAgentPrisma = db
}
