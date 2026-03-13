import { prisma } from "./prisma";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type IdempotencyResult =
  | { hit: true; statusCode: number; body: string }
  | { hit: false };

/**
 * Return cached response for this tenant + key if present and not expired.
 */
export async function getIdempotentResponse(
  tenantId: string,
  key: string
): Promise<IdempotencyResult> {
  const row = await prisma.idempotencyKey.findUnique({
    where: {
      tenantId_key: { tenantId, key },
    },
    select: { statusCode: true, responseBody: true, createdAt: true, id: true },
  });
  if (!row) return { hit: false };
  if (Date.now() - row.createdAt.getTime() > TTL_MS) {
    await prisma.idempotencyKey.delete({ where: { id: row.id } }).catch(() => {});
    return { hit: false };
  }
  return {
    hit: true,
    statusCode: row.statusCode,
    body: row.responseBody ?? "{}",
  };
}

/**
 * Store response for this tenant + key. Call after successfully processing.
 * Uses create; if unique violation (concurrent duplicate), we treat as success and return without overwriting.
 */
export async function setIdempotentResponse(
  tenantId: string,
  key: string,
  statusCode: number,
  responseBody: string
): Promise<void> {
  await prisma.idempotencyKey.create({
    data: {
      tenantId,
      key: key.slice(0, 255),
      statusCode,
      responseBody: responseBody.slice(0, 100_000),
    },
  }).catch(() => {
    // Unique violation = another request already stored; ignore
  });
}
