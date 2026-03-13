import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyForTenant } from "@/lib/api-auth";
import { resolveTenantId } from "@/lib/api-tenant";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { getIdempotentResponse, setIdempotentResponse } from "@/lib/idempotency";
import { apiError, withRateLimitHeaders } from "@/lib/api-response";
import { ERROR_CODES } from "@/lib/errors";
import { validateEntityData } from "@/lib/api-entity-validation";
import { logApiEntityEvent } from "@/lib/audit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; moduleSlug: string; entityId: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const { tenantId: tenantIdOrSlug, moduleSlug, entityId } = await params;
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
  const entity = await prisma.entity.findFirst({
    where: {
      id: entityId,
      tenantId,
      moduleId: module_.id,
      deletedAt: null,
    },
    select: { id: true, data: true, createdAt: true, updatedAt: true },
  });
  if (!entity) return withRateLimitHeaders(apiError(ERROR_CODES.NOT_FOUND, 404, "Entity not found."), rate);

  const etag = `W/"${entity.id}-${entity.updatedAt.getTime()}"`;
  const ifNoneMatch = request.headers.get("if-none-match")?.trim();
  if (ifNoneMatch === etag || ifNoneMatch === etag.slice(2, -1)) {
    const res = new NextResponse(null, { status: 304 });
    res.headers.set("ETag", etag);
    return withRateLimitHeaders(res, rate);
  }

  const res = NextResponse.json(entity);
  res.headers.set("ETag", etag);
  return withRateLimitHeaders(res, rate);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; moduleSlug: string; entityId: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const { tenantId: tenantIdOrSlug, moduleSlug, entityId } = await params;
  const tenantId = await resolveTenantId(tenantIdOrSlug);
  if (!tenantId) return apiError(ERROR_CODES.NOT_FOUND, 404, "Tenant not found.");
  const ok = await verifyApiKeyForTenant(apiKey, tenantId);
  if (!ok) return apiError(ERROR_CODES.UNAUTHORIZED);
  const rate = checkApiRateLimit(tenantId, apiKey);
  if (!rate.ok) return withRateLimitHeaders(apiError(ERROR_CODES.RATE_LIMITED), rate);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (idempotencyKey) {
    const cached = await getIdempotentResponse(tenantId, idempotencyKey);
    if (cached.hit) {
      const res = new NextResponse(cached.body, {
        status: cached.statusCode,
        headers: { "Content-Type": "application/json" },
      });
      return withRateLimitHeaders(res, rate);
    }
  }
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) return withRateLimitHeaders(apiError(ERROR_CODES.NOT_FOUND, 404, "Module not found."), rate);
  const existing = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, moduleId: module_.id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return withRateLimitHeaders(apiError(ERROR_CODES.NOT_FOUND, 404, "Entity not found."), rate);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return withRateLimitHeaders(apiError(ERROR_CODES.INVALID_JSON, 400, "Invalid JSON body."), rate);
  }
  const fieldSlugs = new Set(module_.fields.map((f) => f.slug));
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (fieldSlugs.has(key)) data[key] = value;
  }
  if (Object.keys(data).length === 0) {
    return withRateLimitHeaders(NextResponse.json(existing), rate);
  }
  const validation = validateEntityData(module_.fields, data, { partial: true });
  if (!validation.valid) {
    return withRateLimitHeaders(
      apiError(ERROR_CODES.VALIDATION_ERROR, 400, validation.message ?? "Validation failed."),
      rate
    );
  }
  const current = await prisma.entity.findUnique({
    where: { id: entityId },
    select: { data: true },
  });
  const merged = { ...((current?.data as Record<string, unknown>) ?? {}), ...data };
  const searchText = Object.values(merged)
    .filter((v) => typeof v === "string" && v)
    .join(" ")
    .slice(0, 10000) || null;
  const entity = await prisma.entity.update({
    where: { id: entityId },
    data: { data: merged as object, searchText },
  });
  const apiKeyPrefix = (request.headers.get("x-api-key") ?? "").slice(0, 12) || undefined;
  logApiEntityEvent(tenantId, "entity_updated", entityId, { moduleSlug, apiKeyPrefix }).catch(() => {});
  const payload = { id: entity.id, data: entity.data, updatedAt: entity.updatedAt };
  const statusCode = 200;
  if (idempotencyKey) {
    await setIdempotentResponse(tenantId, idempotencyKey, statusCode, JSON.stringify(payload));
  }
  return withRateLimitHeaders(NextResponse.json(payload, { status: statusCode }), rate);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; moduleSlug: string; entityId: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const { tenantId: tenantIdOrSlug, moduleSlug, entityId } = await params;
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
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, moduleId: module_.id, deletedAt: null },
    select: { id: true },
  });
  if (!entity) return withRateLimitHeaders(apiError(ERROR_CODES.NOT_FOUND, 404, "Entity not found."), rate);
  const orderLines = await prisma.orderLine.count({ where: { entityId } });
  if (orderLines > 0) {
    return withRateLimitHeaders(
      apiError(ERROR_CODES.VALIDATION_ERROR, 400, "Cannot delete: tickets have been sold. Refund or transfer first."),
      rate
    );
  }
  await prisma.entity.update({
    where: { id: entityId },
    data: { deletedAt: new Date() },
  });
  const apiKeyPrefix = (request.headers.get("x-api-key") ?? "").slice(0, 12) || undefined;
  logApiEntityEvent(tenantId, "entity_deleted", entityId, { moduleSlug, apiKeyPrefix }).catch(() => {});
  return withRateLimitHeaders(NextResponse.json({ deleted: true }), rate);
}
