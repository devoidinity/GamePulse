import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

/**
 * Singleton Prisma client. In dev, hot-reload can create many clients and
 * exhaust connections, so we cache on globalThis.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
