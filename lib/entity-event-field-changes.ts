/** Max JSON length per stored before/after value on Event rows (avoids huge JSON blobs). */
const MAX_AUDIT_VALUE_JSON_CHARS = 16_384;

export type EntityEventFieldChange = { before: unknown; after: unknown };

export type EntityEventFieldChangesMap = Record<string, EntityEventFieldChange>;

function normalizeForCompare(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  const o = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) out[k] = normalizeForCompare(o[k]);
  return out;
}

export function auditValuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
}

function truncateForEventStorage(value: unknown): unknown {
  let s: string;
  try {
    s = JSON.stringify(value);
  } catch {
    s = String(value);
  }
  if (s.length <= MAX_AUDIT_VALUE_JSON_CHARS) return value;
  if (typeof value === "string") {
    return `${value.slice(0, MAX_AUDIT_VALUE_JSON_CHARS - 40)}… (truncated)`;
  }
  return `${s.slice(0, MAX_AUDIT_VALUE_JSON_CHARS - 40)}… (truncated)`;
}

/**
 * Shallow key diff: any key present in either record whose values differ (deep-compare for JSON-like values).
 */
export function computeShallowFieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): EntityEventFieldChangesMap {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: EntityEventFieldChangesMap = {};
  for (const key of keys) {
    const b = key in before ? before[key] : null;
    const a = key in after ? after[key] : null;
    if (auditValuesEqual(b, a)) continue;
    out[key] = { before: truncateForEventStorage(b ?? null), after: truncateForEventStorage(a ?? null) };
  }
  return out;
}

export function readFieldChangesFromEventData(
  data: Record<string, unknown> | null | undefined
): EntityEventFieldChangesMap | null {
  const raw = data?.fieldChanges;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as EntityEventFieldChangesMap;
}

export function readMetadataChangesFromEventData(
  data: Record<string, unknown> | null | undefined
): EntityEventFieldChangesMap | null {
  const raw = data?.metadataChanges;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as EntityEventFieldChangesMap;
}

/** One-line display for activity UI */
export function formatAuditScalarForDisplay(value: unknown, maxLen = 240): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return "—";
    return t.length > maxLen ? `${t.slice(0, maxLen - 1)}…` : t;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const s = JSON.stringify(value);
    return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
  } catch {
    return String(value);
  }
}

export type AuditRelationOption = { id: string; label: string };

/** Module context for resolving audit `fieldChanges` / `metadataChanges` to plain text (list activity column, etc.). */
export type ActivityAuditFormatContext = {
  fieldTypeBySlug: Record<string, string>;
  relationOptionsBySlug?: Record<string, AuditRelationOption[]>;
  tenantUserLabels?: Record<string, string>;
};

/** Multi-line summary of record/metadata diffs on an event (compact lines for list activity column and entity activity rail). */
export function formatEventDataChangesPlainText(
  data: Record<string, unknown> | null | undefined,
  ctx: ActivityAuditFormatContext
): string {
  const fieldChanges = readFieldChangesFromEventData(data);
  const metadataChanges = readMetadataChangesFromEventData(data);
  const lines: string[] = [];
  if (fieldChanges && Object.keys(fieldChanges).length > 0) {
    for (const key of Object.keys(fieldChanges).sort()) {
      const row = fieldChanges[key]!;
      const before = formatFieldAuditValueForDisplay(
        key,
        row.before,
        ctx.fieldTypeBySlug,
        ctx.relationOptionsBySlug ?? null,
        ctx.tenantUserLabels ?? null
      );
      const after = formatFieldAuditValueForDisplay(
        key,
        row.after,
        ctx.fieldTypeBySlug,
        ctx.relationOptionsBySlug ?? null,
        ctx.tenantUserLabels ?? null
      );
      lines.push(`${key}: ${before} → ${after}`);
    }
  }
  if (metadataChanges && Object.keys(metadataChanges).length > 0) {
    for (const key of Object.keys(metadataChanges).sort()) {
      const row = metadataChanges[key]!;
      lines.push(
        `${key}: ${formatAuditScalarForDisplay(row.before)} → ${formatAuditScalarForDisplay(row.after)}`
      );
    }
  }
  return lines.join("\n");
}

/** Resolve relation / relation-multi stored ids to labels when module context is available. */
export function formatFieldAuditValueForDisplay(
  fieldSlug: string,
  value: unknown,
  fieldTypeBySlug: Record<string, string> | null | undefined,
  relationOptionsBySlug: Record<string, AuditRelationOption[]> | null | undefined,
  tenantUserLabels?: Record<string, string> | null
): string {
  const ft = fieldTypeBySlug?.[fieldSlug];
  const opts = relationOptionsBySlug?.[fieldSlug] ?? [];
  if (ft === "activity") return "—";
  if (ft === "tenant-user") {
    if (value === null || value === undefined) return formatAuditScalarForDisplay(value);
    if (typeof value === "string") {
      const t = value.trim();
      if (!t) return "—";
      const label = tenantUserLabels?.[t];
      return label ? formatAuditScalarForDisplay(label) : formatAuditScalarForDisplay(value);
    }
    return formatAuditScalarForDisplay(value);
  }
  if (ft === "relation") {
    if (value === null || value === undefined) return formatAuditScalarForDisplay(value);
    if (typeof value === "string") {
      const t = value.trim();
      if (!t) return "—";
      const hit = opts.find((o) => o.id === t);
      return hit ? formatAuditScalarForDisplay(hit.label) : formatAuditScalarForDisplay(value);
    }
    return formatAuditScalarForDisplay(value);
  }
  if (ft === "relation-multi") {
    if (value === null || value === undefined) return formatAuditScalarForDisplay(value);
    if (!Array.isArray(value)) return formatAuditScalarForDisplay(value);
    const parts = value.map((v) => {
      if (typeof v !== "string") return formatAuditScalarForDisplay(v);
      const t = v.trim();
      if (!t) return "—";
      const hit = opts.find((o) => o.id === t);
      return hit ? hit.label : t;
    });
    return formatAuditScalarForDisplay(parts.join(", "));
  }
  return formatAuditScalarForDisplay(value);
}
