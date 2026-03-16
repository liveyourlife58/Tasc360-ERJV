import crypto from "crypto";
import { prisma } from "./prisma";

const KEY_PREFIX_LEN = 12;

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

/**
 * Resolve tenant ID from API key (X-API-Key header).
 * Keys are stored in the api_keys table (prefix + hash). Returns tenantId if key matches, null otherwise.
 */
export async function getTenantIdFromApiKey(apiKey: string | null): Promise<string | null> {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) return null;
  const key = apiKey.trim();

  const prefix = key.slice(0, KEY_PREFIX_LEN);
  if (prefix.length < KEY_PREFIX_LEN) return null;

  const row = await prisma.apiKey.findUnique({
    where: { keyPrefix: prefix },
    select: { id: true, tenantId: true, keyHash: true },
  });
  if (row && row.keyHash === hashKey(key)) {
    prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    return row.tenantId;
  }
  return null;
}

/**
 * Verify that the given API key is valid for the given tenant ID.
 * Use for route handlers that receive tenantId in path.
 */
export async function verifyApiKeyForTenant(
  apiKey: string | null,
  tenantId: string
): Promise<boolean> {
  const resolved = await getTenantIdFromApiKey(apiKey);
  return resolved === tenantId;
}
