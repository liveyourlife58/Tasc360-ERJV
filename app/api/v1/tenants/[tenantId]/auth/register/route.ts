import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyForTenant } from "@/lib/api-auth";
import { resolveTenantId } from "@/lib/api-tenant";
import { checkApiRateLimit } from "@/lib/rate-limit";
import { apiError, withRateLimitHeaders } from "@/lib/api-response";
import { ERROR_CODES } from "@/lib/errors";
import { getCustomerLoginSettings } from "@/lib/customer-login-settings";
import { signTenantEndUserToken } from "@/lib/tenant-auth-jwt";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const { tenantId: tenantIdOrSlug } = await params;
  const tenantId = await resolveTenantId(tenantIdOrSlug);
  if (!tenantId) return apiError(ERROR_CODES.NOT_FOUND, 404, "Tenant not found.");
  const ok = await verifyApiKeyForTenant(apiKey, tenantId);
  if (!ok) return apiError(ERROR_CODES.UNAUTHORIZED);
  const rate = checkApiRateLimit(tenantId, apiKey);
  if (!rate.ok) return withRateLimitHeaders(apiError(ERROR_CODES.RATE_LIMITED), rate);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const customerLogin = getCustomerLoginSettings(tenant?.settings ?? null);
  if (!customerLogin.enabled) {
    return withRateLimitHeaders(apiError(ERROR_CODES.FORBIDDEN, 403, "Customer logins are not enabled for this tenant."), rate);
  }
  if (!customerLogin.allowSelfSignup) {
    return withRateLimitHeaders(apiError(ERROR_CODES.FORBIDDEN, 403, "Self-signup is not allowed. Use an invite link."), rate);
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string; name?: string };
  } catch {
    return withRateLimitHeaders(apiError(ERROR_CODES.INVALID_JSON), rate);
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const name = (body.name ?? "").trim() || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return withRateLimitHeaders(apiError(ERROR_CODES.VALIDATION_ERROR, 400, "A valid email is required."), rate);
  }
  if (!password || password.length < 8) {
    return withRateLimitHeaders(apiError(ERROR_CODES.VALIDATION_ERROR, 400, "Password must be at least 8 characters."), rate);
  }

  const existing = await prisma.tenantEndUser.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (existing) {
    return withRateLimitHeaders(apiError(ERROR_CODES.CONFLICT, 409, "An account with this email already exists."), rate);
  }

  const passwordHash = await hash(password, 10);
  const user = await prisma.tenantEndUser.create({
    data: { tenantId, email, name, passwordHash, isActive: true },
    select: { id: true, email: true, name: true },
  });

  let token: string;
  try {
    token = await signTenantEndUserToken(tenantId, user.id);
  } catch {
    return withRateLimitHeaders(
      apiError(ERROR_CODES.INTERNAL, 503, "Auth is not configured. Set JWT_SECRET."),
      rate
    );
  }

  return withRateLimitHeaders(
    NextResponse.json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    }),
    rate
  );
}
