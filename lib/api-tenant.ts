/**
 * Resolve tenant from API path param. Accepts either tenant UUID or slug.
 * Use for /api/v1/tenants/:tenantIdOrSlug/... routes so callers can use a readable slug.
 */

import { prisma } from "./prisma";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolve tenantIdOrSlug (from URL path) to tenant UUID, or null if not found.
 * Pass the raw param; if it looks like a UUID we look up by id, else by slug.
 */
export async function resolveTenantId(tenantIdOrSlug: string): Promise<string | null> {
  const s = (tenantIdOrSlug ?? "").trim();
  if (!s) return null;
  if (UUID_REGEX.test(s)) {
    const t = await prisma.tenant.findFirst({
      where: { id: s, isActive: true },
      select: { id: true },
    });
    return t?.id ?? null;
  }
  const t = await prisma.tenant.findFirst({
    where: { slug: s, isActive: true },
    select: { id: true },
  });
  return t?.id ?? null;
}
