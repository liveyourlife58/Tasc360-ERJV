import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyForTenant } from "@/lib/api-auth";
import { resolveTenantId } from "@/lib/api-tenant";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { apiError, withRateLimitHeaders } from "@/lib/api-response";
import { ERROR_CODES } from "@/lib/errors";

const RELATED_MAX_LIMIT = 100;

/**
 * GET /api/v1/tenants/:tenantId/entities/:entityId/related
 * Query: type (optional) - filter by relationType. limit (default 50, max 100), after (relationship id for cursor).
 * Returns entities linked to this one via the relationships table (incoming and outgoing).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; entityId: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const { tenantId: tenantIdOrSlug, entityId } = await params;
  const tenantId = await resolveTenantId(tenantIdOrSlug);
  if (!tenantId) return apiError(ERROR_CODES.NOT_FOUND, 404, "Tenant not found.");
  const ok = await verifyApiKeyForTenant(apiKey, tenantId);
  if (!ok) return apiError(ERROR_CODES.UNAUTHORIZED);
  const rate = checkApiRateLimit(tenantId, apiKey);
  if (!rate.ok) return withRateLimitHeaders(apiError(ERROR_CODES.RATE_LIMITED), rate);

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!entity) return withRateLimitHeaders(apiError(ERROR_CODES.NOT_FOUND, 404, "Entity not found."), rate);

  const typeFilter = request.nextUrl.searchParams.get("type")?.trim() || null;
  const limit = Math.min(
    RELATED_MAX_LIMIT,
    Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") ?? "50", 10) || 50)
  );

  const [fromSource, fromTarget] = await Promise.all([
    prisma.relationship.findMany({
      where: {
        tenantId,
        sourceId: entityId,
        ...(typeFilter ? { relationType: typeFilter } : {}),
      },
      orderBy: { id: "asc" },
      include: { target: { include: { module: { select: { slug: true, name: true } } } } },
    }),
    prisma.relationship.findMany({
      where: {
        tenantId,
        targetId: entityId,
        ...(typeFilter ? { relationType: typeFilter } : {}),
      },
      orderBy: { id: "asc" },
      include: { source: { include: { module: { select: { slug: true, name: true } } } } },
    }),
  ]);

  const combined: {
    id: string;
    relationshipId: string;
    moduleSlug: string;
    moduleName: string;
    relationType: string;
    direction: "out" | "in";
    data: Record<string, unknown>;
  }[] = [];

  fromSource.forEach((r) => {
    combined.push({
      id: r.target.id,
      relationshipId: r.id,
      moduleSlug: r.target.module?.slug ?? "",
      moduleName: r.target.module?.name ?? "",
      relationType: r.relationType,
      direction: "out",
      data: (r.target.data as Record<string, unknown>) ?? {},
    });
  });
  fromTarget.forEach((r) => {
    combined.push({
      id: r.source.id,
      relationshipId: r.id,
      moduleSlug: r.source.module?.slug ?? "",
      moduleName: r.source.module?.name ?? "",
      relationType: r.relationType,
      direction: "in",
      data: (r.source.data as Record<string, unknown>) ?? {},
    });
  });

  combined.sort((a, b) => a.relationshipId.localeCompare(b.relationshipId));
  const after = request.nextUrl.searchParams.get("after")?.trim() || null;
  const filtered = after ? combined.filter((x) => x.relationshipId > after) : combined;
  const hasMore = filtered.length > limit;
  const page = filtered.slice(0, limit);
  const nextCursor = hasMore ? page[page.length - 1]?.relationshipId : undefined;

  return withRateLimitHeaders(
    NextResponse.json({ related: page, nextCursor }),
    rate
  );
}
