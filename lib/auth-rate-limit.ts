/**
 * In-memory rate limit for auth endpoints (login, forgot-password) by IP.
 * Reduces brute force and credential stuffing from a single IP.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 min
const MAX_LOGIN_PER_WINDOW = 20;
const MAX_FORGOT_PASSWORD_PER_WINDOW = 5;
const MAX_SIGNUP_PER_WINDOW = 5;

type Entry = { count: number; windowStart: number };
const loginMap = new Map<string, Entry>();
const forgotMap = new Map<string, Entry>();
const signupMap = new Map<string, Entry>();

function getEntry(map: Map<string, Entry>, key: string, max: number): { allowed: boolean; entry: Entry } {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur) {
    const e: Entry = { count: 1, windowStart: now };
    map.set(key, e);
    return { allowed: true, entry: e };
  }
  if (now - cur.windowStart >= WINDOW_MS) {
    cur.count = 1;
    cur.windowStart = now;
    return { allowed: true, entry: cur };
  }
  cur.count++;
  return { allowed: cur.count <= max, entry: cur };
}

/** Returns true if under limit (allowed), false if over limit (reject). */
export function checkLoginRateLimit(ip: string): boolean {
  return getEntry(loginMap, ip, MAX_LOGIN_PER_WINDOW).allowed;
}

/** Returns true if under limit (allowed), false if over limit (reject). */
export function checkForgotPasswordRateLimit(ip: string): boolean {
  return getEntry(forgotMap, ip, MAX_FORGOT_PASSWORD_PER_WINDOW).allowed;
}

/** Returns true if under limit (allowed), false if over limit (reject). */
export function checkSignupRateLimit(ip: string): boolean {
  return getEntry(signupMap, ip, MAX_SIGNUP_PER_WINDOW).allowed;
}
