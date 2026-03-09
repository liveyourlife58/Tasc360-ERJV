import { prisma } from "./prisma";
import type { RelationOption } from "@/components/dashboard/EntityForm";

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
    const entities = await prisma.entity.findMany({
      where: { tenantId, moduleId: mod.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, data: true },
    });
    const nameField = mod.fields.find((f) => f.slug === "name") ?? mod.fields[0];
    const options: RelationOption[] = entities.map((e) => {
      const data = (e.data as Record<string, unknown>) ?? {};
      const label =
        (nameField && String(data[nameField.slug] ?? "").trim()) ||
        String(data.name ?? "").trim() ||
        e.id.slice(0, 8);
      return { id: e.id, label: label || e.id.slice(0, 8) };
    });
    for (const f of relationFields) {
      const s = f.settings as Record<string, unknown> | undefined;
      const target = (s?.targetModule ?? s?.targetModuleSlug) as string | undefined;
      if (target === slug) result[f.slug] = options;
    }
  }
  return result;
}
