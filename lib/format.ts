/**
 * App-wide date formatting. Storage stays as ISO (YYYY-MM-DD) or DateTime in DB;
 * we only convert to display format here.
 */
const DATE_DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toISOString" in (value as object))
    return new Date((value as Date).toString());
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Format a value as "Mar 9, 2026". Returns "—" for null/invalid. */
export function formatDate(value: unknown): string {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-US", DATE_DISPLAY_OPTIONS);
}

/** If value is a date (by field type or shape), return formatted string; else null. Use at display sites. */
export function formatDateIfApplicable(
  value: unknown,
  fieldType?: string
): string | null {
  if (fieldType === "date") {
    const s = formatDate(value);
    return s === "—" ? null : s;
  }
  const date = toDate(value);
  if (!date) return null;
  return date.toLocaleDateString("en-US", DATE_DISPLAY_OPTIONS);
}
