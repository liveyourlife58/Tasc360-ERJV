import { prisma } from "./prisma";
import type { RelationOption } from "@/components/dashboard/EntityForm";
import { getModuleEntityListCreatedAtOrder } from "./module-settings";
import { labelFromTargetEntityData, resolveRelationDisplayFieldSlug } from "./relation-display";

export async function getRelationOptions(
  tenantId: string,
  fields: { slug: string; fieldType: string; settings: unknown }[]
): Promise<Record<string, RelationOption[]>> {
  const relationFields = fields.filter(
    (f) => f.fieldType === "relation" || f.fieldType === "relation-multi"
  );
  if (relationFields.length === 0) return {};
  const targetSlugs = new Set(
    relationFields
      .map((f) => {
        const s = f.settings as Record<string, unknown> | undefined;
        return (s?.targetModule ?? s?.targetModuleSlug) as string | undefined;
      })
      .filter(Boolean)
  );
  const result: Record<string, RelationOption[]> = {};
  for (const slug of targetSlugs) {
    const mod = await prisma.module.findFirst({
      where: { tenantId, slug, isActive: true },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    });
    if (!mod) continue;
    const targetListOrder = getModuleEntityListCreatedAtOrder(mod);
    const entities = await prisma.entity.findMany({
      where: { tenantId, moduleId: mod.id, deletedAt: null },
      orderBy: { createdAt: targetListOrder },
      take: 200,
      select: { id: true, data: true },
    });
    const targetFieldList = mod.fields.map((f) => ({ slug: f.slug }));
    for (const f of relationFields) {
      const s = (f.settings as Record<string, unknown>) ?? {};
      const target = (s.targetModule ?? s.targetModuleSlug) as string | undefined;
      if (target !== slug) continue;
      const displaySlug = resolveRelationDisplayFieldSlug(s, targetFieldList);
      result[f.slug] = entities.map((e) => {
        const data = (e.data as Record<string, unknown>) ?? {};
        const label = labelFromTargetEntityData(data, displaySlug, e.id);
        return { id: e.id, label: label || e.id.slice(0, 8) };
      });
    }
  }
  return result;
}

/** Resolve related entity ids to display strings for list/table cells (per source field slug). */
export async function buildRelationLabelMaps(
  tenantId: string,
  sourceFields: { slug: string; fieldType: string; settings: unknown }[],
  entities: { data: unknown }[]
): Promise<Record<string, Record<string, string>>> {
  const relationFields = sourceFields.filter(
    (f) => f.fieldType === "relation" || f.fieldType === "relation-multi"
  );
  if (relationFields.length === 0 || entities.length === 0) return {};

  const byTarget = new Map<string, typeof relationFields>();
  const idsByTarget = new Map<string, Set<string>>();

  for (const f of relationFields) {
    const s = (f.settings as Record<string, unknown>) ?? {};
    const targetSlug = (s.targetModuleSlug ?? s.targetModule) as string | undefined;
    if (!targetSlug) continue;
    if (!byTarget.has(targetSlug)) {
      byTarget.set(targetSlug, []);
      idsByTarget.set(targetSlug, new Set());
    }
    byTarget.get(targetSlug)!.push(f);
    const idSet = idsByTarget.get(targetSlug)!;
    for (const e of entities) {
      const d = (e.data as Record<string, unknown>) ?? {};
      const v = d[f.slug];
      if (f.fieldType === "relation" && typeof v === "string" && v.trim()) idSet.add(v.trim());
      if (f.fieldType === "relation-multi" && Array.isArray(v)) {
        for (const id of v) {
          if (typeof id === "string" && id.trim()) idSet.add(id.trim());
        }
      }
    }
  }

  const out: Record<string, Record<string, string>> = {};

  for (const [targetSlug, fields] of byTarget) {
    const mod = await prisma.module.findFirst({
      where: { tenantId, slug: targetSlug, isActive: true },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    });
    if (!mod) continue;
    const targetFieldList = mod.fields.map((f) => ({ slug: f.slug }));
    const ids = [...idsByTarget.get(targetSlug)!];
    if (ids.length === 0) continue;
    const rows = await prisma.entity.findMany({
      where: { tenantId, moduleId: mod.id, id: { in: ids } },
      select: { id: true, data: true },
    });
    for (const f of fields) {
      const s = (f.settings as Record<string, unknown>) ?? {};
      const displaySlug = resolveRelationDisplayFieldSlug(s, targetFieldList);
      const map: Record<string, string> = {};
      for (const row of rows) {
        const data = (row.data as Record<string, unknown>) ?? {};
        map[row.id] = labelFromTargetEntityData(data, displaySlug, row.id);
      }
      out[f.slug] = map;
    }
  }

  return out;
}
