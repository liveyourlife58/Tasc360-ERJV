/**
 * Developer setup: per-tenant flag (allowDeveloperSetup) and platform admin check.
 * When allowDeveloperSetup is false, API keys, webhooks, and Integrations are hidden from the dashboard.
 * Only platform admins (PLATFORM_ADMIN_EMAILS) can turn the flag on for a tenant.
 */

export function getAllowDeveloperSetup(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false;
  const v = (settings as Record<string, unknown>).allowDeveloperSetup;
  return v === true;
}

/**
 * True if the given email is listed in PLATFORM_ADMIN_EMAILS (comma-separated, trimmed).
 * Platform admins can enable "Developer setup" for any tenant.
 */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const raw = process.env.PLATFORM_ADMIN_EMAILS;
  if (!raw || typeof raw !== "string") return false;
  const list = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
