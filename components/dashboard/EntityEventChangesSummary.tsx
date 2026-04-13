import type { AuditRelationOption } from "@/lib/entity-event-field-changes";
import {
  formatAuditScalarForDisplay,
  formatFieldAuditValueForDisplay,
  readFieldChangesFromEventData,
  readMetadataChangesFromEventData,
} from "@/lib/entity-event-field-changes";

function ChangesBlock({
  title,
  changes,
  formatValue,
}: {
  title: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  formatValue: (fieldSlug: string, value: unknown) => string;
}) {
  const keys = Object.keys(changes);
  if (keys.length === 0) return null;
  return (
    <div style={{ marginTop: "0.35rem" }}>
      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.2rem" }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8125rem", color: "#475569" }}>
        {keys.map((key) => {
          const row = changes[key];
          return (
            <li key={key} style={{ marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 600, color: "#334155" }}>{key}</span>
              {": "}
              <span style={{ color: "#64748b" }}>{formatValue(key, row.before)}</span>
              {" → "}
              <span style={{ color: "#0f172a" }}>{formatValue(key, row.after)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Renders before/after field maps stored on Event.data (entity_updated). */
export function EntityEventChangesSummary({
  data,
  fieldTypeBySlug,
  relationOptionsBySlug,
  tenantUserLabels,
}: {
  data: Record<string, unknown> | null | undefined;
  /** When set with relationOptionsBySlug, relation fields show labels instead of raw ids. */
  fieldTypeBySlug?: Record<string, string>;
  relationOptionsBySlug?: Record<string, AuditRelationOption[]>;
  tenantUserLabels?: Record<string, string>;
}) {
  const fieldChanges = readFieldChangesFromEventData(data ?? null);
  const metadataChanges = readMetadataChangesFromEventData(data ?? null);
  if (!fieldChanges && !metadataChanges) return null;
  const formatRecordField = (slug: string, value: unknown) =>
    formatFieldAuditValueForDisplay(
      slug,
      value,
      fieldTypeBySlug ?? null,
      relationOptionsBySlug ?? null,
      tenantUserLabels ?? null
    );
  return (
    <div style={{ marginTop: "0.35rem", paddingLeft: "0.15rem" }}>
      {fieldChanges && Object.keys(fieldChanges).length > 0 ? (
        <ChangesBlock title="Record fields" changes={fieldChanges} formatValue={formatRecordField} />
      ) : null}
      {metadataChanges && Object.keys(metadataChanges).length > 0 ? (
        <ChangesBlock
          title="Metadata"
          changes={metadataChanges}
          formatValue={(_slug, value) => formatAuditScalarForDisplay(value)}
        />
      ) : null}
    </div>
  );
}
