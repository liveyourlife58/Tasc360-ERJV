/** Read-only field type: shows recent audit events on the entity form (not stored in `entity.data`). */

import { prisma } from "@/lib/prisma";
import { formatEntityEventActorLabel } from "@/lib/entity-event-actor";
import { formatDateTime } from "@/lib/format";
import { ACTIVITY_SUMMARY_EVENT_SEPARATOR } from "@/lib/activity-summary-constants";
import {
  type ActivityAuditFormatContext,
  formatEventDataChangesPlainText,
} from "@/lib/entity-event-field-changes";

export type { ActivityAuditFormatContext } from "@/lib/entity-event-field-changes";

function resolveActivityAuditFormat(
  auditFormat:
    | ActivityAuditFormatContext
    | ((entityId: string) => ActivityAuditFormatContext | undefined)
    | undefined,
  entityId: string
): ActivityAuditFormatContext | undefined {
  if (!auditFormat) return undefined;
  return typeof auditFormat === "function" ? auditFormat(entityId) : auditFormat;
}

export const ACTIVITY_FIELD_DEFAULT_PREVIEW_LIMIT = 10;
export const ACTIVITY_FIELD_MAX_PREVIEW_LIMIT = 50;

export function getActivityPreviewLimit(settings: unknown): number {
  const s =
    settings && typeof settings === "object" && !Array.isArray(settings)
      ? (settings as Record<string, unknown>)
      : {};
  const raw = s.activityLimit;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return ACTIVITY_FIELD_DEFAULT_PREVIEW_LIMIT;
  return Math.min(ACTIVITY_FIELD_MAX_PREVIEW_LIMIT, Math.max(1, Math.floor(n)));
}

export function stripActivityFieldValues(
  data: Record<string, unknown>,
  fields: { slug: string; fieldType: string }[]
): void {
  for (const f of fields) {
    if (f.fieldType === "activity") delete data[f.slug];
  }
}

/** One row from `event` in the same shape as each block in {@link loadActivitySummariesForEntities}. */
export type ActivityEventSummaryInput = {
  eventType: string;
  createdAt: Date;
  data: unknown;
  createdByUser: { email: string; name: string | null } | null;
};

/**
 * Plain-text summary for one audit event — must stay in sync with
 * {@link loadActivitySummariesForEntities} (list/board activity cells).
 */
export function summarizeActivityEventForListCell(
  ev: ActivityEventSummaryInput,
  auditCtx: ActivityAuditFormatContext | undefined,
  formatOptions?: { locale?: string; timeZone?: string }
): string {
  const locale = formatOptions?.locale;
  const timeZone = formatOptions?.timeZone;
  const actor = formatEntityEventActorLabel(ev.data as Record<string, unknown> | null, ev.createdByUser);
  const headline = `${ev.eventType.replace(/_/g, " ")} · ${actor}`;
  const when = formatDateTime(ev.createdAt, locale, timeZone);
  const changesPlain = auditCtx
    ? formatEventDataChangesPlainText(ev.data as Record<string, unknown> | null, auditCtx)
    : "";
  if (changesPlain) {
    return `${actor} · ${when}\n${changesPlain}`;
  }
  return `${headline}\n${when}`;
}

/**
 * Load multi-line activity summaries for many entities (list cards, relation modal).
 * Map: entityId → field slug → summary text (newline-separated lines).
 */
export async function loadActivitySummariesForEntities(
  tenantId: string,
  entityIds: string[],
  activityFields: { slug: string; settings: unknown }[],
  formatOptions?: { locale?: string; timeZone?: string },
  auditFormat?: ActivityAuditFormatContext | ((entityId: string) => ActivityAuditFormatContext | undefined)
): Promise<Map<string, Record<string, string>>> {
  const locale = formatOptions?.locale;
  const timeZone = formatOptions?.timeZone;
  const out = new Map<string, Record<string, string>>();
  const ids = [...new Set(entityIds.filter((id) => typeof id === "string" && id.trim()))];
  const uniqFields = [...new Map(activityFields.map((f) => [f.slug, f])).values()];
  if (uniqFields.length === 0 || ids.length === 0) return out;

  const maxFetch = Math.max(
    ACTIVITY_FIELD_DEFAULT_PREVIEW_LIMIT,
    ...uniqFields.map((f) => getActivityPreviewLimit(f.settings))
  );

  await Promise.all(
    ids.map(async (entityId) => {
      const auditCtx = resolveActivityAuditFormat(auditFormat, entityId);
      const events = await prisma.event.findMany({
        where: { tenantId, entityId },
        orderBy: { createdAt: "desc" },
        take: maxFetch,
        select: {
          eventType: true,
          createdAt: true,
          data: true,
          createdByUser: { select: { email: true, name: true } },
        },
      });
      const bySlug: Record<string, string> = {};
      for (const af of uniqFields) {
        const lim = getActivityPreviewLimit(af.settings);
        const slice = events.slice(0, lim);
        bySlug[af.slug] =
          slice.length === 0
            ? "No activity yet."
            : slice
                .map((ev) =>
                  summarizeActivityEventForListCell(ev, auditCtx, { locale, timeZone })
                )
                .join(ACTIVITY_SUMMARY_EVENT_SEPARATOR);
      }
      out.set(entityId, bySlug);
    })
  );

  return out;
}
