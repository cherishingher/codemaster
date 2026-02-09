import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __codemasterPrisma: PrismaClient | undefined;
}

export const db =
  globalThis.__codemasterPrisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__codemasterPrisma = db;
}
