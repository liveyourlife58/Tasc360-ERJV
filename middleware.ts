import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";

const DASHBOARD_PREFIX = "/dashboard";
const LOGIN_PATH = "/login";
const SITE_PREFIX = "/s";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dashboard: require session; set headers for downstream (tenant + user from session)
  if (pathname.startsWith(DASHBOARD_PREFIX)) {
    const session = getSessionFromCookie(request.cookies.toString());
    if (!session) {
      const login = new URL(LOGIN_PATH, request.url);
      login.searchParams.set("from", pathname);
      return NextResponse.redirect(login);
    }
    const res = NextResponse.next();
    res.headers.set("x-tenant-id", session.tenantId);
    res.headers.set("x-user-id", session.userId);
    return res;
  }

  // Customer site: /s/[slug]/... — tenant resolved in layout from slug
  if (pathname.startsWith(SITE_PREFIX)) {
    const slug = pathname.slice(SITE_PREFIX.length + 1).split("/")[0];
    if (slug) {
      const res = NextResponse.next();
      res.headers.set("x-tenant-slug", slug);
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/s/:path*",
  ],
};
