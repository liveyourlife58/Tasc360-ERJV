import type { CSSProperties } from "react";
import { addCalendarDaysToYmd, isDeadlineDateOverdue, parseEntityDateYmd } from "@/lib/deadline-field";
import { calendarYmdNowInTimeZone, DEFAULT_TENANT_TIME_ZONE } from "@/lib/tenant-timezone";

/** Named palette slots (color-associated, not status). Mapped in globals.css when `colors` is not set. */
export const HIGHLIGHT_TONES = ["blue", "green", "amber", "red", "gray"] as const;
export type HighlightTone = (typeof HIGHLIGHT_TONES)[number];

/** Legacy semantic `variant` strings still accepted when reading/saving rules. */
const LEGACY_VARIANT_TO_TONE: Record<string, HighlightTone> = {
  info: "blue",
  success: "green",
  warning: "amber",
  danger: "red",
  neutral: "gray",
};

const TONE_SET: ReadonlySet<string> = new Set(HIGHLIGHT_TONES);

/** Normalize JSON `variant` to a tone, including legacy info/success/warning/danger/neutral. */
export function normalizeHighlightTone(raw: string): HighlightTone | null {
  const v = raw.trim();
  if (TONE_SET.has(v)) return v as HighlightTone;
  return LEGACY_VARIANT_TO_TONE[v] ?? null;
}

/** Optional per-rule palette (hex or `transparent`). Sets CSS variables on `.field-highlight`. */
export type HighlightRuleColors = {
  background?: string;
  accent?: string;
};

export type HighlightWhen =
  | { op: "equals"; value: string | number | boolean }
  | { op: "oneOf"; values: (string | number | boolean)[] }
  | { op: "contains"; value: string; caseSensitive?: boolean }
  | { op: "empty" }
  | { op: "nonEmpty" }
  | { op: "gt" | "gte" | "lt" | "lte"; value: number }
  | { op: "between"; min: number; max: number }
  | { op: "betweenDates"; min: string; max: string }
  | { op: "before"; value: string }
  | { op: "after"; value: string }
  /** Date only: stored calendar date is before today in tenant timezone; empty dates do not match. */
  | { op: "deadlinePassed" }
  /** Date only: empty or date is today or later in tenant timezone. */
  | { op: "deadlineNotPassed" }
  /** Date only: stored calendar date equals today in tenant timezone; empty does not match. */
  | { op: "deadlineDueToday" }
  /**
   * Date only: non-empty stored `YYYY-MM-DD` is on or before **today + days** (calendar, tenant “today”).
   * Same cutoff as list priority when this field’s `settings.deadlineListDaysAhead` equals `days` (0 = today or overdue).
   */
  | { op: "deadlineDueWithinDays"; days: number }
  | { op: "isTrue" }
  | { op: "isFalse" };

export type HighlightRule = {
  when: HighlightWhen;
  /** Preset palette when `colors` is omitted; fallback when `colors` is partial. */
  variant: HighlightTone;
  /** Evaluate `when` against this field’s value/type (same module). Omit = use the field that owns the rule. */
  whenFieldSlug?: string;
  /** If set, this rule colors these columns instead of the owning field. Omit = highlight the owning field only. */
  highlightFieldSlugs?: string[];
  /** Custom fill / bar color (validated hex or `transparent`). Overrides variant styling for set keys. */
  colors?: HighlightRuleColors;
};

/** Allow #rgb, #rrggbb, #rrggbbaa, or transparent — safe for CSS variables (no url()/expression). */
export function sanitizeHighlightColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.toLowerCase() === "transparent") return "transparent";
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t)) return t;
  return null;
}

function parseHighlightColorsFromRow(row: Record<string, unknown>): HighlightRuleColors | undefined {
  const c = row.colors;
  if (!c || typeof c !== "object" || Array.isArray(c)) return undefined;
  const o = c as Record<string, unknown>;
  const background = sanitizeHighlightColor(o.background);
  const accent = sanitizeHighlightColor(o.accent);
  if (!background && !accent) return undefined;
  const out: HighlightRuleColors = {};
  if (background) out.background = background;
  if (accent) out.accent = accent;
  return out;
}

function hasUsableColors(colors: HighlightRuleColors | undefined): boolean {
  return !!(colors && (colors.background || colors.accent));
}

/** Classes + optional inline vars for one matched rule. */
export function fieldHighlightDisplayForMatchedRule(rule: HighlightRule): { className: string; style?: CSSProperties } {
  const colors = rule.colors;
  if (hasUsableColors(colors)) {
    const style: CSSProperties = {};
    if (colors!.background) (style as Record<string, string>)["--field-hl-bg"] = colors!.background;
    if (colors!.accent) (style as Record<string, string>)["--field-hl-accent"] = colors!.accent;
    return { className: "field-highlight", style };
  }
  return { className: `field-highlight field-highlight--${rule.variant}` };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isEmptyRaw(fieldType: string, raw: unknown): boolean {
  if (raw === null || raw === undefined) return true;
  if (raw === "") return true;
  if (fieldType === "boolean") return false;
  return false;
}

function num(raw: unknown): number | null {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function matchesWhen(fieldType: string, raw: unknown, when: HighlightWhen, todayYmd: string): boolean {
  const empty = isEmptyRaw(fieldType, raw);

  switch (when.op) {
    case "empty":
      return empty;
    case "nonEmpty":
      return !empty;
    case "isTrue":
      return fieldType === "boolean" && raw === true;
    case "isFalse":
      return fieldType === "boolean" && raw === false;
    case "equals": {
      if (empty) return false;
      if (fieldType === "boolean") return raw === when.value;
      if (fieldType === "number") {
        const n = num(raw);
        return n !== null && typeof when.value === "number" && n === when.value;
      }
      return String(raw) === String(when.value);
    }
    case "oneOf": {
      if (empty) return false;
      if (fieldType === "boolean") return when.values.some((v) => v === raw);
      if (fieldType === "number") {
        const n = num(raw);
        return n !== null && when.values.some((v) => typeof v === "number" && v === n);
      }
      const s = String(raw);
      return when.values.some((v) => String(v) === s);
    }
    case "contains": {
      if (
        fieldType !== "text" &&
        fieldType !== "select" &&
        fieldType !== "tenant-user" &&
        fieldType !== "json" &&
        fieldType !== "relation" &&
        fieldType !== "file"
      ) {
        return false;
      }
      const s = String(raw ?? "");
      const sub = when.value;
      if (!sub) return false;
      return when.caseSensitive ? s.includes(sub) : s.toLowerCase().includes(sub.toLowerCase());
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (fieldType !== "number") return false;
      const n = num(raw);
      if (n === null) return false;
      const t = when.value;
      if (when.op === "gt") return n > t;
      if (when.op === "gte") return n >= t;
      if (when.op === "lt") return n < t;
      return n <= t;
    }
    case "between": {
      if (fieldType !== "number") return false;
      const n = num(raw);
      if (n === null) return false;
      return n >= when.min && n <= when.max;
    }
    case "betweenDates": {
      if (fieldType !== "date") return false;
      if (empty || typeof raw !== "string") return false;
      return raw >= when.min && raw <= when.max;
    }
    case "before": {
      if (fieldType !== "date") return false;
      if (empty || typeof raw !== "string") return false;
      return raw < when.value;
    }
    case "after": {
      if (fieldType !== "date") return false;
      if (empty || typeof raw !== "string") return false;
      return raw > when.value;
    }
    case "deadlinePassed": {
      if (fieldType !== "date") return false;
      return isDeadlineDateOverdue(raw, todayYmd);
    }
    case "deadlineNotPassed": {
      if (fieldType !== "date") return false;
      if (empty) return true;
      const ymd = parseEntityDateYmd(raw);
      if (!ymd) return true;
      return ymd >= todayYmd;
    }
    case "deadlineDueToday": {
      if (fieldType !== "date") return false;
      if (empty) return false;
      const ymd = parseEntityDateYmd(raw);
      if (!ymd) return false;
      return ymd === todayYmd;
    }
    case "deadlineDueWithinDays": {
      if (fieldType !== "date") return false;
      if (empty) return false;
      const ymd = parseEntityDateYmd(raw);
      if (!ymd) return false;
      const d = when.days;
      if (typeof d !== "number" || !Number.isFinite(d) || d < 0 || d > 3650) return false;
      const horizon = addCalendarDaysToYmd(todayYmd, d);
      return ymd <= horizon;
    }
    default:
      return false;
  }
}

function parseWhen(raw: unknown): HighlightWhen | null {
  if (!isRecord(raw) || typeof raw.op !== "string") return null;
  switch (raw.op) {
    case "equals":
      if (!("value" in raw)) return null;
      return { op: "equals", value: raw.value as string | number | boolean };
    case "oneOf":
      if (!Array.isArray(raw.values)) return null;
      return { op: "oneOf", values: raw.values as (string | number | boolean)[] };
    case "contains":
      if (typeof raw.value !== "string") return null;
      return {
        op: "contains",
        value: raw.value,
        caseSensitive: raw.caseSensitive === true,
      };
    case "empty":
      return { op: "empty" };
    case "nonEmpty":
      return { op: "nonEmpty" };
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      if (typeof raw.value !== "number" || !Number.isFinite(raw.value)) return null;
      return { op: raw.op, value: raw.value };
    case "between":
      if (typeof raw.min !== "number" || typeof raw.max !== "number") return null;
      if (!Number.isFinite(raw.min) || !Number.isFinite(raw.max)) return null;
      return { op: "between", min: raw.min, max: raw.max };
    case "betweenDates":
      if (typeof raw.min !== "string" || typeof raw.max !== "string") return null;
      return { op: "betweenDates", min: raw.min, max: raw.max };
    case "before":
    case "after":
      if (typeof raw.value !== "string") return null;
      return { op: raw.op, value: raw.value };
    case "isTrue":
      return { op: "isTrue" };
    case "isFalse":
      return { op: "isFalse" };
    case "deadlinePassed":
      return { op: "deadlinePassed" };
    case "deadlineNotPassed":
      return { op: "deadlineNotPassed" };
    case "deadlineDueToday":
      return { op: "deadlineDueToday" };
    case "deadlineDueWithinDays": {
      if (typeof raw.days !== "number" || !Number.isFinite(raw.days)) return null;
      const d = Math.floor(raw.days);
      if (d < 0 || d > 3650) return null;
      return { op: "deadlineDueWithinDays", days: d };
    }
    default:
      return null;
  }
}

function parseOptionalSlugList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const slugs = raw.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((s) => s.trim());
  return slugs.length > 0 ? slugs : undefined;
}

/** Safe parse of `settings.highlightRules` from field JSON. */
export function parseHighlightRules(settings: Record<string, unknown> | null | undefined): HighlightRule[] {
  if (!settings || !Array.isArray(settings.highlightRules)) return [];
  const out: HighlightRule[] = [];
  for (const row of settings.highlightRules) {
    if (!isRecord(row)) continue;
    const when = parseWhen(row.when);
    if (!when) continue;
    const colors = parseHighlightColorsFromRow(row);
    const tone =
      typeof row.variant === "string" ? normalizeHighlightTone(row.variant) : null;
    const variantOk = tone !== null;
    if (!variantOk && !hasUsableColors(colors)) continue;
    const variant = tone ?? "gray";
    const whenFieldSlug =
      typeof row.whenFieldSlug === "string" && row.whenFieldSlug.trim() !== ""
        ? row.whenFieldSlug.trim()
        : undefined;
    const highlightFieldSlugs = parseOptionalSlugList(row.highlightFieldSlugs);
    out.push({
      when,
      variant,
      ...(whenFieldSlug ? { whenFieldSlug } : {}),
      ...(highlightFieldSlugs ? { highlightFieldSlugs } : {}),
      ...(colors ? { colors } : {}),
    });
  }
  return out;
}

function ruleAppliesToColumn(rule: HighlightRule, ruleOwnerSlug: string, columnSlug: string): boolean {
  const targets = rule.highlightFieldSlugs;
  if (targets && targets.length > 0) return targets.includes(columnSlug);
  return ruleOwnerSlug === columnSlug;
}

/** Row context for list/table cells (same module). */
export type FieldHighlightRowContext = {
  data: Record<string, unknown>;
  fields: { slug: string; fieldType: string; settings?: Record<string, unknown> }[];
  /** IANA timezone for deadline* highlight ops (tenant `settings.timeZone`, default UTC). */
  tenantTimeZone?: string;
};

export type FieldHighlightCellDisplay = {
  className: string;
  style?: CSSProperties;
};

/**
 * First matching rule wins (module field order, then rule order).
 * Supports `whenFieldSlug`, `highlightFieldSlugs`, optional `colors` (hex / transparent), or `variant` tones.
 */
export function fieldHighlightClassNameForColumn(
  columnSlug: string,
  _columnFieldType: string,
  _columnValue: unknown,
  _columnSettings: Record<string, unknown> | null | undefined,
  ctx: FieldHighlightRowContext
): FieldHighlightCellDisplay | null {
  const tz = ctx.tenantTimeZone ?? DEFAULT_TENANT_TIME_ZONE;
  const todayYmd = calendarYmdNowInTimeZone(tz);
  const fieldTypeBySlug = Object.fromEntries(ctx.fields.map((f) => [f.slug, f.fieldType]));
  const data = ctx.data;
  for (const g of ctx.fields) {
    const rules = parseHighlightRules((g.settings ?? undefined) as Record<string, unknown> | undefined);
    for (const rule of rules) {
      if (!ruleAppliesToColumn(rule, g.slug, columnSlug)) continue;
      const whenSlug = rule.whenFieldSlug ?? g.slug;
      const whenFieldType = fieldTypeBySlug[whenSlug];
      if (!whenFieldType) continue;
      const whenValue = data[whenSlug];
      if (matchesWhen(whenFieldType, whenValue, rule.when, todayYmd)) {
        return fieldHighlightDisplayForMatchedRule(rule);
      }
    }
  }
  return null;
}

/** First matching rule wins. */
export function resolveHighlightTone(
  fieldType: string,
  value: unknown,
  rules: HighlightRule[],
  tenantTimeZone?: string
): HighlightTone | null {
  const todayYmd = calendarYmdNowInTimeZone(tenantTimeZone ?? DEFAULT_TENANT_TIME_ZONE);
  for (const r of rules) {
    if (matchesWhen(fieldType, value, r.when, todayYmd)) return r.variant;
  }
  return null;
}

/** Rules that only reference the same field’s value (no row context needed). */
function rulesWithoutCrossFieldRefs(rules: HighlightRule[]): HighlightRule[] {
  return rules.filter((r) => !r.whenFieldSlug && !(r.highlightFieldSlugs?.length));
}

/** Same-field rules only; no row context. Returns highlight classes (+ style when rule uses `colors`). */
export function fieldHighlightClassName(
  fieldType: string,
  value: unknown,
  settings: Record<string, unknown> | null | undefined,
  tenantTimeZone?: string
): string {
  const d = fieldHighlightDisplaySameField(fieldType, value, settings, tenantTimeZone);
  return d?.className ?? "";
}

/** Same-field rules only; includes inline `style` when a matched rule sets `colors`. */
export function fieldHighlightDisplaySameField(
  fieldType: string,
  value: unknown,
  settings: Record<string, unknown> | null | undefined,
  tenantTimeZone?: string
): FieldHighlightCellDisplay | null {
  const todayYmd = calendarYmdNowInTimeZone(tenantTimeZone ?? DEFAULT_TENANT_TIME_ZONE);
  const rules = rulesWithoutCrossFieldRefs(parseHighlightRules(settings ?? undefined));
  if (rules.length === 0) return null;
  for (const r of rules) {
    if (matchesWhen(fieldType, value, r.when, todayYmd)) return fieldHighlightDisplayForMatchedRule(r);
  }
  return null;
}
