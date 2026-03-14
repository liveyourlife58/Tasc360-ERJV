/**
 * Build denormalized search_text for an entity so FTS and embeddings can match
 * module name and field names (e.g. "customer" for Customer module, "name", "email").
 * Use when creating or updating entities.
 */
const MAX_LENGTH = 10000;

function stringifyValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.map(stringifyValue).filter(Boolean).join(" ");
  return "";
}

export function buildSearchText(
  moduleName: string | null | undefined,
  data: Record<string, unknown>
): string {
  const parts: string[] = [];
  if (moduleName && typeof moduleName === "string" && moduleName.trim()) {
    parts.push(moduleName.trim());
  }
  for (const [key, value] of Object.entries(data)) {
    const s = stringifyValue(value);
    if (s) {
      parts.push(key);
      parts.push(s);
    }
  }
  const text = parts.join(" ").trim();
  return text.slice(0, MAX_LENGTH) || "";
}
