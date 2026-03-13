import crypto from "crypto";
import { prisma } from "./prisma";

const KEY_PREFIX_LEN = 12;
const KEY_RANDOM_BYTES = 24;

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * Create a new API key. Returns the raw key (show once to user); store only prefix + hash in DB.
 */
export async function createApiKey(
  tenantId: string,
  name: string,
  createdByUserId: string
): Promise<{ key: string; id: string } | { error: string }> {
  const trimmedName = (name ?? "").trim().slice(0, 100);
  if (!trimmedName) return { error: "Name is required." };

  let rawKey: string;
  let prefix: string;
  let keyHash: string;
  let attempts = 0;
  const maxAttempts = 5;

  do {
    rawKey = "tasc_" + crypto.randomBytes(KEY_RANDOM_BYTES).toString("hex");
    prefix = rawKey.slice(0, KEY_PREFIX_LEN);
    keyHash = hashKey(rawKey);
    const existing = await prisma.apiKey.findUnique({ where: { keyPrefix: prefix }, select: { id: true } });
    if (!existing) break;
    attempts++;
  } while (attempts < maxAttempts);

  if (attempts >= maxAttempts) return { error: "Could not generate a unique key. Try again." };

  const row = await prisma.apiKey.create({
    data: { tenantId, name: trimmedName, keyPrefix: prefix, keyHash },
    select: { id: true },
  });

  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(tenantId, "api_key_created", { apiKeyId: row.id, name: trimmedName }, createdByUserId);

  return { key: rawKey, id: row.id };
}

/**
 * List API keys for a tenant (no raw keys).
 */
export async function listApiKeys(tenantId: string) {
  return prisma.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  });
}

/**
 * Revoke (delete) an API key. Returns error if not found or wrong tenant.
 */
export async function revokeApiKey(
  tenantId: string,
  apiKeyId: string,
  revokedByUserId: string
): Promise<{ error?: string }> {
  const row = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, tenantId },
    select: { id: true, name: true },
  });
  if (!row) return { error: "API key not found." };
  await prisma.apiKey.delete({ where: { id: apiKeyId } });
  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(tenantId, "api_key_revoked", { apiKeyId, name: row.name }, revokedByUserId);
  return {};
}
