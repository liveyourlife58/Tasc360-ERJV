/**
 * Structured API responses. Use apiError() for error responses with optional code.
 */

import { NextResponse } from "next/server";
import { apiErrorPayload, type ApiErrorPayload, type ErrorCode } from "./errors";
import { rateLimitHeaders, type RateLimitResult } from "./rate-limit";

/** Return a JSON error response with optional code. Status defaults by code. */
export function apiError(
  code: ErrorCode,
  status?: number,
  overrideMessage?: string
): NextResponse<ApiErrorPayload> {
  const payload = apiErrorPayload(code, overrideMessage);
  const statusCode =
    status ??
    (code === "UNAUTHORIZED"
      ? 401
      : code === "FORBIDDEN"
        ? 403
        : code === "NOT_FOUND"
          ? 404
          : code === "RATE_LIMITED"
            ? 429
            : code === "VALIDATION_ERROR" || code === "INVALID_JSON"
              ? 400
              : code === "CONFLICT"
                ? 409
                : 500);
  return NextResponse.json(payload, { status: statusCode });
}

/** Attach X-RateLimit-* headers to a response. Use for all /api/v1/* responses. */
export function withRateLimitHeaders<T>(res: NextResponse<T>, rate: RateLimitResult): NextResponse<T> {
  Object.entries(rateLimitHeaders(rate)).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}
