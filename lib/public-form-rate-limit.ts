/**
 * In-memory rate limit for public form submissions (by tenant + IP).
 * Prevents spam; resets after window.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_PER_WINDOW = 10;

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

/** Returns true if under limit, false if over (should reject). */
export function checkPublicFormRateLimit(tenantId: string, ip: string): boolean {
  const key = `${tenantId}:${ip}`;
  const entry = getEntry(key);
  return entry.count <= MAX_PER_WINDOW;
}
