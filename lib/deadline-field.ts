/**
 * Date fields can opt into `settings.deadline`. List/export ordering uses a **priority** rule on
 * each deadline-marked date vs **today’s calendar day** in the tenant IANA timezone.
 *
 * Per-field `settings.deadlineListDaysAhead` (only when `deadline === true`):
 * - **Unset / omitted:** **overdue only** — that date strictly before today.
 * - **`0`:** today or overdue (`date <= today`).
 * - **`N > 0`:** on or before today + N calendar days (UTC-safe date math), including overdue.
 *
 * Multiple deadline fields: a row is prioritized if **any** deadline field qualifies under **its own** window.
 */

import { calendarYmdNowInTimeZone, DEFAULT_TENANT_TIME_ZONE } from "@/lib/tenant-timezone";

/** Add a signed day delta to `YYYY-MM-DD` using UTC calendar math (no DST ambiguity). */
export function addCalendarDaysToYmd(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd.trim();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const y2 = dt.getUTCFullYear();
  const m2 = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(dt.getUTCDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}

/** Read `deadlineListDaysAhead` from a field’s `settings` object. `null` = overdue only. */
export function getFieldDeadlineListDaysAhead(fieldSettings: Record<string, unknown> | null | undefined): number | null {
  if (!fieldSettings) return null;
  const raw = fieldSettings.deadlineListDaysAhead;
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || n > 3650) return null;
  return Math.floor(n);
}

export type DeadlineFieldSortSpec = { slug: string; listDaysAhead: number | null };

/** All date fields (in field order) marked `settings.deadline`, with per-field list priority window. */
export function getModuleDeadlineFieldSortSpecs(
  fields: { fieldType: string; slug: string; sortOrder: number; settings: unknown }[]
): DeadlineFieldSortSpec[] {
  return fields
    .filter((f) => f.fieldType === "date")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((f) => {
      const s = (f.settings as Record<string, unknown> | null) ?? {};
      return s.deadline === true;
    })
    .map((f) => {
      const s = (f.settings as Record<string, unknown> | null) ?? {};
      return { slug: f.slug, listDaysAhead: getFieldDeadlineListDaysAhead(s) };
    });
}

export function parseEntityDateYmd(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export function isDeadlineDateOverdue(raw: unknown, todayYmd: string): boolean {
  const ymd = parseEntityDateYmd(raw);
  if (!ymd) return false;
  return ymd < todayYmd;
}

/** True if any deadline field’s date qualifies under that field’s `deadlineListDaysAhead` rule. */
export function entityHasDeadlineListPriority(
  data: Record<string, unknown>,
  deadlineSpecs: DeadlineFieldSortSpec[],
  todayYmd: string
): boolean {
  if (deadlineSpecs.length === 0) return false;
  for (const { slug, listDaysAhead } of deadlineSpecs) {
    const ymd = parseEntityDateYmd(data[slug]);
    if (!ymd) continue;
    const horizon =
      listDaysAhead === null ? null : addCalendarDaysToYmd(todayYmd, listDaysAhead);
    if (listDaysAhead === null) {
      if (ymd < todayYmd) return true;
    } else if (horizon != null && ymd <= horizon) {
      return true;
    }
  }
  return false;
}

/** Strictly before today on any deadline slug (each slug checked with overdue-only semantics). */
export function entityHasAnyOverdueDeadline(
  data: Record<string, unknown>,
  deadlineSlugs: string[],
  todayYmd: string
): boolean {
  const specs: DeadlineFieldSortSpec[] = deadlineSlugs.map((slug) => ({ slug, listDaysAhead: null }));
  return entityHasDeadlineListPriority(data, specs, todayYmd);
}

/**
 * Stable sort: rows matching any deadline field’s priority window first; preserves relative order otherwise.
 * @param tenantTimeZone IANA zone from tenant settings (defaults to UTC).
 */
export function sortEntitiesWithOverdueDeadlineFirst<T extends { id: string; data: unknown }>(
  entities: T[],
  deadlineSpecs: DeadlineFieldSortSpec[],
  tenantTimeZone: string = DEFAULT_TENANT_TIME_ZONE
): T[] {
  if (deadlineSpecs.length === 0 || entities.length === 0) return entities;
  const todayYmd = calendarYmdNowInTimeZone(tenantTimeZone);
  return [...entities].sort((a, b) => {
    const da = (a.data as Record<string, unknown>) ?? {};
    const db = (b.data as Record<string, unknown>) ?? {};
    const oa = entityHasDeadlineListPriority(da, deadlineSpecs, todayYmd) ? 1 : 0;
    const ob = entityHasDeadlineListPriority(db, deadlineSpecs, todayYmd) ? 1 : 0;
    if (oa !== ob) return ob - oa;
    return 0;
  });
}
