import type { FilterCondition } from "./view-utils";

export const LIST_DATA_FILTERS_QUERY_KEY = "df";
export const MAX_LIST_DATA_FILTERS = 10;
const MAX_DF_JSON_CHARS = 8192;

const FILTERABLE_TYPES = new Set([
  "text",
  "number",
  "boolean",
  "date",
  "datetime",
  "select",
  "tenant-user",
  "relation",
]);

const OPS_BY_TYPE: Record<string, readonly FilterCondition["op"][]> = {
  text: ["contains", "eq", "neq", "empty"],
  number: ["eq", "neq", "gt", "lt", "gte", "lte", "empty"],
  boolean: ["eq", "empty"],
  date: ["eq", "neq", "gt", "lt", "gte", "lte", "empty"],
  datetime: ["eq", "neq", "gt", "lt", "gte", "lte", "empty"],
  select: ["eq", "neq", "empty"],
  "tenant-user": ["eq", "neq", "contains", "empty"],
  relation: ["eq", "neq", "contains", "empty"],
};

export type ListDataFilterFieldMeta = {
  slug: string;
  name: string;
  fieldType: string;
  options?: { value: string; label: string }[];
};

export function opsForListDataFieldType(fieldType: string): FilterCondition["op"][] {
  const o = OPS_BY_TYPE[fieldType];
  return o ? [...o] : [];
}

function isAllowedOp(fieldType: string, op: string): op is FilterCondition["op"] {
  return (OPS_BY_TYPE[fieldType] as readonly string[] | undefined)?.includes(op) ?? false;
}

export function buildListDataFilterFieldMetas(
  moduleFields: Array<{ slug: string; name: string; fieldType: string; settings: unknown }>,
  relationOptionsBySlug: Record<string, { id: string; label: string }[]>,
  tenantUserOptions: { id: string; label: string }[]
): ListDataFilterFieldMeta[] {
  const out: ListDataFilterFieldMeta[] = [];
  for (const f of moduleFields) {
    if (!FILTERABLE_TYPES.has(f.fieldType)) continue;
    const base: ListDataFilterFieldMeta = { slug: f.slug, name: f.name, fieldType: f.fieldType };
    if (f.fieldType === "select") {
      const st = (f.settings as Record<string, unknown>) ?? {};
      const opts = Array.isArray(st.options)
        ? (st.options as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
      base.options = opts.map((value) => ({ value, label: value }));
    } else if (f.fieldType === "relation") {
      base.options = (relationOptionsBySlug[f.slug] ?? []).map((o) => ({
        value: o.id,
        label: o.label,
      }));
    } else if (f.fieldType === "tenant-user") {
      base.options = tenantUserOptions.map((o) => ({ value: o.id, label: o.label }));
    }
    out.push(base);
  }
  return out;
}

export function parseListDataFiltersParam(
  raw: string | undefined,
  fields: { slug: string; fieldType: string }[]
): FilterCondition[] {
  if (!raw?.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.length > MAX_DF_JSON_CHARS) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const bySlug = new Map(fields.map((x) => [x.slug, x]));
  const out: FilterCondition[] = [];
  for (const item of arr.slice(0, MAX_LIST_DATA_FILTERS)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const field = typeof o.field === "string" ? o.field.trim() : "";
    const opRaw = typeof o.op === "string" ? o.op.trim() : "";
    if (!field || !opRaw) continue;
    const fd = bySlug.get(field);
    if (!fd || !FILTERABLE_TYPES.has(fd.fieldType)) continue;
    if (!isAllowedOp(fd.fieldType, opRaw)) continue;
    const op = opRaw as FilterCondition["op"];
    if (op === "empty") {
      out.push({ field, op: "empty", value: undefined });
      continue;
    }
    let value: unknown = o.value;
    if (fd.fieldType === "number") {
      if (typeof value === "string") {
        const n = Number(value.trim());
        value = Number.isFinite(n) ? n : value;
      }
    }
    if (fd.fieldType === "boolean") {
      if (value === true || value === "true") value = true;
      else if (value === false || value === "false") value = false;
      else continue;
    }
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out.push({ field, op, value });
  }
  return out;
}

export function stringifyListDataFilters(conditions: FilterCondition[]): string {
  return JSON.stringify(conditions);
}
