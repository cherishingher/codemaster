import { PrismaClient } from "@prisma/client";
import { validateEnv } from "./env-check";

validateEnv();

declare global {
  var __webPrisma: PrismaClient | undefined;
}

export const db =
  globalThis.__webPrisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__webPrisma = db;
}
