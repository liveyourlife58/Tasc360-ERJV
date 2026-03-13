/**
 * Per-tenant API rate limiting (in-memory). Use for /api/v1/* routes.
 * Config: API_RATE_LIMIT_PER_MINUTE (default from app-config).
 */

import { getApiRateLimitPerMinute } from "./app-config";

const WINDOW_MS = 60 * 1000;

function getLimitPerMinute(): number {
  return getApiRateLimitPerMinute();
}

type Entry = { count: number; windowStart: number };

const map = new Map<string, Entry>();

function getEntry(key: string): Entry {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur) {
    const e: Entry = { count: 1, windowStart: now };
    map.set(key, e);
    return e;
  }
  if (now - cur.windowStart >= WINDOW_MS) {
    cur.count = 1;
    cur.windowStart = now;
    return cur;
  }
  cur.count++;
  return cur;
}

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp (seconds) when the window ends
};

/**
 * Check rate limit for tenant (and optionally apiKey).
 * Returns { ok, limit, remaining, reset } for use in X-RateLimit-* response headers.
 * Call after verifying API key so tenantId is trusted.
 */
export function checkApiRateLimit(tenantId: string, apiKey?: string | null): RateLimitResult {
  const limit = getLimitPerMinute();
  const key = apiKey ? `${tenantId}:${apiKey}` : tenantId;
  const entry = getEntry(key);
  const remaining = Math.max(0, limit - entry.count);
  const reset = Math.ceil((entry.windowStart + WINDOW_MS) / 1000);
  return {
    ok: entry.count <= limit,
    limit,
    remaining,
    reset,
  };
}

/** Headers to attach to API responses for rate limit visibility. */
export function rateLimitHeaders(rate: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(rate.reset),
  };
}
