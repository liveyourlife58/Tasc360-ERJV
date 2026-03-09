import { prisma } from "./prisma";

/**
 * Resolve tenant ID from API key (X-API-Key header).
 * API key is stored in tenant.settings.apiKey (set from dashboard settings).
 * Returns tenantId if key matches, null otherwise.
 */
export async function getTenantIdFromApiKey(apiKey: string | null): Promise<string | null> {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) return null;
  const key = apiKey.trim();
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, settings: true },
  });
  for (const t of tenants) {
    const settings = t.settings as Record<string, unknown> | null;
    const stored = settings?.apiKey as string | undefined;
    if (stored && stored === key) return t.id;
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
