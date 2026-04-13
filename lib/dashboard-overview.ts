import type { PrismaClient } from "@prisma/client";
import { entityHasDeadlineListPriority, getModuleDeadlineFieldSortSpecs } from "@/lib/deadline-field";
import { calendarYmdNowInTimeZone } from "@/lib/tenant-timezone";

export type DeadlineAttentionRow = {
  moduleSlug: string;
  moduleName: string;
  entityId: string;
  title: string;
};

type ModuleWithFields = {
  id: string;
  name: string;
  slug: string;
  fields: { slug: string; fieldType: string; sortOrder: number; settings: unknown }[];
};

/**
 * Records that match the same deadline list-priority rule as the module list (any deadline field on the row).
 * Scans recent entities per module (by `updatedAt`); not exhaustive.
 */
export async function fetchDeadlineAttentionRows(
  prisma: PrismaClient,
  params: {
    tenantId: string;
    modules: ModuleWithFields[];
    tenantTimeZone: string;
    maxItems?: number;
    maxEntitiesPerModule?: number;
  }
): Promise<DeadlineAttentionRow[]> {
  const maxItems = params.maxItems ?? 8;
  const maxEntitiesPerModule = params.maxEntitiesPerModule ?? 100;
  const todayYmd = calendarYmdNowInTimeZone(params.tenantTimeZone);
  const out: DeadlineAttentionRow[] = [];

  const withSpecs = params.modules
    .map((mod) => ({ mod, specs: getModuleDeadlineFieldSortSpecs(mod.fields) }))
    .filter((x) => x.specs.length > 0);

  const loaded = await Promise.all(
    withSpecs.map(({ mod, specs }) =>
      prisma.entity
        .findMany({
          where: { tenantId: params.tenantId, moduleId: mod.id, deletedAt: null },
          select: { id: true, data: true },
          take: maxEntitiesPerModule,
          orderBy: { updatedAt: "desc" },
        })
        .then((entities) => ({ mod, specs, entities }))
    )
  );

  const orderIndex = new Map(params.modules.map((m, i) => [m.id, i]));
  loaded.sort((a, b) => (orderIndex.get(a.mod.id) ?? 0) - (orderIndex.get(b.mod.id) ?? 0));

  for (const { mod, specs, entities } of loaded) {
    const firstSlug = mod.fields[0]?.slug ?? "name";
    for (const e of entities) {
      const data = (e.data as Record<string, unknown>) ?? {};
      if (!entityHasDeadlineListPriority(data, specs, todayYmd)) continue;
      const title = String(data[firstSlug] ?? data.name ?? data.title ?? e.id.slice(0, 8)).slice(0, 100);
      out.push({ moduleSlug: mod.slug, moduleName: mod.name, entityId: e.id, title });
      if (out.length >= maxItems) return out;
    }
  }

  return out;
}
