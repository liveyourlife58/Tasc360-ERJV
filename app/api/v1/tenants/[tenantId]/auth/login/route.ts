import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
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

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return withRateLimitHeaders(apiError(ERROR_CODES.INVALID_JSON), rate);
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return withRateLimitHeaders(apiError(ERROR_CODES.VALIDATION_ERROR, 400, "Email and password are required."), rate);
  }

  const user = await prisma.tenantEndUser.findUnique({
    where: { tenantId_email: { tenantId, email } },
    select: { id: true, email: true, name: true, passwordHash: true, isActive: true },
  });
  if (!user || !user.isActive || !user.passwordHash) {
    return withRateLimitHeaders(apiError(ERROR_CODES.UNAUTHORIZED, 401, "Invalid email or password."), rate);
  }
  const match = await compare(password, user.passwordHash);
  if (!match) {
    return withRateLimitHeaders(apiError(ERROR_CODES.UNAUTHORIZED, 401, "Invalid email or password."), rate);
  }

  await prisma.tenantEndUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(tenantId, "end_user_login", { email: user.email, endUserId: user.id }, null);

  let token: string;
  try {
    token = await signTenantEndUserToken(tenantId, user.id);
  } catch (e) {
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
