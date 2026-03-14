/**
 * Format entity data as "field: value" lines for LLM context (Ask AI).
 * Supports field labels, and optional field types + locale for currency/date display.
 */

const CURRENCY_KEY_PATTERN = /cents|price|amount|goal|donation|suggested|total/i;

export type FormatEntityContextOptions = {
  maxLength?: number;
  fieldLabels?: Record<string, string>;
  fieldTypes?: Record<string, string>;
  locale?: string;
};

export function formatEntityDataForContext(
  data: Record<string, unknown>,
  options: FormatEntityContextOptions = {}
): string {
  const { maxLength = 1200, fieldLabels = {}, fieldTypes = {}, locale } = options;
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const label = fieldLabels[key] ?? key;
    const fieldType = fieldTypes[key];
    if (value == null || value === "") {
      lines.push(`${label}: —`);
    } else if (fieldType === "date" || fieldType === "datetime") {
      const d = typeof value === "string" ? new Date(value) : (value as Date);
      const display =
        !Number.isNaN((d as Date).getTime()) && d
          ? fieldType === "date"
            ? (d as Date).toLocaleDateString(locale || undefined)
            : (d as Date).toLocaleString(locale || undefined)
          : String(value);
      lines.push(`${label}: ${String(value).slice(0, 30)} (${display})`);
    } else if (typeof value === "number" && !Number.isNaN(value) && CURRENCY_KEY_PATTERN.test(key)) {
      const display = (value / 100).toLocaleString(locale || "en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      });
      lines.push(`${label}: ${value} (${display})`);
    } else if (typeof value === "string") {
      lines.push(`${label}: ${value.trim().slice(0, 200)}`);
    } else if (typeof value === "number" && !Number.isNaN(value)) {
      lines.push(`${label}: ${value}`);
    } else if (typeof value === "boolean") {
      lines.push(`${label}: ${value ? "yes" : "no"}`);
    } else if (Array.isArray(value)) {
      const arrStr = value.map((v) => (typeof v === "string" ? v : String(v))).join(", ");
      lines.push(`${label}: ${arrStr.slice(0, 150)}`);
    } else if (typeof value === "object") {
      lines.push(`${label}: ${JSON.stringify(value).slice(0, 150)}`);
    }
  }
  const text = lines.join("\n");
  return text.slice(0, maxLength);
}
