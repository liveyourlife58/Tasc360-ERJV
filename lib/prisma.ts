import { PrismaClient } from "@prisma/client";

/**
 * One PrismaClient per Node process (dev HMR + Vercel serverless warm instances).
 * Without reusing `globalThis`, some bundler/runtime paths can create multiple clients
 * and exhaust Postgres `max_connections` (especially on small tiers + many tabs / lambdas).
 *
 * For pooled DB URLs (Neon, Supabase pooler, Prisma Accelerate), add e.g.
 * `?pgbouncer=true&connection_limit=1` to `DATABASE_URL` per host docs.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
