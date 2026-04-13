import { prisma } from "./prisma";
import type { RelationOption } from "@/components/dashboard/EntityForm";
import { getModuleEntityListCreatedAtOrder } from "./module-settings";
import { labelFromTargetEntityData, resolveRelationDisplayFieldSlug } from "./relation-display";
import { readFieldChangesFromEventData, readMetadataChangesFromEventData } from "./entity-event-field-changes";

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

function collectRelationIdsFromEventAuditPayload(
  data: unknown,
  relationFields: { slug: string; fieldType: string; settings: unknown }[]
): Map<string, Set<string>> {
  const idsByTarget = new Map<string, Set<string>>();
  const d = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
  if (!d) return idsByTarget;
  const fc = readFieldChangesFromEventData(d);
  const mc = readMetadataChangesFromEventData(d);
  const rowFor = (slug: string) => fc?.[slug] ?? mc?.[slug];

  for (const f of relationFields) {
    const row = rowFor(f.slug);
    if (!row) continue;
    const s = (f.settings as Record<string, unknown>) ?? {};
    const targetSlug = (s.targetModuleSlug ?? s.targetModule) as string | undefined;
    if (!targetSlug) continue;
    if (!idsByTarget.has(targetSlug)) idsByTarget.set(targetSlug, new Set());
    const set = idsByTarget.get(targetSlug)!;
    const add = (v: unknown) => {
      if (f.fieldType === "relation" && typeof v === "string" && v.trim()) set.add(v.trim());
      if (f.fieldType === "relation-multi" && Array.isArray(v)) {
        for (const id of v) {
          if (typeof id === "string" && id.trim()) set.add(id.trim());
        }
      }
    };
    add(row.before);
    add(row.after);
  }
  return idsByTarget;
}

/**
 * Resolve relation / relation-multi ids referenced in entity audit events to display labels.
 * Loads entities by id (not limited to the first 200 list options) and includes soft-deleted targets.
 */
export async function fetchRelationDisplayLabelsForAuditEvents(
  tenantId: string,
  moduleFields: { slug: string; fieldType: string; settings: unknown }[],
  eventDataList: unknown[]
): Promise<Record<string, Record<string, string>>> {
  const relationFields = moduleFields.filter(
    (f) => f.fieldType === "relation" || f.fieldType === "relation-multi"
  );
  if (relationFields.length === 0 || eventDataList.length === 0) return {};

  const mergedIdsByTarget = new Map<string, Set<string>>();
  for (const data of eventDataList) {
    const partial = collectRelationIdsFromEventAuditPayload(data, relationFields);
    for (const [target, set] of partial) {
      if (!mergedIdsByTarget.has(target)) mergedIdsByTarget.set(target, new Set());
      for (const id of set) mergedIdsByTarget.get(target)!.add(id);
    }
  }

  const fieldsByTarget = new Map<string, typeof relationFields>();
  for (const f of relationFields) {
    const s = (f.settings as Record<string, unknown>) ?? {};
    const targetSlug = (s.targetModuleSlug ?? s.targetModule) as string | undefined;
    if (!targetSlug) continue;
    if (!fieldsByTarget.has(targetSlug)) fieldsByTarget.set(targetSlug, []);
    fieldsByTarget.get(targetSlug)!.push(f);
  }

  const out: Record<string, Record<string, string>> = {};

  for (const [targetSlug, idSet] of mergedIdsByTarget) {
    const ids = [...idSet];
    if (ids.length === 0) continue;
    const mod = await prisma.module.findFirst({
      where: { tenantId, slug: targetSlug, isActive: true },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    });
    if (!mod) continue;
    const targetFieldList = mod.fields.map((fld) => ({ slug: fld.slug }));
    const rows = await prisma.entity.findMany({
      where: { tenantId, moduleId: mod.id, id: { in: ids } },
      select: { id: true, data: true, deletedAt: true },
    });
    const fields = fieldsByTarget.get(targetSlug) ?? [];
    for (const f of fields) {
      const s = (f.settings as Record<string, unknown>) ?? {};
      const displaySlug = resolveRelationDisplayFieldSlug(s, targetFieldList);
      if (!out[f.slug]) out[f.slug] = {};
      for (const row of rows) {
        const rowData = (row.data as Record<string, unknown>) ?? {};
        let label = labelFromTargetEntityData(rowData, displaySlug, row.id);
        if (row.deletedAt) label = `${label} (deleted)`;
        out[f.slug][row.id] = label;
      }
    }
  }

  return out;
}

/** Merge audit-resolved labels into relation picklists so activity UI can show names for ids outside the capped list. */
export function mergeRelationOptionsWithAuditLabels(
  base: Record<string, RelationOption[]>,
  auditLabels: Record<string, Record<string, string>>,
  moduleFields: { slug: string; fieldType: string }[]
): Record<string, RelationOption[]> {
  const relationSlugs = new Set(
    moduleFields
      .filter((f) => f.fieldType === "relation" || f.fieldType === "relation-multi")
      .map((f) => f.slug)
  );
  const out: Record<string, RelationOption[]> = { ...base };
  for (const slug of relationSlugs) {
    const extraMap = auditLabels[slug];
    if (!extraMap || Object.keys(extraMap).length === 0) continue;
    const byId = new Map<string, RelationOption>();
    for (const o of base[slug] ?? []) byId.set(o.id, o);
    for (const [id, label] of Object.entries(extraMap)) {
      byId.set(id, { id, label });
    }
    out[slug] = [...byId.values()];
  }
  return out;
}
