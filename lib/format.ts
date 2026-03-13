/**
 * Date/number formatting using tenant locale from settings.
 */

export function getTenantLocale(settings: unknown): string | undefined {
  if (!settings || typeof settings !== "object") return undefined;
  const locale = (settings as Record<string, unknown>).locale as string | undefined;
  return locale && /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : undefined;
}

export function formatDate(date: Date | string, locale?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale || undefined);
}

export function formatDateTime(date: Date | string, locale?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale || undefined);
}

export function formatNumber(value: number, locale?: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale || undefined, options).format(value);
}

/** Format a value for display; if fieldType is date/datetime, format as date string. Optional locale for Intl. */
export function formatDateIfApplicable(value: unknown, fieldType?: string, locale?: string): string {
  if (value == null) return "";
  if (fieldType === "date" || fieldType === "datetime") {
    const d = typeof value === "string" ? new Date(value) : value as Date;
    if (Number.isNaN((d as Date).getTime())) return String(value);
    return fieldType === "date"
      ? (d as Date).toLocaleDateString(locale || undefined)
      : (d as Date).toLocaleString(locale || undefined);
  }
  return String(value);
}
