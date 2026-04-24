/**
 * Date/number formatting using tenant locale from settings.
 */

/** Leading `YYYY-MM-DD` from stored values (plain date or ISO datetime). */
export function extractYyyyMmDdFromStoredValue(value: unknown): string {
  if (value == null || value === "") return "";
  const s = String(value).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : "";
}

/** Interpret a strict `YYYY-MM-DD` as that calendar day in the local timezone (avoids UTC-midnight off-by-one in `toLocaleDateString`). */
export function parseCalendarYmdToLocalDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Calendar grid bucket `YYYY-MM-DD` for a stored date/datetime value, aligned with
 * {@link formatDateIfApplicable} for `date` fields (no `new Date("YYYY-MM-DD")` UTC shift).
 */
export function dateFieldCalendarKey(value: unknown, timeZone?: string): string | null {
  if (value == null || value === "") return null;
  const tz = typeof timeZone === "string" && timeZone.trim() !== "" ? timeZone.trim() : undefined;

  const ymdPartsInZone = (instant: Date): string | null => {
    if (!tz) return null;
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(instant);
    } catch {
      return null;
    }
  };

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const inTz = ymdPartsInZone(value);
    if (inTz) return inTz;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  if (typeof value !== "string") return null;

  const ymd = extractYyyyMmDdFromStoredValue(value);
  if (ymd.length === 10) {
    const parts = ymd.split("-").map(Number);
    const y = parts[0]!;
    const mo = parts[1]!;
    const day = parts[2]!;
    if (
      Number.isFinite(y) &&
      Number.isFinite(mo) &&
      Number.isFinite(day) &&
      mo >= 1 &&
      mo <= 12 &&
      day >= 1 &&
      day <= 31
    ) {
      const cal = new Date(y, mo - 1, day);
      if (cal.getFullYear() === y && cal.getMonth() === mo - 1 && cal.getDate() === day) {
        if (tz) {
          const anchor = new Date(Date.UTC(y, mo - 1, day, 12, 0, 0));
          const inTz = ymdPartsInZone(anchor);
          if (inTz) return inTz;
        }
        return ymd;
      }
    }
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const inTz = ymdPartsInZone(d);
  if (inTz) return inTz;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getTenantLocale(settings: unknown): string | undefined {
  if (!settings || typeof settings !== "object") return undefined;
  const locale = (settings as Record<string, unknown>).locale as string | undefined;
  return locale && /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : undefined;
}

export function formatDate(date: Date | string, locale?: string): string {
  if (typeof date === "string") {
    const ymd = extractYyyyMmDdFromStoredValue(date);
    if (ymd.length === 10) {
      const local = parseCalendarYmdToLocalDate(ymd);
      if (local) return local.toLocaleDateString(locale || undefined);
    }
  }
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale || undefined);
}

export function formatDateTime(date: Date | string, locale?: string, timeZone?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (timeZone) {
    return d.toLocaleString(locale || undefined, { timeZone });
  }
  return d.toLocaleString(locale || undefined);
}

export function formatNumber(value: number, locale?: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale || undefined, options).format(value);
}

/** Format a value for display; if fieldType is date/datetime, format as date string. Optional IANA `timeZone` for date fields (tenant setting). */
export function formatDateIfApplicable(
  value: unknown,
  fieldType?: string,
  locale?: string,
  timeZone?: string
): string {
  if (value == null) return "";
  if (fieldType === "date" && typeof value === "string") {
    const ymd = extractYyyyMmDdFromStoredValue(value);
    if (ymd.length === 10) {
      if (timeZone) {
        const parts = ymd.split("-").map(Number);
        const y = parts[0];
        const mo = parts[1];
        const d = parts[2];
        if (Number.isFinite(y) && Number.isFinite(mo) && Number.isFinite(d)) {
          const anchor = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
          return anchor.toLocaleDateString(locale || undefined, { timeZone });
        }
      }
      const local = parseCalendarYmdToLocalDate(ymd);
      if (local) return local.toLocaleDateString(locale || undefined);
    }
  }
  if (fieldType === "date" || fieldType === "datetime") {
    const d = typeof value === "string" ? new Date(value) : (value as Date);
    if (Number.isNaN((d as Date).getTime())) return String(value);
    return fieldType === "date"
      ? (d as Date).toLocaleDateString(locale || undefined)
      : (d as Date).toLocaleString(locale || undefined);
  }
  return String(value);
}
