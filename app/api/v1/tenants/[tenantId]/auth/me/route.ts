import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantId } from "@/lib/api-tenant";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { apiError, withRateLimitHeaders } from "@/lib/api-response";
import { ERROR_CODES } from "@/lib/errors";
import { getBearerToken, verifyTenantEndUserToken } from "@/lib/tenant-auth-jwt";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId: tenantIdOrSlug } = await params;
  const tenantId = await resolveTenantId(tenantIdOrSlug);
  if (!tenantId) return apiError(ERROR_CODES.NOT_FOUND, 404, "Tenant not found.");

  const token = getBearerToken(request);
  if (!token) return apiError(ERROR_CODES.UNAUTHORIZED, 401, "Authorization: Bearer <token> is required.");

  const payload = await verifyTenantEndUserToken(token);
  if (!payload) return apiError(ERROR_CODES.UNAUTHORIZED, 401, "Invalid or expired token.");
  if (payload.tenantId !== tenantId) {
    return apiError(ERROR_CODES.FORBIDDEN, 403, "Token does not match tenant.");
  }

  const rate = checkApiRateLimit(tenantId, null);
  if (!rate.ok) return withRateLimitHeaders(apiError(ERROR_CODES.RATE_LIMITED), rate);

  const user = await prisma.tenantEndUser.findFirst({
    where: { id: payload.endUserId, tenantId, isActive: true },
    select: { id: true, email: true, name: true },
  });
  if (!user) return withRateLimitHeaders(apiError(ERROR_CODES.UNAUTHORIZED, 401, "User not found or inactive."), rate);

  return withRateLimitHeaders(
    NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } }),
    rate
  );
}
