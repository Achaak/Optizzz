import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "~/env";
import { PrismaClient } from "~/generated/prisma/client";

const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof createPrismaClient> | undefined };

export const db = globalForPrisma.prisma ?? createPrismaClient();

// Hot reload in development would open a new pool each time.
if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
