/**
 * Env validation: ensure required vars are set. Call in instrumentation or at app boot.
 * Only DATABASE_URL is required for the app to run; others are optional for specific features.
 */

const REQUIRED = ["DATABASE_URL"] as const;

export function validateEnv(): { ok: true } | { ok: false; missing: string[] } {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length === 0) return { ok: true };
  return { ok: false, missing: [...missing] };
}

/**
 * Call during build or server startup. Throws if required env is missing.
 */
export function requireEnv(): void {
  const result = validateEnv();
  if (!result.ok) {
    throw new Error(
      `Missing required environment variable(s): ${result.missing.join(", ")}. Copy .env.example to .env and set them.`
    );
  }
}
