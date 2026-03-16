import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyForTenant } from "@/lib/api-auth";
import { resolveTenantId } from "@/lib/api-tenant";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { apiError, withRateLimitHeaders } from "@/lib/api-response";
import { ERROR_CODES } from "@/lib/errors";

export type ApiField = {
  id: string;
  name: string;
  slug: string;
  fieldType: string;
  isRequired: boolean;
  settings: Record<string, unknown> | null;
  sortOrder: number;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; moduleSlug: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const { tenantId: tenantIdOrSlug, moduleSlug } = await params;
  const tenantId = await resolveTenantId(tenantIdOrSlug);
  if (!tenantId) return apiError(ERROR_CODES.NOT_FOUND, 404, "Tenant not found.");
  const ok = await verifyApiKeyForTenant(apiKey, tenantId);
  if (!ok) return apiError(ERROR_CODES.UNAUTHORIZED);
  const rate = checkApiRateLimit(tenantId, apiKey);
  if (!rate.ok) return withRateLimitHeaders(apiError(ERROR_CODES.RATE_LIMITED), rate);
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    select: { id: true },
  });
  if (!module_) return withRateLimitHeaders(apiError(ERROR_CODES.NOT_FOUND, 404, "Module not found."), rate);
  const rows = await prisma.field.findMany({
    where: { moduleId: module_.id },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, fieldType: true, isRequired: true, settings: true, sortOrder: true },
  });
  const fields: ApiField[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    fieldType: r.fieldType,
    isRequired: r.isRequired,
    settings: r.settings as Record<string, unknown> | null,
    sortOrder: r.sortOrder,
  }));
  return withRateLimitHeaders(NextResponse.json({ fields }), rate);
}
