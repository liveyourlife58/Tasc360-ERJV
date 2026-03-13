/**
 * Consent helpers (read from tenant settings). Not server actions.
 */

export const DEFAULT_CONSENT_TYPES = ["marketing", "essential", "analytics"];

export function getConsentTypes(tenantSettings: Record<string, unknown> | null): string[] {
  const raw = tenantSettings?.consentTypes;
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string");
  if (typeof raw === "string" && raw.trim()) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return DEFAULT_CONSENT_TYPES;
}
