// ==========================================================
// Cliente Prisma (singleton) — evita múltiples conexiones en dev
// ==========================================================
import { PrismaClient } from "@prisma/client";
import { isProd } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ["error"] : ["query", "warn", "error"],
  });

if (!isProd) globalForPrisma.prisma = prisma;
