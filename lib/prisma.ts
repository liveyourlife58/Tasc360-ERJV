import { PrismaClient } from "@prisma/client";

/**
 * One PrismaClient per Node process (dev HMR + Vercel serverless warm instances).
 * Without reusing `globalThis`, some bundler/runtime paths can create multiple clients
 * and exhaust Postgres `max_connections` (especially on small tiers + many tabs / lambdas).
 *
 * We also default `connection_limit=1` on the client URL when missing, so each Node
 * process only opens one DB connection through Prisma's pool (critical for small Postgres
 * tiers and many Vercel lambdas). Use a pooled host (Neon *-pooler*, Supabase pooler)
 * in `DATABASE_URL` in production. Prisma Accelerate / `prisma+` URLs are left unchanged.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function databaseUrlForPrismaClient(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.startsWith("prisma+") || lower.includes("accelerate.prisma-data.net")) {
    return raw;
  }
  if (/[?&]connection_limit=\d+/i.test(raw)) {
    return raw;
  }
  const sep = raw.includes("?") ? "&" : "?";
  return `${raw}${sep}connection_limit=1`;
}

function createPrismaClient(): PrismaClient {
  const url = databaseUrlForPrismaClient();
  return new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
