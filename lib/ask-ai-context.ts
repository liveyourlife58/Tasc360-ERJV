/**
 * Build context and metadata for Ask AI (RAG). Shared by the server action and the streaming API route.
 */

import { prisma } from "@/lib/prisma";
import { formatEntityDataForContext } from "@/lib/format-entity-context";
import { getTenantLocale } from "@/lib/format";
import { getTenantTimeZone } from "@/lib/tenant-timezone";

export type AskAiContextResult =
  | { context: string; citedRecords: { entityId: string; moduleSlug: string; moduleName: string }[]; sys: string }
  | { noData: true; message: string }
  | { error: string };

export async function buildAskAiContext(
  tenantId: string,
  question: string,
  moduleSlug?: string | null
): Promise<AskAiContextResult> {
  const q = question.trim();
  if (!q) return { error: "Please enter a question." };

  const { searchEntitiesHybrid } = await import("@/lib/search");
  let moduleId: string | undefined;
  if (moduleSlug) {
    const mod = await prisma.module.findFirst({
      where: { tenantId, slug: moduleSlug, isActive: true },
      select: { id: true },
    });
    moduleId = mod?.id;
  }

  const [tenant, _results, modules] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } }),
    searchEntitiesHybrid(tenantId, q, { moduleId, limit: 15 }),
    prisma.module.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        fields: { select: { slug: true, name: true, fieldType: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
  ]);
  const locale = getTenantLocale(tenant?.settings ?? null);
  const timeZone = getTenantTimeZone(tenant?.settings ?? null);
  let results = _results;
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const fieldLabelsByModuleId = new Map<string, Record<string, string>>();
  const fieldTypesByModuleId = new Map<string, Record<string, string>>();
  for (const m of modules) {
    const labels: Record<string, string> = {};
    const types: Record<string, string> = {};
    for (const f of m.fields) {
      labels[f.slug] = f.name;
      types[f.slug] = f.fieldType;
    }
    fieldLabelsByModuleId.set(m.id, labels);
    fieldTypesByModuleId.set(m.id, types);
  }

  let fallbackNote = "";
  if (results.length === 0) {
    const fallback = await prisma.entity.findMany({
      where: { tenantId, deletedAt: null, ...(moduleId ? { moduleId } : {}) },
      orderBy: { updatedAt: "desc" },
      take: 15,
      select: { id: true, data: true, searchText: true, moduleId: true },
    });
    results = fallback.map((e) => ({
      entityId: e.id,
      moduleId: e.moduleId,
      data: (e.data as Record<string, unknown>) ?? {},
      searchText: e.searchText,
    }));
    if (results.length === 0) {
      const moduleName = moduleId ? moduleById.get(moduleId)?.name : null;
      const message = moduleName
        ? `There are no records in the ${moduleName} module yet. Add some, then try asking again.`
        : "There are no records in your workspace yet. Add some data, then try asking again.";
      return { noData: true, message };
    }
    fallbackNote =
      "No keyword or semantic match for the question. Below are some recent records for context. Answer from this if possible, or say what you cannot infer.\n\n";
  }

  const moduleCounts = new Map<string, number>();
  for (const r of results) {
    const mod = r.moduleId ? moduleById.get(r.moduleId) : null;
    const name = mod ? mod.name : "Record";
    moduleCounts.set(name, (moduleCounts.get(name) ?? 0) + 1);
  }
  const summaryLine =
    moduleCounts.size > 0
      ? `Records in context: ${Array.from(moduleCounts.entries())
          .map(([name, n]) => `${n} ${name}`)
          .join(", ")}.\n\n`
      : "";

  const contextParts: string[] = [];
  const citedRecords: { entityId: string; moduleSlug: string; moduleName: string }[] = [];
  for (const r of results) {
    const mod = r.moduleId ? moduleById.get(r.moduleId) : null;
    const label = mod ? mod.name : "Record";
    const slug = mod?.slug ?? "";
    citedRecords.push({ entityId: r.entityId, moduleSlug: slug, moduleName: label });
    const fieldLabels = r.moduleId ? fieldLabelsByModuleId.get(r.moduleId) : undefined;
    const fieldTypes = r.moduleId ? fieldTypesByModuleId.get(r.moduleId) : undefined;
    const fieldsText = formatEntityDataForContext(r.data, { fieldLabels, fieldTypes, locale, timeZone });
    contextParts.push(`[${label} ${r.entityId}]\n${fieldsText}`);
  }
  const context =
    contextParts.length > 0
      ? fallbackNote + summaryLine + contextParts.join("\n\n")
      : "No records in this workspace.";

  const viewingModuleName = moduleId ? moduleById.get(moduleId)?.name : null;
  let sys =
    "You are an assistant for this workspace. Answer the user's question using only the provided context (record fields and values). Use the exact field names and values from the context. If the context does not contain the information, say so. Be concise.";
  if (viewingModuleName) {
    sys += ` The user is currently viewing the ${viewingModuleName} module.`;
  }

  return { context, citedRecords, sys };
}
