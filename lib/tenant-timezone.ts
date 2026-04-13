/**
 * Tenant-level IANA timezone (`settings.timeZone`) for calendar-day logic
 * (deadline list order, highlight rules, date display) on the dashboard.
 */

export const DEFAULT_TENANT_TIME_ZONE = "UTC";

export function isValidIanaTimeZone(id: string): boolean {
  const t = id.trim();
  if (!t) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return true;
  } catch {
    return false;
  }
}

/** Resolved IANA id for comparisons and Intl; invalid or missing → UTC. */
export function getTenantTimeZone(settings: unknown): string {
  if (!settings || typeof settings !== "object") return DEFAULT_TENANT_TIME_ZONE;
  const raw = (settings as Record<string, unknown>).timeZone;
  if (typeof raw !== "string") return DEFAULT_TENANT_TIME_ZONE;
  const id = raw.trim();
  if (!id || !isValidIanaTimeZone(id)) return DEFAULT_TENANT_TIME_ZONE;
  return id;
}

/** Current calendar date `YYYY-MM-DD` in the given IANA time zone. */
/** Common IANA zones for tenant settings UI (value = IANA id). */
export const TENANT_TIME_ZONE_PRESETS: { value: string; label: string }[] = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern (US & Canada)" },
  { value: "America/Chicago", label: "Central (US & Canada)" },
  { value: "America/Denver", label: "Mountain (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific (US & Canada)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "America/Phoenix", label: "Arizona (no DST)" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "America/Vancouver", label: "Vancouver" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
];

export function calendarYmdNowInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (y && m && d) return `${y}-${m}-${d}`;
  return new Date().toISOString().slice(0, 10);
}
