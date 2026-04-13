/** Read-only field type: shows recent audit events on the entity form (not stored in `entity.data`). */

import { prisma } from "@/lib/prisma";
import { formatEntityEventActorLabel } from "@/lib/entity-event-actor";

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

/**
 * Load multi-line activity summaries for many entities (list cards, relation modal).
 * Map: entityId → field slug → summary text (newline-separated lines).
 */
export async function loadActivitySummariesForEntities(
  tenantId: string,
  entityIds: string[],
  activityFields: { slug: string; settings: unknown }[]
): Promise<Map<string, Record<string, string>>> {
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
                .map((ev) => {
                  const actor = formatEntityEventActorLabel(
                    ev.data as Record<string, unknown> | null,
                    ev.createdByUser
                  );
                  const when = ev.createdAt.toISOString();
                  return `${ev.eventType.replace(/_/g, " ")} · ${actor} · ${when}`;
                })
                .join("\n");
      }
      out.set(entityId, bySlug);
    })
  );

  return out;
}
