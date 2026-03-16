import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { checkLoginRateLimit, checkForgotPasswordRateLimit, checkSignupRateLimit } from "@/lib/auth-rate-limit";

const DASHBOARD_PREFIX = "/dashboard";
const AUTH_RATE_LIMIT_RETRY_AFTER_SECONDS = 900; // 15 min

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || real || "unknown";
}

const LOGIN_PATH = "/login";
const SITE_PREFIX = "/s";
const API_V1_PREFIX = "/api/v1";
const API_VERSION = "1";

function corsHeaders(origin: string): [string, string][] {
  return [
    ["Access-Control-Allow-Origin", origin],
    ["Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS"],
    ["Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization, Idempotency-Key"],
    ["X-API-Version", API_VERSION],
  ];
}

const HEALTH_PATH = "/api/health";
const READY_PATH = "/api/ready";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.MAINTENANCE_MODE === "1" || process.env.MAINTENANCE_MODE === "true") {
    if (pathname !== HEALTH_PATH && pathname !== READY_PATH) {
      return new NextResponse(
        JSON.stringify({ error: "Under maintenance. Please try again later." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const isLoginPost = request.method === "POST" && (pathname === "/login" || pathname === "/api/auth/login");
  const isForgotPost = request.method === "POST" && (pathname === "/forgot-password" || pathname === "/api/auth/forgot-password");
  const isSignupPost = request.method === "POST" && (pathname === "/signup" || pathname === "/api/auth/signup");
  if (isLoginPost) {
    const ip = getClientIp(request);
    if (!checkLoginRateLimit(ip)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many login attempts from this address. Try again in 15 minutes." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(AUTH_RATE_LIMIT_RETRY_AFTER_SECONDS),
          },
        }
      );
    }
  }
  if (isForgotPost) {
    const ip = getClientIp(request);
    if (!checkForgotPasswordRateLimit(ip)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many reset requests from this address. Try again in 15 minutes." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(AUTH_RATE_LIMIT_RETRY_AFTER_SECONDS),
          },
        }
      );
    }
  }
  if (isSignupPost) {
    const ip = getClientIp(request);
    if (!checkSignupRateLimit(ip)) {
      return new NextResponse(
        JSON.stringify({ error: "Too many signup attempts from this address. Try again in 15 minutes." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(AUTH_RATE_LIMIT_RETRY_AFTER_SECONDS),
          },
        }
      );
    }
  }

  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  function setRequestId(res: NextResponse): void {
    res.headers.set("X-Request-ID", requestId);
  }

  // Tenant API: CORS, max body size, and request ID
  if (pathname.startsWith(API_V1_PREFIX)) {
    const origin = process.env.CORS_ORIGIN?.trim() || "*";
    const headerEntries = corsHeaders(origin);
    if (request.method === "OPTIONS") {
      const headers = new Headers(headerEntries);
      headers.set("X-Request-ID", requestId);
      headers.set("X-API-Version", API_VERSION);
      return new NextResponse(null, { status: 204, headers });
    }
    const contentLength = request.headers.get("content-length");
    const maxBody = 1024 * 1024; // 1MB (matches app-config.apiMaxBodyBytes)
    if (
      (request.method === "POST" || request.method === "PATCH") &&
      contentLength &&
      parseInt(contentLength, 10) > maxBody
    ) {
      const headers = new Headers(headerEntries);
      headers.set("X-Request-ID", requestId);
      headers.set("X-API-Version", API_VERSION);
      headers.set("Content-Type", "application/json");
      return new NextResponse(
        JSON.stringify({ error: "Request body too large.", code: "VALIDATION_ERROR" }),
        { status: 413, headers }
      );
    }
    if (process.env.DEBUG_API_LOGGING === "1" || process.env.DEBUG_API_LOGGING === "true") {
      console.log(`[API] ${request.method} ${pathname} (${requestId})`);
    }
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    headerEntries.forEach(([k, v]) => res.headers.set(k, v));
    setRequestId(res);
    return res;
  }

  // Dashboard: require session; set headers for downstream (tenant + user from session)
  if (pathname.startsWith(DASHBOARD_PREFIX)) {
    const session = getSessionFromCookie(request.cookies.toString());
    if (!session) {
      const login = new URL(LOGIN_PATH, request.url);
      login.searchParams.set("from", pathname);
      return NextResponse.redirect(login);
    }
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-tenant-id", session.tenantId);
    res.headers.set("x-user-id", session.userId);
    res.headers.set("x-pathname", pathname);
    setRequestId(res);
    return res;
  }

  // Customer site: /s/[slug]/... — tenant resolved in layout from slug
  if (pathname.startsWith(SITE_PREFIX)) {
    const slug = pathname.slice(SITE_PREFIX.length + 1).split("/")[0];
    if (slug) {
      const res = NextResponse.next({ request: { headers: requestHeaders } });
      res.headers.set("x-tenant-slug", slug);
      setRequestId(res);
      return res;
    }
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  setRequestId(res);
  return res;
}

export const config = {
  matcher: [
    "/api/health",
    "/api/ready",
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/forgot-password",
    "/api/v1/:path*",
    "/api/webhooks/:path*",
    "/api/cron/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/s/:path*",
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/set-customer-password",
  ],
};
