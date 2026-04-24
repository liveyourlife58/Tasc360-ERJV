import type { ReactNode } from "react";
import { RelationMultiCell } from "@/components/dashboard/RelationMultiCell";
import { formatDateIfApplicable } from "@/lib/format";
import { ACTIVITY_SUMMARY_EVENT_SEPARATOR } from "@/lib/activity-summary-constants";

/** One event block: first line (headline) + remainder (timestamp / change lines) — matches list activity cells. */
export function ActivityEventSummaryDisplay({
  text,
  title,
}: {
  text: string;
  /** e.g. full multi-event string for tooltip on list cells */
  title?: string;
}): ReactNode {
  const nl = text.indexOf("\n");
  const headline = nl === -1 ? text : text.slice(0, nl);
  const rest = nl === -1 ? null : text.slice(nl + 1);
  return (
    <span style={{ fontSize: "0.8125rem", color: "#475569" }} title={title}>
      <span style={{ display: "block", lineHeight: 1.35 }}>{headline}</span>
      {rest ? (
        <span
          style={{
            display: "block",
            color: "#94a3b8",
            fontSize: "0.75rem",
            marginTop: "0.15rem",
            lineHeight: 1.35,
            whiteSpace: "pre-line",
          }}
        >
          {rest}
        </span>
      ) : null}
    </span>
  );
}

export type EntityFieldDef = {
  id: string;
  name: string;
  slug: string;
  fieldType: string;
  settings?: Record<string, unknown>;
};

export type EntityForFieldDisplay = {
  id: string;
  data: Record<string, unknown> | unknown;
  metadata?: unknown;
  orderLines?: { quantity: number }[];
};

/**
 * Kanban cards omit lines that would only show a placeholder (—, “No activity yet.”, etc.).
 * List/table views still use {@link formatEntityFieldValue} as-is.
 */
export function isEntityFieldEmptyForBoardCard(
  value: unknown,
  field: EntityFieldDef,
  entity: EntityForFieldDisplay,
  activityCellSummaries?: Record<string, Record<string, string>>
): boolean {
  if (field.fieldType === "activity") {
    const full = activityCellSummaries?.[entity.id]?.[field.slug];
    if (!full) return true;
    if (full === "No activity yet.") return true;
    return false;
  }
  if (value == null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/** Shared list / board cell formatting for entity field values. */
export function formatEntityFieldValue(
  value: unknown,
  field: EntityFieldDef,
  entity: EntityForFieldDisplay,
  relationLabels?: Record<string, Record<string, string>>,
  tenantUserLabels?: Record<string, string>,
  tenantLocale?: string,
  tenantTimeZone?: string,
  activityCellSummaries?: Record<string, Record<string, string>>
): ReactNode {
  if (field.fieldType === "activity") {
    const full = activityCellSummaries?.[entity.id]?.[field.slug];
    if (!full) return <span style={{ color: "#94a3b8" }}>—</span>;
    if (full === "No activity yet.") {
      return <span style={{ color: "#64748b", fontSize: "0.8125rem" }}>No activity yet.</span>;
    }
    const eventChunks = full.includes(ACTIVITY_SUMMARY_EVENT_SEPARATOR)
      ? full.split(ACTIVITY_SUMMARY_EVENT_SEPARATOR).filter((c) => c.length > 0)
      : [full];
    const firstChunk = eventChunks[0] ?? "";
    const hasMoreEvents = eventChunks.length > 1;
    return (
      <>
        <ActivityEventSummaryDisplay text={firstChunk} title={full} />
        {hasMoreEvents ? <span style={{ color: "#94a3b8", fontSize: "0.8125rem" }}> …</span> : null}
      </>
    );
  }
  if (value == null) return "—";
  if (field.fieldType === "tenant-user" && typeof value === "string" && value.trim() !== "") {
    const label = tenantUserLabels?.[value];
    if (label) return label;
    return value;
  }
  if (field.fieldType === "relation" && typeof value === "string" && value.trim() !== "") {
    const map = relationLabels?.[field.slug];
    if (map?.[value]) return map[value];
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (field.fieldType === "relation-multi") {
      const targetSlug =
        (field.settings?.targetModuleSlug ?? field.settings?.targetModule) as string | undefined;
      if (targetSlug) {
        return (
          <RelationMultiCell
            entityIds={value as string[]}
            targetModuleSlug={targetSlug}
            fieldName={field.name}
            labelById={relationLabels?.[field.slug]}
          />
        );
      }
      return `${value.length} selected`;
    }
    return value.join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const dateStr = formatDateIfApplicable(value, field.fieldType, tenantLocale, tenantTimeZone);
  if (dateStr !== null) return dateStr;
  if (field.fieldType === "file" && typeof value === "string" && value.trim() !== "") {
    const url = value.trim();
    if (url.startsWith("http") || url.startsWith("//"))
      return <img src={url} alt="" className="entity-list-cell-image" />;
    return url;
  }
  return String(value);
}
