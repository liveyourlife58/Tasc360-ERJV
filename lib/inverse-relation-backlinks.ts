import { prisma } from "./prisma";
import { labelFromTargetEntityData, resolveRelationDisplayFieldSlug } from "./relation-display";

/** When true on a relation field, target-module entity pages list source records that link here (via that field). */
export const RELATION_SHOW_BACKLINKS_ON_TARGET_KEY = "showBacklinksOnTarget";

export type InverseBacklinkEntity = {
  id: string;
  data: Record<string, unknown>;
  createdAt: Date;
};

export type InverseBacklinkSection = {
  sourceModuleSlug: string;
  sourceModuleName: string;
  fieldSlug: string;
  fieldName: string;
  sourceFields: { slug: string; name: string; fieldType: string }[];
  entities: InverseBacklinkEntity[];
};

type Candidate = {
  fieldSlug: string;
  fieldName: string;
  sourceModuleSlug: string;
  sourceModuleName: string;
  sourceFields: { slug: string; name: string; fieldType: string }[];
};

const DISPLAY_FIELD_TYPES = new Set(["text", "number", "date", "boolean", "select"]);

/** Short string for a single data value on the entity detail expansion. */
export function formatBacklinkFieldValue(val: unknown): string {
  if (val == null || val === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return val.length > 200 ? `${val.slice(0, 197)}…` : val;
  if (val instanceof Date) return val.toISOString();
  return "";
}

export function sourceFieldsForBacklinkGrid(
  fields: { slug: string; name: string; fieldType: string }[],
  max = 8
): { slug: string; name: string }[] {
  return fields
    .filter((f) => DISPLAY_FIELD_TYPES.has(f.fieldType))
    .slice(0, max)
    .map((f) => ({ slug: f.slug, name: f.name }));
}

async function loadInverseBacklinkCandidates(tenantId: string, targetModuleSlug: string): Promise<Candidate[]> {
  const modules = await prisma.module.findMany({
    where: { tenantId, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });

  const candidates: Candidate[] = [];
  for (const m of modules) {
    for (const f of m.fields) {
      if (f.fieldType !== "relation" && f.fieldType !== "relation-multi") continue;
      const s = (f.settings as Record<string, unknown> | null) ?? {};
      const tgt = (s.targetModuleSlug ?? s.targetModule) as string | undefined;
      if (tgt !== targetModuleSlug) continue;
      if (s[RELATION_SHOW_BACKLINKS_ON_TARGET_KEY] !== true) continue;
      candidates.push({
        fieldSlug: f.slug,
        fieldName: f.name,
        sourceModuleSlug: m.slug,
        sourceModuleName: m.name,
        sourceFields: m.fields.map((x) => ({ slug: x.slug, name: x.name, fieldType: x.fieldType })),
      });
    }
  }
  return candidates;
}

function buildSectionsForTarget(
  candidates: Candidate[],
  byField: Map<string, InverseBacklinkEntity[]>
): InverseBacklinkSection[] {
  const sections: InverseBacklinkSection[] = [];
  for (const c of candidates) {
    const raw = byField.get(c.fieldSlug);
    if (!raw?.length) continue;
    const entities = [...raw].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    sections.push({
      sourceModuleSlug: c.sourceModuleSlug,
      sourceModuleName: c.sourceModuleName,
      fieldSlug: c.fieldSlug,
      fieldName: c.fieldName,
      sourceFields: c.sourceFields,
      entities,
    });
  }
  return sections.sort((a, b) =>
    `${a.sourceModuleName} ${a.fieldName}`.localeCompare(`${b.sourceModuleName} ${b.fieldName}`)
  );
}

/**
 * Map target entity id → backlink sections (only ids with at least one section).
 * One batched Relationship query for the whole list page.
 */
export async function getInverseBacklinksByTargetEntityIds(
  tenantId: string,
  targetModuleSlug: string,
  targetEntityIds: string[]
): Promise<Record<string, InverseBacklinkSection[]>> {
  const out: Record<string, InverseBacklinkSection[]> = {};
  if (targetEntityIds.length === 0) return out;

  const candidates = await loadInverseBacklinkCandidates(tenantId, targetModuleSlug);
  if (candidates.length === 0) return out;

  const relationTypes = [...new Set(candidates.map((c) => c.fieldSlug))];
  const candidateBySlug = new Map(candidates.map((c) => [c.fieldSlug, c]));

  const rels = await prisma.relationship.findMany({
    where: {
      tenantId,
      targetId: { in: targetEntityIds },
      relationType: { in: relationTypes },
    },
    include: {
      source: {
        select: { id: true, data: true, deletedAt: true, createdAt: true },
      },
    },
  });

  const grouped = new Map<string, Map<string, InverseBacklinkEntity[]>>();
  for (const id of targetEntityIds) {
    grouped.set(id, new Map());
  }

  for (const r of rels) {
    if (r.source.deletedAt != null) continue;
    const c = candidateBySlug.get(r.relationType);
    if (!c) continue;
    const ent: InverseBacklinkEntity = {
      id: r.source.id,
      data: (r.source.data as Record<string, unknown>) ?? {},
      createdAt: r.source.createdAt,
    };
    const byField = grouped.get(r.targetId);
    if (!byField) continue;
    const list = byField.get(c.fieldSlug);
    if (list) list.push(ent);
    else byField.set(c.fieldSlug, [ent]);
  }

  for (const targetId of targetEntityIds) {
    const byField = grouped.get(targetId)!;
    const sections = buildSectionsForTarget(candidates, byField);
    if (sections.length > 0) out[targetId] = sections;
  }

  return out;
}

/**
 * For a record in the target module, find relation fields (on other modules) that opt in to backlinks
 * and return source entities that point at this record (Relationship rows targetId = targetEntityId).
 */
export async function getInverseRelationBacklinkSections(
  tenantId: string,
  targetModuleSlug: string,
  targetEntityId: string
): Promise<InverseBacklinkSection[]> {
  const map = await getInverseBacklinksByTargetEntityIds(tenantId, targetModuleSlug, [targetEntityId]);
  return map[targetEntityId] ?? [];
}

export function backlinkEntityTitle(
  entity: InverseBacklinkEntity,
  sourceFields: { slug: string; name: string; fieldType: string }[]
): string {
  const displaySlug = resolveRelationDisplayFieldSlug(
    undefined,
    sourceFields.map((f) => ({ slug: f.slug }))
  );
  return labelFromTargetEntityData(entity.data, displaySlug, entity.id);
}

/** Total source records across all sections (for list expand summary). */
export function countBacklinkEntities(sections: InverseBacklinkSection[]): number {
  return sections.reduce((n, s) => n + s.entities.length, 0);
}
