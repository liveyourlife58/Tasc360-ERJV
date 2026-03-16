/**
 * JWT for tenant end-user (customer) auth. Used by /api/v1/tenants/:tenantId/auth/*.
 * Sign with a secret; verify on subsequent requests (e.g. Authorization: Bearer <token>).
 */

import * as jose from "jose";

const ISSUER = "tasc360-tenant-end-user";
const AUDIENCE = "tasc360-tenant-api";
const DEFAULT_EXPIRY_SEC = 60 * 60 * 24 * 7; // 7 days

export type TenantEndUserJwtPayload = {
  tenantId: string;
  endUserId: string;
  sub: string; // same as endUserId
  iat: number;
  exp: number;
};

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw || typeof raw !== "string" || raw.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters for tenant end-user auth.");
  }
  return new TextEncoder().encode(raw);
}

/** Sign a JWT for the given tenant and end user. */
export async function signTenantEndUserToken(
  tenantId: string,
  endUserId: string,
  expiresInSec: number = DEFAULT_EXPIRY_SEC
): Promise<string> {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new jose.SignJWT({ tenantId, endUserId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(endUserId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSec)
    .sign(secret);
  return jwt;
}

/** Verify a Bearer token and return the payload. Returns null if invalid or expired. */
export async function verifyTenantEndUserToken(token: string): Promise<TenantEndUserJwtPayload | null> {
  try {
    const secret = getSecret();
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const tenantId = payload.tenantId as string | undefined;
    const endUserId = payload.sub as string | undefined;
    if (!tenantId || !endUserId) return null;
    return {
      tenantId,
      endUserId,
      sub: endUserId,
      iat: (payload.iat as number) ?? 0,
      exp: (payload.exp as number) ?? 0,
    };
  } catch {
    return null;
  }
}

/** Get Bearer token from Authorization header. */
export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}
