import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyForTenant } from "@/lib/api-auth";
import { resolveTenantId } from "@/lib/api-tenant";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { getIdempotentResponse, setIdempotentResponse } from "@/lib/idempotency";
import { apiError, withRateLimitHeaders } from "@/lib/api-response";
import { ERROR_CODES } from "@/lib/errors";
import { validateEntityData } from "@/lib/api-entity-validation";
import { createRequestLogger } from "@/lib/logger";
import { logApiEntityEvent, logAuditEvent } from "@/lib/audit";

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
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
  const cursor = searchParams.get("cursor") ?? searchParams.get("after") ?? undefined;
  const entities = await prisma.entity.findMany({
    where: { tenantId, moduleId: module_.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, data: true, createdAt: true },
  });
  const hasMore = entities.length > limit;
  const page = hasMore ? entities.slice(0, limit) : entities;
  const nextCursor = hasMore ? page[page.length - 1]?.id : null;
  return withRateLimitHeaders(
    NextResponse.json({ entities: page, nextCursor: nextCursor ?? undefined }),
    rate
  );
}

export async function POST(
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
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return withRateLimitHeaders(
      apiError(ERROR_CODES.INVALID_JSON, 400, "Invalid JSON body. Send an object with field slugs as keys."),
      rate
    );
  }
  const validation = validateEntityData(module_.fields, body, { partial: false });
  if (!validation.valid) {
    return withRateLimitHeaders(
      apiError(ERROR_CODES.VALIDATION_ERROR, 400, validation.message ?? "Validation failed."),
      rate
    );
  }
  const fieldSlugs = new Set(module_.fields.map((f) => f.slug));
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (fieldSlugs.has(key)) data[key] = value;
  }
  const searchText = Object.values(data)
    .filter((v) => typeof v === "string" && v)
    .join(" ");
  const entity = await prisma.entity.create({
    data: {
      tenantId,
      moduleId: module_.id,
      data: data as object,
      searchText: searchText.slice(0, 10000) || null,
    },
  });
  const requestId = request.headers.get("x-request-id") ?? undefined;
  const apiKeyPrefix = (apiKey ?? "").slice(0, 12) || undefined;
  createRequestLogger({ requestId, tenantId }).info("Entity created", { entityId: entity.id, moduleSlug });
  logApiEntityEvent(tenantId, "entity_created", entity.id, { moduleSlug, apiKeyPrefix }).catch(() => {});
  const payload = { id: entity.id, data: entity.data, createdAt: entity.createdAt };
  const statusCode = 201;
  if (idempotencyKey) {
    await setIdempotentResponse(tenantId, idempotencyKey, statusCode, JSON.stringify(payload));
  }
  return withRateLimitHeaders(NextResponse.json(payload, { status: statusCode }), rate);
}

export async function PATCH(
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
  let body: { ids?: string[]; data?: Record<string, unknown> };
  try {
    body = (await request.json()) as { ids?: string[]; data?: Record<string, unknown> };
  } catch {
    return withRateLimitHeaders(
      apiError(ERROR_CODES.INVALID_JSON, 400, "Invalid JSON body. Send { ids: string[], data: object }."),
      rate
    );
  }
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === "string") : [];
  const patch = body?.data && typeof body.data === "object" ? body.data : {};
  if (ids.length === 0 || Object.keys(patch).length === 0) {
    return withRateLimitHeaders(
      apiError(ERROR_CODES.VALIDATION_ERROR, 400, "ids and data are required."),
      rate
    );
  }
  const validation = validateEntityData(module_!.fields, patch, { partial: true });
  if (!validation.valid) {
    return withRateLimitHeaders(
      apiError(ERROR_CODES.VALIDATION_ERROR, 400, validation.message ?? "Validation failed."),
      rate
    );
  }
  const fieldSlugs = new Set(module_!.fields.map((f) => f.slug));
  const dataPatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (fieldSlugs.has(key)) dataPatch[key] = value;
  }
  if (Object.keys(dataPatch).length === 0) {
    return withRateLimitHeaders(NextResponse.json({ updated: 0 }), rate);
  }
  const existing = await prisma.entity.findMany({
    where: { id: { in: ids }, tenantId, moduleId: module_!.id, deletedAt: null },
    select: { id: true, data: true },
  });
  let updated = 0;
  for (const entity of existing) {
    const current = (entity.data as Record<string, unknown>) ?? {};
    const merged = { ...current, ...dataPatch };
    const searchText = Object.values(merged)
      .filter((v) => typeof v === "string" && v)
      .join(" ")
      .slice(0, 10000) || null;
    await prisma.entity.update({
      where: { id: entity.id },
      data: { data: merged as object, searchText },
    });
    updated++;
  }
  const apiKeyPrefix = (apiKey ?? "").slice(0, 12) || undefined;
  logAuditEvent(
    tenantId,
    "entity_updated",
    { source: "api", apiKeyPrefix, moduleSlug, updatedCount: updated, entityIds: existing.map((e) => e.id) },
    null,
    null
  ).catch(() => {});
  const payload = { updated };
  const statusCode = 200;
  if (idempotencyKey) {
    await setIdempotentResponse(tenantId, idempotencyKey, statusCode, JSON.stringify(payload));
  }
  return withRateLimitHeaders(NextResponse.json(payload, { status: statusCode }), rate);
}
