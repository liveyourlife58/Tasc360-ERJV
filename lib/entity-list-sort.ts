import { sortEntitiesWithOverdueDeadlineFirst, type DeadlineFieldSortSpec } from "@/lib/deadline-field";
import { compareSortValues, getEntitySortValue } from "@/lib/view-utils";
import {
  getEffectivePaymentType,
  getEntityPriceCents,
  getEntitySuggestedDonationCents,
} from "@/lib/module-settings";

/** Synthetic slug for the optional Price / Donation column on module lists. */
export const LIST_SORT_PRICE_SLUG = "__price__";

export type ListColumnSort = { field: string; dir: "asc" | "desc" };

/** Next.js 15+ may pass `string | string[]` for a query key. */
export function firstSearchParamValue(v: string | string[] | undefined | null): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function parseListColumnSortParams(
  sortFieldRaw: string | string[] | null | undefined,
  sortDirRaw: string | string[] | null | undefined,
  opts: {
    columnSlugs: string[];
    fields: { slug: string; fieldType: string }[];
    showAmountColumn: boolean;
  }
): ListColumnSort | null {
  const sortField = (firstSearchParamValue(sortFieldRaw ?? undefined) ?? "").trim();
  const dirRaw = firstSearchParamValue(sortDirRaw ?? undefined) ?? "";
  const dir = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : null;
  if (!sortField || !dir) return null;
  if (sortField === LIST_SORT_PRICE_SLUG) {
    return opts.showAmountColumn ? { field: sortField, dir } : null;
  }
  if (!opts.columnSlugs.includes(sortField)) return null;
  const f = opts.fields.find((x) => x.slug === sortField);
  if (!f || f.fieldType === "activity") return null;
  return { field: sortField, dir };
}

export function getListColumnSortValue(
  entity: { id: string; data: unknown; createdAt?: Date; metadata?: unknown },
  fieldSlug: string,
  module: { settings?: unknown } | null | undefined,
  fieldTypeHint?: string
): unknown {
  if (fieldSlug === LIST_SORT_PRICE_SLUG) {
    const t = getEffectivePaymentType(entity, module ?? null);
    if (t === "payment") {
      const c = getEntityPriceCents(entity);
      return c != null ? c : null;
    }
    if (t === "donation") {
      const c = getEntitySuggestedDonationCents(entity);
      return c != null ? c : null;
    }
    return null;
  }
  const raw = getEntitySortValue(entity, fieldSlug);
  if (fieldTypeHint === "number") {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "") {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  if (fieldTypeHint === "date" || fieldTypeHint === "datetime") {
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
    if (typeof raw === "string" && raw.trim() !== "") {
      const t = Date.parse(raw);
      if (!Number.isNaN(t)) return new Date(t);
    }
  }
  return raw;
}

/**
 * Applies deadline-priority ordering, then optional single-column list sort
 * (URL-driven) with stable tie-breakers (createdAt desc, id).
 */
export function sortEntitiesForModuleList<
  T extends { id: string; data: unknown; createdAt?: Date; metadata?: unknown },
>(
  entities: T[],
  deadlineSpecs: DeadlineFieldSortSpec[],
  tenantTimeZone: string,
  columnSort: ListColumnSort | null,
  module: { settings?: unknown } | null | undefined,
  /** Used to coerce JSON values for correct numeric/date ordering. */
  fields?: { slug: string; fieldType: string }[]
): T[] {
  if (entities.length === 0) return entities;
  if (!columnSort) {
    return sortEntitiesWithOverdueDeadlineFirst(entities, deadlineSpecs, tenantTimeZone) as T[];
  }
  const fieldTypeHint = fields?.find((f) => f.slug === columnSort.field)?.fieldType;
  return [...entities].sort((a, b) => {
    const av = getListColumnSortValue(a, columnSort.field, module, fieldTypeHint);
    const bv = getListColumnSortValue(b, columnSort.field, module, fieldTypeHint);
    const cmp = compareSortValues(av, bv);
    if (cmp !== 0) return columnSort.dir === "desc" ? -cmp : cmp;
    const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    if (ta !== tb) return tb - ta;
    return String(a.id).localeCompare(String(b.id));
  });
}
