"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assignHighlightRulesToSettings, parseHighlightRulesJsonField } from "@/lib/field-highlight-rules-form";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { filterEntitiesByConditions } from "@/lib/view-utils";
import { APP_CONFIG } from "@/lib/app-config";
import { entityEventActorPayload } from "@/lib/entity-event-actor";
import { labelFromTargetEntityData, resolveRelationDisplayFieldSlug } from "@/lib/relation-display";
import { sqlEntityDataKeyHasMeaningfulValue } from "@/lib/entity-data-field-measure";
import {
  ACTIVITY_FIELD_MAX_PREVIEW_LIMIT,
  loadActivitySummariesForEntities,
  stripActivityFieldValues,
} from "@/lib/activity-field";
import { getTenantLocale } from "@/lib/format";
import { getTenantTimeZone } from "@/lib/tenant-timezone";

async function requireDashboardPermission(permission: string) {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) throw new Error("Unauthorized");
  await requirePermission(userId, permission);
}

/** Send a test webhook event; used by Settings → Webhooks "Send test event". */
export async function sendTestWebhook(): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { success: false, error: "Unauthorized" };
  const { fireWebhookTest } = await import("@/lib/webhooks");
  return fireWebhookTest(tenantId);
}

/** Form action wrapper for Send test event button. */
export async function sendTestWebhookFormAction(_prev: unknown, _formData: FormData): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  return sendTestWebhook();
}

/** Sync File rows for entity file-type fields: one File per field with a URL; store fieldSlug in metadata. */
async function syncFilesForEntity(
  tenantId: string,
  entityId: string,
  data: Record<string, unknown>,
  fileFieldSlugs: string[]
) {
  if (fileFieldSlugs.length === 0) return;
  const existing = await prisma.file.findMany({
    where: { tenantId, entityId },
    select: { id: true, metadata: true },
  });
  const byField = new Map<string, string>();
  for (const f of existing) {
    const meta = f.metadata as Record<string, unknown> | null;
    if (meta && typeof meta.fieldSlug === "string") byField.set(meta.fieldSlug, f.id);
  }
  for (const slug of fileFieldSlugs) {
    const url = data[slug];
    const urlStr = typeof url === "string" ? url.trim() : "";
    const existingId = byField.get(slug);
    if (urlStr) {
      const payload = {
        tenantId,
        entityId,
        fileUrl: urlStr.slice(0, 1024),
        metadata: { fieldSlug: slug } as object,
      };
      if (existingId) {
        await prisma.file.update({
          where: { id: existingId },
          data: { fileUrl: payload.fileUrl },
        });
      } else {
        await prisma.file.create({ data: payload });
      }
    } else if (existingId) {
      await prisma.file.delete({ where: { id: existingId } });
    }
  }
}

/** Sync Relationship rows for an entity: relation and relation-multi fields → sourceId=entity, targetId from data. */
async function syncRelationshipsForEntity(
  tenantId: string,
  sourceEntityId: string,
  data: Record<string, unknown>,
  fields: { slug: string; fieldType: string }[]
) {
  const relationSlugs = fields
    .filter((f) => f.fieldType === "relation" || f.fieldType === "relation-multi")
    .map((f) => f.slug);
  if (relationSlugs.length === 0) return;

  await prisma.relationship.deleteMany({
    where: { tenantId, sourceId: sourceEntityId, relationType: { in: relationSlugs } },
  });

  const toCreate: { relationType: string; targetId: string }[] = [];
  for (const slug of relationSlugs) {
    const v = data[slug];
    if (Array.isArray(v)) {
      for (const id of v) if (typeof id === "string" && id.trim()) toCreate.push({ relationType: slug, targetId: id.trim() });
    } else if (typeof v === "string" && v.trim()) {
      toCreate.push({ relationType: slug, targetId: v.trim() });
    }
  }
  if (toCreate.length === 0) return;

  await prisma.relationship.createMany({
    data: toCreate.map(({ relationType, targetId }) => ({
      tenantId,
      sourceId: sourceEntityId,
      targetId,
      relationType,
    })),
    skipDuplicates: true,
  });
}

export async function createEntity(
  ctx: { tenantId: string; moduleId: string; createdBy: string | null },
  _prev: unknown,
  formData: FormData
) {
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const moduleRow = await prisma.module.findUnique({
    where: { id: ctx.moduleId },
    select: {
      slug: true,
      name: true,
      fields: { orderBy: { sortOrder: "asc" }, select: { slug: true, fieldType: true } },
    },
  });
  const relationMultiSlugs = new Set(
    moduleRow?.fields.filter((f) => f.fieldType === "relation-multi").map((f) => f.slug) ?? []
  );
  const data: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "entityId" || key === "_action" || key.startsWith("_")) continue;
    if (relationMultiSlugs.has(key)) continue;
    const v = value as string;
    if (v === "true") data[key] = true;
    else if (v === "false") data[key] = false;
    else if (v && !Number.isNaN(Number(v)) && v.trim() !== "") data[key] = Number(v);
    else data[key] = v || null;
  }
  for (const slug of relationMultiSlugs) {
    const all = formData.getAll(slug).filter((v): v is string => typeof v === "string" && v.trim() !== "");
    data[slug] = all.length ? all : null;
  }

  stripActivityFieldValues(data, moduleRow?.fields ?? []);

  const { validateTenantUserFieldValues } = await import("@/lib/tenant-user-field");
  const tuCreate = await validateTenantUserFieldValues(prisma, ctx.tenantId, moduleRow?.fields ?? [], data);
  if (!tuCreate.ok) return { error: tuCreate.message };

  const { buildSearchText } = await import("@/lib/search-text");
  const searchText = buildSearchText(moduleRow?.name ?? null, data) || null;

  const { mergeEntityPaymentType, parseDecimalToCents } = await import("@/lib/module-settings");
  const paymentTypeRaw = (formData.get("_paymentType") as string)?.trim() || "";
  const paymentType =
    paymentTypeRaw === "payment" || paymentTypeRaw === "donation" || paymentTypeRaw === "none"
      ? paymentTypeRaw
      : "";
  const priceCents = parseDecimalToCents(formData.get("_price") as string);
  const suggestedDonationAmountCents = parseDecimalToCents(formData.get("_suggestedDonationAmount") as string);
  if (paymentType === "payment" && (!priceCents || priceCents <= 0)) {
    return { error: "Price is required when payment type is Payment. Enter an amount (e.g. 25.00)." };
  }
  const metadata = mergeEntityPaymentType(null, paymentType, {
    priceCents: priceCents ?? null,
    suggestedDonationAmountCents: suggestedDonationAmountCents ?? null,
  });
  const capacityRaw = (formData.get("_capacity") as string)?.trim();
  if (capacityRaw !== "" && capacityRaw !== undefined) {
    metadata.capacity = Math.max(0, parseInt(capacityRaw, 10) || 0);
  }

  const created = await prisma.entity.create({
    data: {
      tenantId: ctx.tenantId,
      moduleId: ctx.moduleId,
      data: data as object,
      metadata: Object.keys(metadata).length > 0 ? (metadata as object) : undefined,
      searchText,
      createdBy: ctx.createdBy,
    },
    select: { id: true },
  });
  await syncRelationshipsForEntity(ctx.tenantId, created.id, data, moduleRow?.fields ?? []);
  const fileFieldSlugs = (moduleRow?.fields ?? []).filter((f) => f.fieldType === "file").map((f) => f.slug);
  await syncFilesForEntity(ctx.tenantId, created.id, data, fileFieldSlugs);

  const createdActor = await entityEventActorPayload(ctx.createdBy);
  await prisma.event.create({
    data: {
      tenantId: ctx.tenantId,
      entityId: created.id,
      eventType: "entity_created",
      data: { moduleSlug: moduleRow?.slug, ...createdActor } as object,
      createdBy: ctx.createdBy,
    },
  });
  const { fireWebhook } = await import("@/lib/webhooks");
  fireWebhook(ctx.tenantId, "entity.created", { entityId: created.id, moduleId: ctx.moduleId, data: data as object });
  const { upsertEmbeddingForEntity } = await import("@/lib/embeddings");
  upsertEmbeddingForEntity(ctx.tenantId, created.id, searchText ?? "").catch(() => {});

  const slug = moduleRow?.slug ?? "";
  revalidatePath(`/dashboard/m/${slug}`);
  redirect(`/dashboard/m/${slug}?success=created`);
}

export async function updateEntity(
  ctx: { entityId: string },
  _prev: unknown,
  formData: FormData
) {
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) throw new Error("Unauthorized");
  const existing = await prisma.entity.findFirst({
    where: { id: ctx.entityId, tenantId, deletedAt: null },
    select: {
      id: true,
      moduleId: true,
      data: true,
      metadata: true,
      module: {
        select: {
          name: true,
          fields: { select: { slug: true, fieldType: true } },
        },
      },
    },
  });
  if (!existing?.moduleId) throw new Error("Entity not found");
  const relationMultiSlugs = new Set(
    (existing.module?.fields ?? []).filter((f) => f.fieldType === "relation-multi").map((f) => f.slug)
  );
  const data: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "entityId" || key === "_action" || key.startsWith("_")) continue;
    if (relationMultiSlugs.has(key)) continue;
    const v = value as string;
    if (v === "true") data[key] = true;
    else if (v === "false") data[key] = false;
    else if (v && !Number.isNaN(Number(v)) && v.trim() !== "") data[key] = Number(v);
    else data[key] = v || null;
  }
  for (const slug of relationMultiSlugs) {
    const all = formData.getAll(slug).filter((v): v is string => typeof v === "string" && v.trim() !== "");
    data[slug] = all.length ? all : null;
  }

  stripActivityFieldValues(data, existing.module?.fields ?? []);

  const { validateTenantUserFieldValues } = await import("@/lib/tenant-user-field");
  const tuUpdate = await validateTenantUserFieldValues(prisma, tenantId, existing.module?.fields ?? [], data);
  if (!tuUpdate.ok) return { error: tuUpdate.message };

  const { buildSearchText } = await import("@/lib/search-text");
  const searchText = buildSearchText(existing.module?.name ?? null, data) || null;

  const { mergeEntityPaymentType, parseDecimalToCents } = await import("@/lib/module-settings");
  const paymentTypeRaw = (formData.get("_paymentType") as string)?.trim() || "";
  const paymentType =
    paymentTypeRaw === "payment" || paymentTypeRaw === "donation" || paymentTypeRaw === "none"
      ? paymentTypeRaw
      : "";
  const priceCents = parseDecimalToCents(formData.get("_price") as string);
  const suggestedDonationAmountCents = parseDecimalToCents(formData.get("_suggestedDonationAmount") as string);
  if (paymentType === "payment" && (!priceCents || priceCents <= 0)) {
    return { error: "Price is required when payment type is Payment. Enter an amount (e.g. 25.00)." };
  }
  const existingMeta = (existing.metadata as Record<string, unknown>) ?? null;
  const metadata = mergeEntityPaymentType(existingMeta, paymentType, {
    priceCents: priceCents ?? null,
    suggestedDonationAmountCents: suggestedDonationAmountCents ?? null,
  });
  const capacityRaw = (formData.get("_capacity") as string)?.trim();
  if (capacityRaw === "" || capacityRaw === undefined) {
    delete metadata.capacity;
  } else {
    metadata.capacity = Math.max(0, parseInt(capacityRaw, 10) || 0);
  }

  const entity = await prisma.entity.update({
    where: { id: ctx.entityId },
    data: {
      data: data as object,
      metadata: metadata as object,
      searchText: searchText || null,
    },
    include: { module: { select: { slug: true } } },
  });
  await syncRelationshipsForEntity(tenantId, entity.id, data, existing.module?.fields ?? []);
  const fileFieldSlugs = (existing.module?.fields ?? []).filter((f) => f.fieldType === "file").map((f) => f.slug);
  await syncFilesForEntity(tenantId, entity.id, data, fileFieldSlugs);

  const userId = (await headers()).get("x-user-id");
  const updateActor = await entityEventActorPayload(userId);
  const { computeShallowFieldChanges } = await import("@/lib/entity-event-field-changes");
  const prevData = (existing.data as Record<string, unknown> | null) ?? {};
  const prevMeta = (existing.metadata as Record<string, unknown> | null) ?? {};
  const fieldChanges = computeShallowFieldChanges(prevData, data);
  const metadataChanges = computeShallowFieldChanges(prevMeta, metadata as Record<string, unknown>);
  const eventData: Record<string, unknown> = { moduleSlug: entity.module?.slug, ...updateActor };
  if (Object.keys(fieldChanges).length > 0) eventData.fieldChanges = fieldChanges;
  if (Object.keys(metadataChanges).length > 0) eventData.metadataChanges = metadataChanges;
  await prisma.event.create({
    data: {
      tenantId,
      entityId: entity.id,
      eventType: "entity_updated",
      data: eventData as object,
      createdBy: userId,
    },
  });
  const { fireWebhook } = await import("@/lib/webhooks");
  fireWebhook(tenantId, "entity.updated", { entityId: entity.id, moduleId: entity.moduleId, data: data as object });
  const { upsertEmbeddingForEntity } = await import("@/lib/embeddings");
  upsertEmbeddingForEntity(tenantId, entity.id, searchText || "").catch(() => {});

  const slug = entity.module?.slug ?? "";
  revalidatePath(`/dashboard/m/${slug}`);
  revalidatePath(`/dashboard/m/${slug}/${entity.id}`);
  redirect(`/dashboard/m/${slug}?success=saved`);
}

/** Clone an entity: create a new entity with the same module, data, and metadata. */
export async function duplicateEntity(entityId: string, moduleSlug: string): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId || !userId) return { error: "Unauthorized" };
  const existing = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, deletedAt: null },
    include: { module: { include: { fields: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!existing?.module || existing.module.slug !== moduleSlug) return { error: "Entity not found." };
  const data = { ...((existing.data as Record<string, unknown>) ?? {}) };
  stripActivityFieldValues(data, existing.module.fields ?? []);
  const metadata = (existing.metadata as Record<string, unknown> | null) ?? {};
  const searchText = existing.searchText;
  const created = await prisma.entity.create({
    data: {
      tenantId,
      moduleId: existing.moduleId,
      data: data as object,
      metadata: Object.keys(metadata).length > 0 ? (metadata as object) : undefined,
      searchText,
      createdBy: userId,
    },
    select: { id: true },
  });
  await syncRelationshipsForEntity(tenantId, created.id, data, existing.module.fields ?? []);
  const cloneActor = await entityEventActorPayload(userId);
  await prisma.event.create({
    data: {
      tenantId,
      entityId: created.id,
      eventType: "entity_created",
      data: { moduleSlug: existing.module.slug, clonedFrom: entityId, ...cloneActor } as object,
      createdBy: userId,
    },
  });
  const { fireWebhook } = await import("@/lib/webhooks");
  fireWebhook(tenantId, "entity.created", { entityId: created.id, moduleId: existing.moduleId, data });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  revalidatePath(`/dashboard/m/${moduleSlug}/${created.id}`);
  redirect(`/dashboard/m/${moduleSlug}/${created.id}?success=created`);
}

/** Form action for Clone entity button. Redirects to new entity on success. */
export async function duplicateEntityFormAction(formData: FormData): Promise<void> {
  const entityId = (formData.get("entityId") as string)?.trim();
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  if (!entityId || !moduleSlug) throw new Error("Missing entity or module.");
  const result = await duplicateEntity(entityId, moduleSlug);
  if (result?.error) throw new Error(result.error);
}

/** Update a single field on an entity (e.g. board column drag). */
export async function updateEntitySingleField(
  entityId: string,
  moduleSlug: string,
  fieldSlug: string,
  value: string
): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId || !userId) return { error: "Unauthorized" };
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) return { error: "Module not found." };
  const field = module_.fields.find((f) => f.slug === fieldSlug);
  if (!field) return { error: "Field not found." };
  if (field.fieldType === "activity") return { error: "This field is read-only." };
  if (field.fieldType === "tenant-user" && value.trim() !== "") {
    const { validateTenantUserFieldValues } = await import("@/lib/tenant-user-field");
    const tu = await validateTenantUserFieldValues(prisma, tenantId, [{ slug: fieldSlug, fieldType: "tenant-user" }], {
      [fieldSlug]: value.trim(),
    });
    if (!tu.ok) return { error: tu.message };
  }
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, moduleId: module_.id, deletedAt: null },
    select: { id: true, data: true },
  });
  if (!entity) return { error: "Entity not found." };
  const data = { ...((entity.data as Record<string, unknown>) ?? {}), [fieldSlug]: value || null };
  const searchText = Object.values(data)
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ")
    .slice(0, 10000) || null;
  await prisma.entity.update({
    where: { id: entityId },
    data: { data: data as object, searchText },
  });
  await syncRelationshipsForEntity(tenantId, entityId, data, module_.fields);
  const singleFieldActor = await entityEventActorPayload(userId);
  const prevRow = (entity.data as Record<string, unknown>) ?? {};
  const { computeShallowFieldChanges } = await import("@/lib/entity-event-field-changes");
  const fieldChanges = computeShallowFieldChanges(prevRow, data);
  const eventData: Record<string, unknown> = { moduleSlug, ...singleFieldActor };
  if (Object.keys(fieldChanges).length > 0) eventData.fieldChanges = fieldChanges;
  await prisma.event.create({
    data: {
      tenantId,
      entityId,
      eventType: "entity_updated",
      data: eventData as object,
      createdBy: userId,
    },
  });
  const { fireWebhook } = await import("@/lib/webhooks");
  fireWebhook(tenantId, "entity.updated", { entityId, moduleId: module_.id, data });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  revalidatePath(`/dashboard/m/${moduleSlug}/${entityId}`);
  return {};
}

export type RelatedEntityRow = {
  id: string;
  moduleSlug: string;
  moduleName: string;
  relationType: string;
  /** Field label (e.g. "Stage") for the relation edge; `relationType` remains the slug. */
  relationFieldLabel: string;
  direction: "out" | "in";
  data: Record<string, unknown>;
  /** Human-readable title for the linked record (respects relation display field when applicable). */
  displayTitle: string;
};

/** Return related entities (where this entity is source or target in Relationship table). */
export async function getRelatedEntities(
  entityId: string,
  options?: {
    /** Current record's module fields (the page you open the entity from). Used to resolve outbound relation labels. */
    sourceModuleFields?: { slug: string; name: string; settings: unknown }[];
  }
) {
  await requireDashboardPermission(PERMISSIONS.entitiesRead);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized", related: null };

  const [fromSource, fromTarget] = await Promise.all([
    prisma.relationship.findMany({
      where: { tenantId, sourceId: entityId },
      include: { target: { include: { module: { select: { slug: true, name: true } } } } },
    }),
    prisma.relationship.findMany({
      where: { tenantId, targetId: entityId },
      include: { source: { include: { module: { select: { slug: true, name: true } } } } },
    }),
  ]);

  const base: Omit<RelatedEntityRow, "displayTitle" | "relationFieldLabel">[] = [];
  fromSource.forEach((r) => {
    base.push({
      id: r.target.id,
      moduleSlug: r.target.module?.slug ?? "",
      moduleName: r.target.module?.name ?? "",
      relationType: r.relationType,
      direction: "out",
      data: (r.target.data as Record<string, unknown>) ?? {},
    });
  });
  fromTarget.forEach((r) => {
    base.push({
      id: r.source.id,
      moduleSlug: r.source.module?.slug ?? "",
      moduleName: r.source.module?.name ?? "",
      relationType: r.relationType,
      direction: "in",
      data: (r.source.data as Record<string, unknown>) ?? {},
    });
  });

  const sourceFields = options?.sourceModuleFields;
  const sourceBySlug = sourceFields?.length
    ? new Map(sourceFields.map((f) => [f.slug, f]))
    : null;

  const moduleSlugs = [...new Set(base.map((row) => row.moduleSlug).filter(Boolean))];
  const modules =
    moduleSlugs.length > 0
      ? await prisma.module.findMany({
          where: { tenantId, slug: { in: moduleSlugs }, isActive: true },
          include: {
            fields: { orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } },
          },
        })
      : [];
  const moduleBySlug = new Map(modules.map((m) => [m.slug, m]));

  const related: RelatedEntityRow[] = base.map((r) => {
    const mod = moduleBySlug.get(r.moduleSlug);
    const targetFieldSlugs = mod?.fields.map((f) => ({ slug: f.slug })) ?? [];

    let relationFieldLabel = r.relationType;
    let displayTitle: string;

    if (r.direction === "out") {
      const srcField = sourceBySlug?.get(r.relationType);
      if (srcField) relationFieldLabel = srcField.name;
      const settings = (srcField?.settings as Record<string, unknown> | undefined) ?? {};
      const displaySlug = resolveRelationDisplayFieldSlug(settings, targetFieldSlugs);
      displayTitle = labelFromTargetEntityData(r.data, displaySlug, r.id);
    } else {
      const invField = mod?.fields.find((f) => f.slug === r.relationType);
      if (invField) relationFieldLabel = invField.name;
      const displaySlug = resolveRelationDisplayFieldSlug(null, targetFieldSlugs);
      displayTitle = labelFromTargetEntityData(r.data, displaySlug, r.id);
    }

    return { ...r, displayTitle, relationFieldLabel };
  });

  return { error: null, related };
}

/** Return entity data for given IDs in a relation target module (for relation-multi modal). */
export async function getRelationEntityData(moduleSlug: string, entityIds: string[]) {
  await requireDashboardPermission(PERMISSIONS.entitiesRead);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized", entities: null, fields: null };
  const ids = entityIds.filter((id) => typeof id === "string" && id.trim()).slice(0, 100);
  if (ids.length === 0) return { error: null, entities: [], fields: [] };

  const [module_, tenantRow] = await Promise.all([
    prisma.module.findFirst({
      where: { tenantId, slug: moduleSlug, isActive: true },
      select: {
        id: true,
        fields: {
          orderBy: { sortOrder: "asc" },
          select: { slug: true, name: true, fieldType: true, settings: true },
        },
      },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    }),
  ]);
  if (!module_) return { error: "Module not found", entities: null, fields: null };

  const entities = await prisma.entity.findMany({
    where: { tenantId, moduleId: module_.id, id: { in: ids }, deletedAt: null },
    select: { id: true, data: true },
  });

  const fields = module_.fields.map((f) => ({
    slug: f.slug,
    name: f.name,
    fieldType: f.fieldType,
    settings: f.settings ?? undefined,
  }));
  const activityDefs = fields.filter((f) => f.fieldType === "activity").map((f) => ({ slug: f.slug, settings: f.settings }));
  const activityFormatOpts = {
    locale: getTenantLocale(tenantRow?.settings ?? null),
    timeZone: getTenantTimeZone(tenantRow?.settings ?? null),
  };
  const activityMap = await loadActivitySummariesForEntities(
    tenantId,
    entities.map((e) => e.id),
    activityDefs,
    activityFormatOpts
  );
  const activityByEntityId = Object.fromEntries(
    [...activityMap.entries()].map(([id, rec]) => [id, rec])
  );

  return {
    error: null,
    entities: entities.map((e) => ({ id: e.id, data: (e.data as Record<string, unknown>) ?? {} })),
    fields,
    activityByEntityId,
  };
}

/** Return ticket/order details for an entity (order lines with purchaser info). */
export async function getEntityTicketDetails(entityId: string) {
  await requireDashboardPermission(PERMISSIONS.entitiesRead);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized", orderLines: null };

  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!entity) return { error: "Entity not found", orderLines: null };

  const orderLines = await prisma.orderLine.findMany({
    where: { entityId: entity.id },
    include: {
      order: {
        select: { id: true, status: true, purchaserName: true, purchaserEmail: true, createdAt: true },
      },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  return {
    error: null,
    orderLines: orderLines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      amountCents: line.amountCents,
      lineType: line.lineType,
      checkedInQuantity: line.checkedInQuantity,
      order: line.order,
    })),
  };
}

/** Update how many tickets have checked in for an order line. */
export async function updateOrderLineCheckIn(
  orderLineId: string,
  checkedInQuantity: number
): Promise<{ error: string | null }> {
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };

  const line = await prisma.orderLine.findUnique({
    where: { id: orderLineId },
    include: { order: { select: { tenantId: true } } },
  });
  if (!line || line.order.tenantId !== tenantId) return { error: "Order line not found." };

  const value = Math.max(0, Math.min(line.quantity, Math.floor(checkedInQuantity)));
  await prisma.orderLine.update({
    where: { id: orderLineId },
    data: { checkedInQuantity: value },
  });
  return { error: null };
}

/** Refund an order (Stripe Connect). Updates order and payment status to refunded. */
export async function refundOrder(orderId: string): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId) return { error: "Unauthorized" };

  let tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!tenant) return { error: "Unauthorized" };
  if (!(await import("@/lib/feature-flags")).isFeatureEnabled(tenant.settings, "refunds")) {
    return { error: "Refunds are disabled for this workspace." };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    select: { id: true, status: true },
  });
  if (!order) return { error: "Order not found." };
  if (order.status !== "completed") return { error: "Only completed orders can be refunded." };

  const { getTenantConnectConfig } = await import("@/lib/stripe-connect");
  const connectConfig = getTenantConnectConfig(tenant);
  if (!connectConfig?.onboardingComplete) return { error: "Stripe Connect is not set up for this workspace." };

  const payment = await prisma.payment.findFirst({
    where: {
      tenantId,
      status: "succeeded",
      metadata: { path: ["orderId"], equals: orderId },
    },
    select: { id: true, externalId: true },
  });
  if (!payment?.externalId || !payment.externalId.startsWith("pi_")) {
    return { error: "No refundable payment found for this order (or order was free)." };
  }

  const Stripe = (await import("stripe")).default;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { error: "Stripe is not configured." };
  const stripeClient = new Stripe(key);
  try {
    await stripeClient.refunds.create(
      { payment_intent: payment.externalId },
      { stripeAccount: connectConfig.accountId }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Stripe refund failed: ${message}` };
  }

  await prisma.payment.updateMany({
    where: { tenantId, metadata: { path: ["orderId"], equals: orderId } },
    data: { status: "refunded" },
  });
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "refunded" },
  });
  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(tenantId, "order_refunded", { orderId }, userId ?? null);
  revalidatePath("/dashboard");
  return {};
}

/** Find one entity by module and a text ref (name/search). includeDeleted: consider all; deletedOnly: only soft-deleted. */
async function findEntityByRef(
  tenantId: string,
  moduleId: string,
  entityRef: string,
  moduleFields: { slug: string }[],
  includeDeleted = false,
  deletedOnly = false
): Promise<{ id: string; data: object; searchText: string | null } | null> {
  const where: { tenantId: string; moduleId: string; deletedAt?: Date | null | { not: null } } = { tenantId, moduleId };
  if (deletedOnly) where.deletedAt = { not: null };
  else if (!includeDeleted) where.deletedAt = null;
  const entities = await prisma.entity.findMany({
    where,
    select: { id: true, data: true, searchText: true },
  });
  const refLower = entityRef.toLowerCase().trim();
  const firstFieldSlug = moduleFields[0]?.slug ?? "name";
  const found = entities.find((e) => {
    const search = (e.searchText ?? "").toLowerCase();
    if (search.includes(refLower)) return true;
    const data = (e.data as Record<string, unknown>) ?? {};
    const nameVal = data.name ?? data[firstFieldSlug];
    const nameStr = String(nameVal ?? "").toLowerCase();
    return nameStr.includes(refLower) || refLower.includes(nameStr) || nameStr === refLower;
  });
  if (!found) return null;
  return { id: found.id, data: (found.data ?? {}) as object, searchText: found.searchText };
}

export async function deleteEntity(
  entityId: string,
  moduleSlug: string
): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) throw new Error("Unauthorized");
  const existing = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new Error("Entity not found");

  const ticketsSold = await prisma.orderLine.count({ where: { entityId } });
  if (ticketsSold > 0) {
    return {
      error: "Cannot delete this record because 1 or more tickets has been sold. Refund or transfer tickets first.",
    };
  }

  const entity = await prisma.entity.update({
    where: { id: entityId },
    data: { deletedAt: new Date() },
    include: { module: { select: { slug: true } } },
  });
  const userId = (await headers()).get("x-user-id");
  const deleteActor = await entityEventActorPayload(userId);
  await prisma.event.create({
    data: {
      tenantId,
      entityId: entity.id,
      eventType: "entity_deleted",
      data: { moduleSlug: entity.module?.slug, ...deleteActor } as object,
      createdBy: userId,
    },
  });
  const { fireWebhook } = await import("@/lib/webhooks");
  fireWebhook(tenantId, "entity.deleted", { entityId: entity.id });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  redirect(`/dashboard/m/${moduleSlug}?success=deleted`);
}

/** Restore a soft-deleted entity (set deletedAt = null). */
export async function restoreEntity(entityId: string, moduleSlug: string): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    select: { id: true },
  });
  if (!module_) return { error: "Module not found." };
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, moduleId: module_.id, deletedAt: { not: null } },
    select: { id: true },
  });
  if (!entity) return { error: "Entity not found or not deleted." };
  await prisma.entity.update({
    where: { id: entityId },
    data: { deletedAt: null },
  });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  redirect(`/dashboard/m/${moduleSlug}`);
}

/** Ask AI: full-text search for relevant entities, then answer the question using that context (RAG). */
export async function askDashboardAi(
  question: string,
  moduleSlug?: string | null
): Promise<{ error?: string; answer?: string; citedRecords?: { entityId: string; moduleSlug: string; moduleName: string }[] }> {
  await requireDashboardPermission(PERMISSIONS.entitiesRead);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const q = (question ?? "").trim();
  if (!q) return { error: "Please enter a question." };

  const { buildAskAiContext } = await import("@/lib/ask-ai-context");
  const built = await buildAskAiContext(tenantId, q, moduleSlug);
  if ("noData" in built && built.noData) {
    return { answer: built.message, citedRecords: undefined };
  }
  if ("error" in built) return { error: built.error };
  const { context, citedRecords, sys } = built as {
    context: string;
    citedRecords: { entityId: string; moduleSlug: string; moduleName: string }[];
    sys: string;
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: "AI is not configured (OPENAI_API_KEY)." };
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: `Context:\n${context}\n\nQuestion: ${q}` },
      ],
    });
    const answer = res.choices[0]?.message?.content?.trim() ?? "I couldn't generate an answer.";
    return { answer, citedRecords: citedRecords.length > 0 ? citedRecords : undefined };
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const message = (err as Error)?.message ?? "";
    if (status === 429 || message.toLowerCase().includes("rate limit")) {
      return { error: "The AI service is busy. Please try again in a minute." };
    }
    if (status === 401 || status === 403 || message.toLowerCase().includes("invalid") || message.toLowerCase().includes("api key")) {
      return { error: "AI is not configured or the API key is invalid. Check OPENAI_API_KEY." };
    }
    if (message.toLowerCase().includes("timeout") || message.toLowerCase().includes("econnreset")) {
      return { error: "The request timed out. Please try again." };
    }
    return { error: "The AI service is temporarily unavailable. Please try again in a moment." };
  }
}

/** List pending approvals for the tenant. */
export async function getPendingApprovals() {
  await requireDashboardPermission(PERMISSIONS.entitiesRead);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized", approvals: null };
  const approvals = await prisma.approval.findMany({
    where: { tenantId, status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      entity: { select: { id: true, data: true, module: { select: { slug: true, name: true } } } },
      requestedByUser: { select: { id: true, name: true, email: true } },
    },
  });
  return { error: null, approvals };
}

/** Request approval for an entity (creates pending Approval, optionally sends email). */
export async function requestApproval(
  entityId: string,
  moduleSlug: string,
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId || !userId) return { error: "Unauthorized" };
  const approvalType = (formData.get("approvalType") as string)?.trim();
  if (!approvalType || approvalType.length > 100) return { error: "Approval type is required (e.g. Quote, PO)." };
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!entity) return { error: "Entity not found." };
  const existing = await prisma.approval.findFirst({
    where: { tenantId, entityId, approvalType, status: "pending" },
    select: { id: true },
  });
  if (existing) return { error: "This record already has a pending approval request for this type." };
  await prisma.approval.create({
    data: {
      tenantId,
      entityId,
      approvalType,
      requestedBy: userId,
      status: "pending",
    },
  });
  const { sendApprovalRequestedEmail } = await import("@/lib/email");
  sendApprovalRequestedEmail(tenantId, { entityId, approvalType }).catch(() => {});
  revalidatePath(`/dashboard/m/${moduleSlug}/${entityId}`);
  revalidatePath("/dashboard/approvals");
  return {};
}

/** Approve or reject an approval request. */
export async function decideApproval(approvalId: string, status: "approved" | "rejected", comment?: string | null): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId || !userId) return { error: "Unauthorized" };
  const approval = await prisma.approval.findFirst({
    where: { id: approvalId, tenantId, status: "pending" },
    select: { id: true },
  });
  if (!approval) return { error: "Approval not found or already decided." };
  await prisma.approval.update({
    where: { id: approvalId },
    data: { status, decidedBy: userId, decidedAt: new Date(), comment: comment ?? null },
  });
  revalidatePath("/dashboard/approvals");
  redirect("/dashboard/approvals");
}

/** Return recent events (audit) for an entity. */
export async function getEntityEvents(entityId: string, limit = 20) {
  await requireDashboardPermission(PERMISSIONS.entitiesRead);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized", events: null };
  const events = await prisma.event.findMany({
    where: { tenantId, entityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      eventType: true,
      data: true,
      createdAt: true,
      createdBy: true,
      createdByUser: { select: { email: true, name: true } },
    },
  });
  return { error: null, events };
}

// -----------------------------------------------------------------------------
// Views (Phase 2)
// -----------------------------------------------------------------------------

export async function createView(
  ctx: { tenantId: string; moduleId: string; moduleSlug: string },
  _prev: unknown,
  formData: FormData
) {
  await requireDashboardPermission(PERMISSIONS.viewsManage);
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "View name is required." };

  const columnsJson = formData.get("columns") as string | null;
  const columns = columnsJson ? (JSON.parse(columnsJson) as string[]) : [];
  const sort = [{ field: "createdAt", dir: "desc" as const }];
  const filter = {};

  await prisma.view.create({
    data: {
      tenantId: ctx.tenantId,
      moduleId: ctx.moduleId,
      name,
      viewType: "list",
      filter: filter as object,
      sort: sort as object,
      columns: (columns.length ? columns : []) as object,
    },
  });

  revalidatePath(`/dashboard/m/${ctx.moduleSlug}`);
  redirect(`/dashboard/m/${ctx.moduleSlug}`);
}

export async function deleteView(
  viewId: string,
  moduleSlug: string
) {
  await requireDashboardPermission(PERMISSIONS.viewsManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) throw new Error("Unauthorized");
  const existing = await prisma.view.findFirst({
    where: { id: viewId, tenantId },
    select: { id: true },
  });
  if (!existing) throw new Error("View not found");
  await prisma.view.delete({ where: { id: viewId } });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  redirect(`/dashboard/m/${moduleSlug}`);
}

/** Form-action wrapper for deleteView (signature expected by form action). */
export async function deleteViewFormAction(
  viewId: string,
  moduleSlug: string,
  _prev: unknown,
  _formData: FormData
) {
  await deleteView(viewId, moduleSlug);
}

export async function updateView(
  viewId: string,
  moduleSlug: string,
  _prev: unknown,
  formData: FormData
) {
  await requireDashboardPermission(PERMISSIONS.viewsManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) throw new Error("Unauthorized");
  const existing = await prisma.view.findFirst({
    where: { id: viewId, tenantId },
    select: { id: true },
  });
  if (!existing) return { error: "View not found." };
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "View name is required." };
  const columnsRaw = (formData.get("columns") as string)?.trim();
  const columns = columnsRaw ? columnsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const viewTypeRaw = (formData.get("viewType") as string)?.trim();
  const viewType = viewTypeRaw === "board" || viewTypeRaw === "calendar" ? viewTypeRaw : "list";
  const boardColumnField = (formData.get("boardColumnField") as string)?.trim() || null;
  const dateField = (formData.get("dateField") as string)?.trim() || null;
  const boardLaneSourceRaw = (formData.get("boardLaneSource") as string)?.trim();
  let boardLaneSource: "data" | "all_options" | "custom" =
    boardLaneSourceRaw === "all_options" || boardLaneSourceRaw === "custom" ? boardLaneSourceRaw : "data";
  let boardLaneValues: string[] = [];
  if (boardLaneSource === "custom") {
    const json = (formData.get("boardLaneValuesJson") as string)?.trim();
    if (json) {
      try {
        const parsed = JSON.parse(json) as unknown;
        if (Array.isArray(parsed)) {
          boardLaneValues = parsed.filter((x): x is string => typeof x === "string");
        }
      } catch {
        boardLaneValues = [];
      }
    }
    if (boardLaneValues.length === 0) boardLaneSource = "data";
  }
  const settings: Record<string, unknown> = {};
  if (viewType === "board" && boardColumnField) {
    settings.boardColumnField = boardColumnField;
    settings.boardLaneSource = boardLaneSource;
    if (boardLaneSource === "custom" && boardLaneValues.length > 0) {
      settings.boardLaneValues = boardLaneValues;
    }
    const boardCardFieldsRaw = (formData.get("boardCardFields") as string)?.trim() ?? "";
    const boardCardFieldSlugs = boardCardFieldsRaw
      ? boardCardFieldsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    if (boardCardFieldSlugs.length > 0) {
      settings.boardCardFieldSlugs = boardCardFieldSlugs;
    }
    const boardCardLabelFieldsRaw = (formData.get("boardCardLabelFields") as string)?.trim() ?? "";
    const boardCardLabelFieldSlugs = boardCardLabelFieldsRaw
      ? boardCardLabelFieldsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
    settings.boardCardLabelFieldSlugs = boardCardLabelFieldSlugs;
  }
  if (viewType === "calendar" && dateField) settings.dateField = dateField;

  let filter: unknown = [];
  const filterJson = (formData.get("filterJson") as string)?.trim();
  if (filterJson) {
    try {
      const parsed = JSON.parse(filterJson) as unknown;
      filter = Array.isArray(parsed) ? parsed : [];
    } catch {
      filter = [];
    }
  }
  let sort: unknown = [];
  const sortJson = (formData.get("sortJson") as string)?.trim();
  if (sortJson) {
    try {
      const parsed = JSON.parse(sortJson) as unknown;
      sort = Array.isArray(parsed) ? parsed : [];
    } catch {
      sort = [];
    }
  }

  await prisma.view.update({
    where: { id: viewId },
    data: {
      name,
      viewType,
      columns: columns.length ? (columns as object) : [],
      filter: (filter as object) ?? [],
      sort: (sort as object) ?? [],
      settings: Object.keys(settings).length > 0 ? (settings as object) : undefined,
    },
  });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  redirect(`/dashboard/m/${moduleSlug}?view=${viewId}`);
}

/** Set the default view for a module (opened when no view in URL). */
export async function setModuleDefaultView(moduleSlug: string, viewId: string | null): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.viewsManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    select: { id: true, settings: true },
  });
  if (!module_) return { error: "Module not found." };
  if (viewId) {
    const view = await prisma.view.findFirst({
      where: { id: viewId, tenantId, moduleId: module_.id },
      select: { id: true },
    });
    if (!view) return { error: "View not found." };
  }
  const settings = (module_.settings as Record<string, unknown>) ?? {};
  settings.defaultViewId = viewId ?? undefined;
  if (!viewId) delete settings.defaultViewId;
  await prisma.module.update({
    where: { id: module_.id },
    data: { settings: settings as object },
  });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  return {};
}

/** Persist module.settings.listOrder ("asc" | "desc") for default record ordering by createdAt. Form: moduleSlug (hidden), listOrder. */
export async function updateModuleListOrderFormAction(formData: FormData) {
  await requireDashboardPermission(PERMISSIONS.modulesManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) throw new Error("Unauthorized");
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  if (!moduleSlug) throw new Error("Missing module.");
  const raw = (formData.get("listOrder") as string)?.trim();
  const order: "asc" | "desc" = raw === "asc" ? "asc" : "desc";
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    select: { id: true, settings: true },
  });
  if (!module_) throw new Error("Module not found.");
  const { mergeModuleListOrder } = await import("@/lib/module-settings");
  const settings = mergeModuleListOrder((module_.settings as Record<string, unknown>) ?? null, order);
  await prisma.module.update({
    where: { id: module_.id },
    data: { settings: settings as object },
  });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  revalidatePath(`/dashboard/m/${moduleSlug}/fields`);
  redirect(`/dashboard/m/${moduleSlug}/fields`);
}

/** Platform admin: same as updateModuleListOrderFormAction for another tenant. Form: targetTenantId, moduleSlug, listOrder. */
export async function updateModuleListOrderAsPlatformAdminFormAction(formData: FormData) {
  await requirePlatformAdmin();
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  if (!targetTenantId || !moduleSlug) throw new Error("Missing target tenant or module.");
  const raw = (formData.get("listOrder") as string)?.trim();
  const order: "asc" | "desc" = raw === "asc" ? "asc" : "desc";
  const module_ = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug: moduleSlug, isActive: true },
    select: { id: true, settings: true },
  });
  if (!module_) throw new Error("Module not found.");
  const { mergeModuleListOrder } = await import("@/lib/module-settings");
  const settings = mergeModuleListOrder((module_.settings as Record<string, unknown>) ?? null, order);
  await prisma.module.update({
    where: { id: module_.id },
    data: { settings: settings as object },
  });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  revalidatePath(`/dashboard/m/${moduleSlug}/fields`);
  revalidatePath(platformFieldsRedirect(targetTenantId, moduleSlug));
  redirect(platformFieldsRedirect(targetTenantId, moduleSlug));
}

/** Export tenant data as JSON (modules, fields, entities). For backup/portability. */
export async function getTenantExportData(): Promise<{ error?: string; data?: Record<string, unknown> }> {
  await requireDashboardPermission(PERMISSIONS.entitiesRead);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const modules = await prisma.module.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  const exportModules = modules.map((m) => ({
    name: m.name,
    slug: m.slug,
    description: m.description ?? null,
    fields: m.fields.map((f) => ({
      name: f.name,
      slug: f.slug,
      fieldType: f.fieldType,
      isRequired: f.isRequired,
      settings: f.settings,
    })),
  }));
  const entitiesByModule: Record<string, { id: string; data: unknown; createdAt: string }[]> = {};
  const limitPerModule = APP_CONFIG.exportEntitiesPerModuleLimit;
  for (const m of modules) {
    const list = await prisma.entity.findMany({
      where: { tenantId, moduleId: m.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: limitPerModule,
      select: { id: true, data: true, createdAt: true },
    });
    entitiesByModule[m.slug] = list.map((e) => ({
      id: e.id,
      data: e.data,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  const [journalEntriesExport, exchangeRates, fiscalPeriods] = await Promise.all([
    prisma.journalEntry.findMany({
      where: { tenantId },
      orderBy: { entryDate: "desc" },
      select: {
        id: true,
        entryDate: true,
        reference: true,
        description: true,
        status: true,
        ledgerEntityId: true,
        externalId: true,
        createdBy: true,
        createdAt: true,
        lines: {
          select: {
            accountEntityId: true,
            debitCents: true,
            creditCents: true,
            currency: true,
            description: true,
          },
        },
      },
    }),
    prisma.exchangeRate.findMany({
      where: { tenantId },
      orderBy: { effectiveDate: "desc" },
      select: { fromCurrency: true, toCurrency: true, rate: true, effectiveDate: true },
    }),
    prisma.fiscalPeriod.findMany({
      where: { tenantId },
      orderBy: { periodStart: "desc" },
      select: { periodStart: true, periodEnd: true, closedAt: true, closedBy: true },
    }),
  ]);

  const journalEntries = journalEntriesExport.map((je) => ({
    id: je.id,
    entryDate: je.entryDate.toISOString().slice(0, 10),
    reference: je.reference,
    description: je.description,
    status: je.status,
    ledgerEntityId: je.ledgerEntityId,
    externalId: je.externalId,
    createdBy: je.createdBy,
    createdAt: je.createdAt.toISOString(),
    lines: je.lines.map((l) => ({
      accountEntityId: l.accountEntityId,
      debitCents: l.debitCents,
      creditCents: l.creditCents,
      currency: l.currency,
      description: l.description,
    })),
  }));

  const data = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    tenantId,
    modules: exportModules,
    entitiesByModule,
    finance: {
      journalEntries,
      exchangeRates: exchangeRates.map((r) => ({
        fromCurrency: r.fromCurrency,
        toCurrency: r.toCurrency,
        rate: Number(r.rate),
        effectiveDate: r.effectiveDate.toISOString().slice(0, 10),
      })),
      fiscalPeriods: fiscalPeriods.map((p) => ({
        periodStart: p.periodStart.toISOString().slice(0, 10),
        periodEnd: p.periodEnd.toISOString().slice(0, 10),
        closedAt: p.closedAt?.toISOString() ?? null,
        closedBy: p.closedBy ?? null,
      })),
    },
  };
  return { data };
}

/** Import tenant data from JSON produced by export. Creates missing modules/fields and entities. */
export async function importTenantData(
  jsonString: string
): Promise<{ error?: string; created?: { modules: number; entities: number } }> {
  await requireDashboardPermission(PERMISSIONS.modulesManage);
  await requireDashboardPermission(PERMISSIONS.entitiesWrite);
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId || !userId) return { error: "Unauthorized" };
  let payload: {
    exportVersion?: number;
    modules?: { name: string; slug: string; description?: string | null; fields?: { name: string; slug: string; fieldType: string; isRequired?: boolean; settings?: unknown }[] }[];
    entitiesByModule?: Record<string, { id: string; data: unknown; createdAt?: string }[]>;
  };
  try {
    payload = JSON.parse(jsonString) as typeof payload;
  } catch {
    return { error: "Invalid JSON." };
  }
  const exportVersion = typeof payload.exportVersion === "number" ? payload.exportVersion : 1;
  if (exportVersion > 1) {
    return { error: `Unsupported export version ${exportVersion}. This importer supports version 1.` };
  }
  const modules = Array.isArray(payload.modules) ? payload.modules : [];
  const entitiesByModule = payload.entitiesByModule && typeof payload.entitiesByModule === "object" ? payload.entitiesByModule : {};
  let modulesCreated = 0;
  let entitiesCreated = 0;
  const slugToModuleId = new Map<string, string>();
  const existingModules = await prisma.module.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, slug: true },
  });
  for (const m of existingModules) slugToModuleId.set(m.slug, m.id);
  for (const m of modules) {
    const slug = (m.slug ?? "").trim();
    const name = (m.name ?? "").trim() || slug;
    if (!slug) continue;
    let moduleId = slugToModuleId.get(slug);
    if (!moduleId) {
      const maxOrder = await prisma.module.findMany({ where: { tenantId }, orderBy: { sortOrder: "desc" }, take: 1, select: { sortOrder: true } });
      const created = await prisma.module.create({
        data: {
          tenantId,
          name,
          slug,
          description: m.description ?? null,
          sortOrder: (maxOrder[0]?.sortOrder ?? -1) + 1,
        },
        select: { id: true },
      });
      moduleId = created.id;
      slugToModuleId.set(slug, moduleId);
      modulesCreated++;
      const fields = Array.isArray(m.fields) ? m.fields : [];
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        await prisma.field.create({
          data: {
            moduleId,
            name: (f.name ?? "").trim() || (f.slug ?? "").trim() || `Field ${i + 1}`,
            slug: (f.slug ?? "").trim() || `field_${i + 1}`,
            fieldType: (f.fieldType ?? "text").trim() || "text",
            isRequired: !!f.isRequired,
            settings: (f.settings != null && typeof f.settings === "object") ? (f.settings as object) : {},
            sortOrder: i,
          },
        });
      }
    }
    const list = entitiesByModule[slug];
    if (!Array.isArray(list)) continue;
    const moduleFields = await prisma.field.findMany({ where: { moduleId }, orderBy: { sortOrder: "asc" }, select: { slug: true, fieldType: true } });
    for (const item of list) {
      const data = item?.data && typeof item.data === "object" ? (item.data as Record<string, unknown>) : {};
      const searchText = Object.values(data)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .join(" ")
        .slice(0, 10000) || null;
      await prisma.entity.create({
        data: {
          tenantId,
          moduleId,
          data: data as object,
          searchText,
          createdBy: userId,
        },
      });
      entitiesCreated++;
    }
  }
  revalidatePath("/dashboard");
  return { created: { modules: modulesCreated, entities: entitiesCreated } };
}

/** Start Stripe Connect onboarding (redirect to Stripe). */
export async function startStripeConnectOnboarding(): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, settings: true },
  });
  if (!tenant) return { error: "Tenant not found" };
  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const existingAccountId = settings.stripeConnectAccountId as string | undefined;
  const { createConnectAccount, createConnectAccountLink, getTenantConnectConfig } = await import("@/lib/stripe-connect");
  let accountId: string;
  if (existingAccountId) {
    accountId = existingAccountId;
  } else {
    const firstUser = await prisma.user.findFirst({
      where: { tenantId, isActive: true },
      select: { email: true, name: true },
    });
    const result = await createConnectAccount(
      tenantId,
      firstUser?.email ?? "",
      tenant.name ?? ""
    );
    if ("error" in result) return { error: result.error };
    accountId = result.accountId;
  }
  const base = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const result = await createConnectAccountLink(
    tenantId,
    accountId,
    `${base}/dashboard/settings?stripe_connect=refresh`,
    `${base}/dashboard/settings?stripe_connect=return`
  );
  if ("error" in result) return { error: result.error };
  redirect(result.url);
}

/** Form action for Connect Stripe button (accepts formData for useActionState). */
export async function connectStripeFormAction(_prev: unknown, _formData: FormData): Promise<{ error?: string }> {
  return startStripeConnectOnboarding();
}

// -----------------------------------------------------------------------------
// Tenant dashboard settings (Phase 2)
// -----------------------------------------------------------------------------

/** Internal: apply formData to tenant settings and save. Option skipDeveloperGate allows API/webhook changes without tenant allowDeveloperSetup. */
async function applyTenantSettingsUpdate(
  tenantId: string,
  formData: FormData,
  options: { skipDeveloperGate?: boolean }
): Promise<void> {
  const prisma = (await import("@/lib/prisma")).prisma;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  const section = (formData.get("settingsSection") as string) || null;

  const { getAllowDeveloperSetup } = await import("@/lib/developer-setup");
  const allowDeveloperSetup = getAllowDeveloperSetup(tenant?.settings ?? null);
  const h = await headers();
  const userId = h.get("x-user-id");
  const hasDeveloper = userId ? await (await import("@/lib/permissions")).hasPermission(userId, PERMISSIONS.settingsDeveloper) : false;
  if (!options.skipDeveloperGate) {
    if (section === "backend-webhooks" && (!allowDeveloperSetup || !hasDeveloper)) {
      throw new Error("Developer setup is not enabled or you don't have permission to change webhooks.");
    }
  }

  if (section !== "customer" && section !== "dashboard-features") {
    const dashboard = (settings.dashboard as Record<string, unknown>) ?? {};
    const branding = (dashboard.branding as Record<string, unknown>) ?? {};
    const name = (formData.get("brandingName") as string)?.trim();
    const logo = (formData.get("brandingLogo") as string)?.trim();
    const primaryColor = (formData.get("brandingPrimaryColor") as string)?.trim();
    if (name !== undefined) branding.name = name || undefined;
    if (logo !== undefined) branding.logo = logo || undefined;
    if (primaryColor !== undefined) branding.primaryColor = primaryColor || undefined;
    dashboard.branding = Object.keys(branding).length ? branding : undefined;
    const homeType = formData.get("homeType") as string;
    const homeModuleSlug = (formData.get("homeModuleSlug") as string)?.trim();
    const homeViewId = (formData.get("homeViewId") as string)?.trim();
    if (homeType === "module" && homeModuleSlug) {
      dashboard.home = { type: "module", moduleSlug: homeModuleSlug };
    } else if (homeType === "view" && homeModuleSlug && homeViewId) {
      dashboard.home = { type: "view", moduleSlug: homeModuleSlug, viewId: homeViewId };
    } else if (homeType === "none" || !homeType) {
      dashboard.home = undefined;
    }
    const sidebarOrderRaw = formData.get("sidebarOrder") as string;
    if (sidebarOrderRaw !== undefined) {
      try {
        const order = JSON.parse(sidebarOrderRaw) as string[];
        dashboard.sidebarOrder = Array.isArray(order) ? order : undefined;
      } catch {
        dashboard.sidebarOrder = undefined;
      }
    }
    settings.dashboard = Object.keys(dashboard).length ? dashboard : undefined;
  }

  if (section === "backend-webhooks") {
    const webhookUrl = (formData.get("webhookUrl") as string)?.trim();
    const webhookSecret = (formData.get("webhookSecret") as string)?.trim();
    if (webhookUrl !== undefined) settings.webhookUrl = webhookUrl || undefined;
    if (webhookSecret !== undefined && webhookSecret !== "") settings.webhookSecret = webhookSecret;
  }

  if (section === "backend-locale") {
    const locale = (formData.get("locale") as string)?.trim();
    settings.locale = locale && /^[a-z]{2}(-[A-Z]{2})?$/.test(locale) ? locale : undefined;
    const { isValidIanaTimeZone } = await import("@/lib/tenant-timezone");
    const tzRaw = (formData.get("timeZone") as string)?.trim();
    settings.timeZone = tzRaw && isValidIanaTimeZone(tzRaw) ? tzRaw : undefined;
  }

  if (section === "backend-features") {
    const features = (settings.features as Record<string, boolean>) ?? {};
    features.myOrders = formData.has("featureMyOrders");
    features.refunds = formData.has("featureRefunds");
    settings.features = features;
  }

  if (section === "dashboard-features") {
    const { DASHBOARD_FEATURE_KEYS } = await import("@/lib/dashboard-features");
    const dashboardFeatures: Record<string, boolean> = {};
    for (const key of DASHBOARD_FEATURE_KEYS) {
      dashboardFeatures[key] = formData.has(`featureDashboard${key.charAt(0).toUpperCase()}${key.slice(1)}`);
    }
    settings.dashboardFeatures = dashboardFeatures;
  }

  if (section === "email-notifications") {
    const notificationEmail = (formData.get("notificationEmail") as string)?.trim();
    settings.notificationEmail = notificationEmail && notificationEmail.includes("@") ? notificationEmail : undefined;
    const fromAddr = (formData.get("emailFromAddress") as string)?.trim();
    settings.emailFromAddress = fromAddr && fromAddr.includes("@") ? fromAddr : undefined;
    const fromName = (formData.get("emailFromName") as string)?.trim();
    settings.emailFromName = fromName || undefined;
    const replyTo = (formData.get("emailReplyTo") as string)?.trim();
    settings.emailReplyTo = replyTo && replyTo.includes("@") ? replyTo : undefined;
    const notifications = (settings.emailNotifications as Record<string, boolean>) ?? {};
    notifications.approvalRequested = formData.has("approvalRequested");
    notifications.paymentReceived = formData.has("paymentReceived");
    notifications.paymentFailed = formData.has("paymentFailed");
    notifications.webhookFailed = formData.has("webhookFailed");
    settings.emailNotifications = notifications;
  }

  if (section === "backend-customer-logins") {
    const customerLogin = (settings.customerLogin as Record<string, unknown>) ?? {};
    customerLogin.enabled = formData.has("customerLoginEnabled");
    customerLogin.allowSelfSignup = formData.has("customerLoginAllowSelfSignup");
    settings.customerLogin = customerLogin;
  }

  if (section !== "backend" && section !== "backend-webhooks") {
    const site = (settings.site as Record<string, unknown>) ?? {};
    if (formData.has("siteName")) {
      const v = (formData.get("siteName") as string)?.trim();
      site.name = v || undefined;
    }
    if (formData.has("tagline")) {
      const v = (formData.get("tagline") as string)?.trim();
      site.tagline = v || undefined;
    }
    if (formData.has("homeContent")) {
      const pages = (settings.pages as Record<string, unknown>) ?? {};
      const v = (formData.get("homeContent") as string)?.trim();
      pages.home = v || undefined;
      settings.pages = Object.keys(pages).length ? pages : undefined;
    }
    const publicModules: Record<string, { slug: string; showInNav: boolean }> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("publicModule_enabled_") && value === "1") {
        const moduleSlug = key.replace("publicModule_enabled_", "");
        const slugEntry = formData.get("publicModule_slug_" + moduleSlug);
        const slug = (slugEntry as string)?.trim() || moduleSlug;
        publicModules[moduleSlug] = {
          slug,
          showInNav: formData.get("publicModule_nav_" + moduleSlug) === "1",
        };
      }
    }
    site.publicModules = Object.keys(publicModules).length ? publicModules : undefined;
    const heroImage = (formData.get("siteHeroImage") as string)?.trim();
    if (heroImage !== undefined) site.heroImage = heroImage || undefined;
    const metaTitle = (formData.get("metaTitle") as string)?.trim();
    if (metaTitle !== undefined) site.metaTitle = metaTitle || undefined;
    const metaDescription = (formData.get("metaDescription") as string)?.trim();
    if (metaDescription !== undefined) site.metaDescription = metaDescription || undefined;
    const ogImage = (formData.get("ogImage") as string)?.trim();
    if (ogImage !== undefined) site.ogImage = ogImage || undefined;
    const canonicalBaseUrl = (formData.get("canonicalBaseUrl") as string)?.trim();
    if (canonicalBaseUrl !== undefined) site.canonicalBaseUrl = canonicalBaseUrl || undefined;
    const faviconUrl = (formData.get("faviconUrl") as string)?.trim();
    if (formData.has("faviconUrl")) site.faviconUrl = faviconUrl || undefined;
    const customDomain = (formData.get("customDomain") as string)?.trim();
    if (customDomain !== undefined) site.customDomain = customDomain || undefined;
    if (formData.has("waitlistModuleSlug")) {
      const wlMod = (formData.get("waitlistModuleSlug") as string)?.trim();
      const wlEv = (formData.get("waitlistEventFieldSlug") as string)?.trim();
      const wlEm = (formData.get("waitlistEmailFieldSlug") as string)?.trim();
      const wlQty = (formData.get("waitlistQuantityFieldSlug") as string)?.trim();
      if (wlMod && wlEv && wlEm && wlQty) {
        site.waitlist = { moduleSlug: wlMod, eventFieldSlug: wlEv, emailFieldSlug: wlEm, quantityFieldSlug: wlQty };
      } else {
        site.waitlist = undefined;
      }
    }
    const homepageSidebarModule = (formData.get("homepageSidebarModule") as string)?.trim();
    if (homepageSidebarModule !== undefined) {
      site.homepageSidebarModule = homepageSidebarModule || undefined;
    }
    const sidebarFieldSlugs = formData.getAll("homepageSidebarFieldSlugs").filter((v): v is string => typeof v === "string" && v.trim() !== "");
    if (sidebarFieldSlugs.length >= 0) {
      site.homepageSidebarFieldSlugs = sidebarFieldSlugs.length ? sidebarFieldSlugs : undefined;
    }
    if (formData.has("footerHtml")) {
      const v = (formData.get("footerHtml") as string)?.trim();
      site.footerHtml = v || undefined;
    }
    if (formData.has("cookieBannerSection")) {
      site.showCookieBanner = formData.get("showCookieBanner") === "1";
    }
    if (formData.has("cookiePolicyUrl")) {
      const v = (formData.get("cookiePolicyUrl") as string)?.trim();
      site.cookiePolicyUrl = v || undefined;
    }
    settings.site = Object.keys(site).length ? site : undefined;
    if (formData.has("contactEmail")) {
      const pages = (settings.pages as Record<string, unknown>) ?? {};
      const email = ((formData.get("contactEmail") as string) ?? "").trim();
      const phone = ((formData.get("contactPhone") as string) ?? "").trim();
      const addressLine1 = ((formData.get("contactAddressLine1") as string) ?? "").trim();
      const addressLine2 = ((formData.get("contactAddressLine2") as string) ?? "").trim();
      const city = ((formData.get("contactCity") as string) ?? "").trim();
      const state = ((formData.get("contactState") as string) ?? "").trim();
      const postalCode = ((formData.get("contactPostalCode") as string) ?? "").trim();
      const country = ((formData.get("contactCountry") as string) ?? "").trim();
      const extraContent = ((formData.get("contactExtraContent") as string) ?? "").trim();
      const contact: Record<string, string> = {};
      if (email) contact.email = email;
      if (phone) contact.phone = phone;
      if (addressLine1) contact.addressLine1 = addressLine1;
      if (addressLine2) contact.addressLine2 = addressLine2;
      if (city) contact.city = city;
      if (state) contact.state = state;
      if (postalCode) contact.postalCode = postalCode;
      if (country) contact.country = country;
      if (extraContent) contact.extraContent = extraContent;
      pages.contact = Object.keys(contact).length ? contact : undefined;
      settings.pages = Object.keys(pages).length ? pages : undefined;
    }
    const { mergeModulePaymentType } = await import("@/lib/module-settings");
    const allModules = await prisma.module.findMany({
      where: { tenantId },
      select: { id: true, slug: true, settings: true },
    });
    for (const mod of allModules) {
      const raw = formData.get("publicModule_paymentType_" + mod.slug) as string | null;
      const paymentType = raw === "payment" || raw === "donation" ? raw : null;
      const nextSettings = mergeModulePaymentType(
        (mod.settings as Record<string, unknown>) ?? null,
        paymentType
      );
      await prisma.module.update({
        where: { id: mod.id },
        data: { settings: nextSettings as object },
      });
    }
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: settings as object },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath(`/dashboard/platform/tenant/${tenantId}`);
}

export async function updateDashboardSettings(
  tenantId: string,
  _prev: unknown,
  formData: FormData
) {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  await applyTenantSettingsUpdate(tenantId, formData, {});
  redirect("/dashboard/settings?success=saved");
}

/** Platform admin only: update another tenant's settings. formData must include targetTenantId. */
export async function updateTenantSettingsAsPlatformAdmin(
  _prev: unknown,
  formData: FormData
) {
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  if (!targetTenantId) {
    throw new Error("Missing target tenant.");
  }
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const { isPlatformAdmin } = await import("@/lib/developer-setup");
  if (!isPlatformAdmin(user?.email ?? null)) {
    throw new Error("Only platform admins can edit tenant settings.");
  }
  await applyTenantSettingsUpdate(targetTenantId, formData, { skipDeveloperGate: true });
  redirect(`/dashboard/platform/tenant/${targetTenantId}?success=saved`);
}

/** Toggle "Allow developer setup" for this tenant. Only platform admins (PLATFORM_ADMIN_EMAILS) can call this. */
export async function updateAllowDeveloperSetup(
  _tenantId: string,
  enabled: boolean
): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const h = await headers();
  const userId = h.get("x-user-id");
  const tenantId = h.get("x-tenant-id");
  if (!userId || !tenantId) return { error: "Unauthorized" };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const { isPlatformAdmin } = await import("@/lib/developer-setup");
  if (!isPlatformAdmin(user?.email ?? null)) {
    return { error: "Only platform admins can change this setting." };
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  settings.allowDeveloperSetup = enabled === true;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: settings as object },
  });
  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(
    tenantId,
    enabled ? "developer_setup_enabled" : "developer_setup_disabled",
    { enabled },
    userId,
    null
  );
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/layout");
  redirect("/dashboard/settings?success=developer-setup");
}

/** Form action for the "Allow developer setup" toggle. Reads formData "enabled" (true/false string). Use from platform admin with tenantId; use updateAllowDeveloperSetupForCurrentTenantFormAction on the tenant's own settings page. */
export async function updateAllowDeveloperSetupFormAction(
  tenantId: string,
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const raw = formData.get("enabled");
  const enabled = String(raw ?? "") === "true";
  return updateAllowDeveloperSetup(tenantId, enabled);
}

/** Form action for "Allow developer setup" on the current tenant's settings page. Gets tenantId from session so it can be passed to Client Components by reference. */
export async function updateAllowDeveloperSetupForCurrentTenantFormAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const raw = formData.get("enabled");
  const enabled = String(raw ?? "") === "true";
  return updateAllowDeveloperSetup(tenantId, enabled);
}

/** Update "Allow developer setup" for any tenant. Platform admins only. Used by the Platform admin page. */
export async function updateTenantDeveloperSetup(
  targetTenantId: string,
  enabled: boolean,
  returnTo?: string | null
): Promise<{ error?: string }> {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) return { error: "Unauthorized" };
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const { isPlatformAdmin } = await import("@/lib/developer-setup");
  if (!isPlatformAdmin(user?.email ?? null)) {
    return { error: "Only platform admins can change this setting." };
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: targetTenantId },
    select: { settings: true },
  });
  if (!tenant) return { error: "Tenant not found." };
  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  settings.allowDeveloperSetup = enabled === true;
  await prisma.tenant.update({
    where: { id: targetTenantId },
    data: { settings: settings as object },
  });
  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(
    targetTenantId,
    enabled ? "developer_setup_enabled" : "developer_setup_disabled",
    { enabled },
    userId,
    null
  );
  revalidatePath("/dashboard/platform");
  revalidatePath(`/dashboard/platform/tenant/${targetTenantId}`);
  revalidatePath("/dashboard/layout");
  const path = returnTo?.trim();
  const safeReturn = path && path.startsWith("/dashboard") ? path : "/dashboard/platform";
  redirect(safeReturn + (safeReturn.includes("?") ? "&" : "?") + "success=updated");
}

/** Form action for Platform admin page: formData must include targetTenantId and enabled (true/false string). Optional returnTo for redirect after update. */
export async function updateTenantDeveloperSetupFormAction(
  prevOrFormData: unknown,
  formDataArg?: FormData
): Promise<{ error?: string }> {
  const data = (formDataArg instanceof FormData ? formDataArg : prevOrFormData) as FormData;
  if (!data?.get) return { error: "Invalid request." };
  const targetTenantId = (data.get("targetTenantId") as string)?.trim();
  const enabled = String(data.get("enabled") ?? "") === "true";
  const returnTo = (data.get("returnTo") as string)?.trim() || null;
  if (!targetTenantId) return { error: "Missing tenant." };
  return updateTenantDeveloperSetup(targetTenantId, enabled, returnTo);
}

// -----------------------------------------------------------------------------
// API key management (create / revoke)
// -----------------------------------------------------------------------------

export type CreateApiKeyState = { key?: string; error?: string };

export async function createApiKeyAction(
  tenantId: string,
  _prev: unknown,
  formData: FormData
): Promise<CreateApiKeyState> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const userId = (await headers()).get("x-user-id");
  const sessionTenantId = (await headers()).get("x-tenant-id");
  if (!userId || sessionTenantId !== tenantId) return { error: "Unauthorized" };
  const { getAllowDeveloperSetup } = await import("@/lib/developer-setup");
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!getAllowDeveloperSetup(tenant?.settings ?? null)) return { error: "Developer setup is not enabled for this workspace." };
  const { hasPermission } = await import("@/lib/permissions");
  if (!(await hasPermission(userId, PERMISSIONS.settingsDeveloper))) return { error: "You don't have permission to manage API keys." };
  const name = (formData.get("apiKeyName") as string)?.trim() || "API key";
  const { createApiKey } = await import("@/lib/api-keys");
  const result = await createApiKey(tenantId, name, userId);
  if ("error" in result) return { error: result.error };
  return { key: result.key };
}

export async function revokeApiKeyAction(tenantId: string, formData: FormData): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const userId = (await headers()).get("x-user-id");
  const sessionTenantId = (await headers()).get("x-tenant-id");
  if (!userId || sessionTenantId !== tenantId) return { error: "Unauthorized" };
  const { getAllowDeveloperSetup } = await import("@/lib/developer-setup");
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!getAllowDeveloperSetup(tenant?.settings ?? null)) return { error: "Developer setup is not enabled for this workspace." };
  const { hasPermission } = await import("@/lib/permissions");
  if (!(await hasPermission(userId, PERMISSIONS.settingsDeveloper))) return { error: "You don't have permission to manage API keys." };
  const apiKeyId = (formData.get("apiKeyId") as string)?.trim();
  if (!apiKeyId) return { error: "Missing API key ID." };
  const { revokeApiKey } = await import("@/lib/api-keys");
  return revokeApiKey(tenantId, apiKeyId, userId);
}

/** Form action for Revoke API key button; redirects on success. */
export async function revokeApiKeyFormAction(tenantId: string, formData: FormData): Promise<void> {
  const result = await revokeApiKeyAction(tenantId, formData);
  if (result.error) throw new Error(result.error);
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings");
}

/** Platform admin only: create API key for a target tenant. */
export async function createApiKeyAsPlatformAdmin(
  targetTenantId: string,
  _prev: unknown,
  formData: FormData
): Promise<CreateApiKeyState> {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) return { error: "Unauthorized" };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const { isPlatformAdmin } = await import("@/lib/developer-setup");
  if (!isPlatformAdmin(user?.email ?? null)) return { error: "Only platform admins can create API keys for other tenants." };
  const name = (formData.get("apiKeyName") as string)?.trim() || "API key";
  const { createApiKey } = await import("@/lib/api-keys");
  const result = await createApiKey(targetTenantId, name, userId);
  if ("error" in result) return { error: result.error };
  return { key: result.key };
}

/** Form action for platform admin: reads targetTenantId from formData and creates API key for that tenant. */
export async function createApiKeyAsPlatformAdminFormAction(
  prev: unknown,
  formData: FormData
): Promise<CreateApiKeyState> {
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  if (!targetTenantId) return { error: "Missing target tenant." };
  return createApiKeyAsPlatformAdmin(targetTenantId, prev, formData);
}

/** Platform admin only: revoke API key for a target tenant. */
export async function revokeApiKeyAsPlatformAdmin(targetTenantId: string, formData: FormData): Promise<void> {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const { isPlatformAdmin } = await import("@/lib/developer-setup");
  if (!isPlatformAdmin(user?.email ?? null)) throw new Error("Only platform admins can revoke API keys for other tenants.");
  const apiKeyId = (formData.get("apiKeyId") as string)?.trim();
  if (!apiKeyId) throw new Error("Missing API key ID.");
  const { revokeApiKey } = await import("@/lib/api-keys");
  const result = await revokeApiKey(targetTenantId, apiKeyId, userId);
  if (result.error) throw new Error(result.error);
  revalidatePath(`/dashboard/platform/tenant/${targetTenantId}`);
  redirect(`/dashboard/platform/tenant/${targetTenantId}?success=saved`);
}

/** Form action for platform admin: reads targetTenantId from formData and revokes API key for that tenant. */
export async function revokeApiKeyAsPlatformAdminFormAction(formData: FormData): Promise<void> {
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  if (!targetTenantId) throw new Error("Missing target tenant.");
  return revokeApiKeyAsPlatformAdmin(targetTenantId, formData);
}

// -----------------------------------------------------------------------------
// Tenant end-user (customer) account management
// -----------------------------------------------------------------------------

const END_USER_INVITE_TOKEN_EXPIRY_DAYS = 7;
const END_USER_RESET_TOKEN_EXPIRY_HOURS = 1;

export async function inviteEndUserAction(
  tenantId: string,
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const userId = (await headers()).get("x-user-id");
  const sessionTenantId = (await headers()).get("x-tenant-id");
  if (!userId || sessionTenantId !== tenantId) return { error: "Unauthorized" };
  const email = (formData.get("email") as string)?.trim()?.toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "A valid email is required." };
  const existing = await prisma.tenantEndUser.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (existing) return { error: "A customer account with this email already exists." };
  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + END_USER_INVITE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  await prisma.tenantEndUser.create({
    data: {
      tenantId,
      email,
      name,
      isActive: true,
      inviteToken: token,
      inviteTokenExpiresAt: expiresAt,
    },
  });
  const base = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const setPasswordUrl = `${base}/set-customer-password?token=${encodeURIComponent(token)}`;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const { sendEndUserInviteEmail } = await import("@/lib/email");
  await sendEndUserInviteEmail(email, tenant?.name ?? "Workspace", setPasswordUrl);
  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(tenantId, "end_user_invited", { email }, userId);
  revalidatePath("/dashboard/settings");
  return {};
}

export async function deactivateEndUserAction(tenantId: string, formData: FormData): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const userId = (await headers()).get("x-user-id");
  const sessionTenantId = (await headers()).get("x-tenant-id");
  if (!userId || sessionTenantId !== tenantId) return { error: "Unauthorized" };
  const endUserId = (formData.get("endUserId") as string)?.trim();
  if (!endUserId) return { error: "Missing user." };
  const row = await prisma.tenantEndUser.findFirst({
    where: { id: endUserId, tenantId },
  });
  if (!row) return { error: "User not found." };
  await prisma.tenantEndUser.update({
    where: { id: endUserId },
    data: { isActive: false, inviteToken: null, inviteTokenExpiresAt: null, resetToken: null, resetTokenExpiresAt: null },
  });
  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(tenantId, "end_user_deactivated", { email: row.email, endUserId }, userId);
  revalidatePath("/dashboard/settings");
  return {};
}

export async function sendEndUserPasswordResetAction(tenantId: string, formData: FormData): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const userId = (await headers()).get("x-user-id");
  const sessionTenantId = (await headers()).get("x-tenant-id");
  if (!userId || sessionTenantId !== tenantId) return { error: "Unauthorized" };
  const endUserId = (formData.get("endUserId") as string)?.trim();
  if (!endUserId) return { error: "Missing user." };
  const row = await prisma.tenantEndUser.findFirst({
    where: { id: endUserId, tenantId, isActive: true },
  });
  if (!row) return { error: "User not found or inactive." };
  const crypto = await import("crypto");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + END_USER_RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  await prisma.tenantEndUser.update({
    where: { id: endUserId },
    data: { resetToken: token, resetTokenExpiresAt: expiresAt },
  });
  const base = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const resetUrl = `${base}/set-customer-password?token=${encodeURIComponent(token)}`;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  const { sendEndUserPasswordResetEmail } = await import("@/lib/email");
  const sent = await sendEndUserPasswordResetEmail(row.email, tenant?.name ?? "Workspace", resetUrl);
  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(tenantId, "end_user_password_reset_sent", { email: row.email, endUserId }, userId);
  revalidatePath("/dashboard/settings");
  return sent ? {} : { error: "Failed to send email. Check email configuration." };
}

/** Form action for Deactivate / Send reset; redirects on success. */
export async function deactivateEndUserFormAction(tenantId: string, formData: FormData): Promise<void> {
  const result = await deactivateEndUserAction(tenantId, formData);
  if (result.error) throw new Error(result.error);
  redirect("/dashboard/settings");
}

export async function sendEndUserPasswordResetFormAction(tenantId: string, formData: FormData): Promise<void> {
  const result = await sendEndUserPasswordResetAction(tenantId, formData);
  if (result.error) throw new Error(result.error);
  redirect("/dashboard/settings");
}

// -----------------------------------------------------------------------------
// Dashboard AI (Phase 3)
// -----------------------------------------------------------------------------

export async function createModuleFromAi(
  tenantId: string,
  _prev: unknown,
  formData: FormData
) {
  await requireDashboardPermission(PERMISSIONS.modulesManage);
  const prompt = (formData.get("prompt") as string)?.trim();
  if (!prompt) return { error: "Please describe the module you need." };

  const { suggestModuleFromPrompt } = await import("@/lib/ai");
  const existing = await prisma.module.findMany({
    where: { tenantId },
    select: { slug: true },
  });
  let suggestion: Awaited<ReturnType<typeof suggestModuleFromPrompt>>;
  try {
    suggestion = await suggestModuleFromPrompt(
      prompt,
      existing.map((m) => m.slug)
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not generate module. Please try again." };
  }

  const maxOrder = await prisma.module
    .aggregate({ where: { tenantId }, _max: { sortOrder: true } })
    .then((r) => r._max.sortOrder ?? -1);

  const module_ = await prisma.module.create({
    data: {
      tenantId,
      name: suggestion.name,
      slug: suggestion.slug,
      description: suggestion.description ?? null,
      sortOrder: maxOrder + 1,
    },
  });

  for (let i = 0; i < suggestion.fields.length; i++) {
    const f = suggestion.fields[i];
    const options = f.settings?.options;
    await prisma.field.create({
      data: {
        moduleId: module_.id,
        name: f.name,
        slug: f.slug,
        fieldType: f.fieldType,
        isRequired: f.isRequired ?? false,
        sortOrder: i,
        settings: options ? ({ options } as object) : {},
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/m/${module_.slug}`);
  redirect(`/dashboard/m/${module_.slug}`);
}

/** Apply an industry template: create modules + fields + optional default views for the tenant. */
export async function applyTemplate(templateId: string) {
  await requireDashboardPermission(PERMISSIONS.modulesManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) throw new Error("Unauthorized");

  const { getTemplate } = await import("@/lib/templates");
  const template = getTemplate(templateId);
  if (!template) return { error: "Template not found." };

  const existingSlugs = await prisma.module.findMany({ where: { tenantId }, select: { slug: true } }).then((ms) => new Set(ms.map((m) => m.slug)));
  for (const mod of template.modules) {
    if (existingSlugs.has(mod.slug)) return { error: `Module "${mod.slug}" already exists. Remove it or choose a different template.` };
  }

  const maxOrder = await prisma.module.aggregate({ where: { tenantId }, _max: { sortOrder: true } }).then((r) => r._max.sortOrder ?? -1);
  let sortOrder = maxOrder + 1;
  let firstSlug: string | null = null;

  for (const mod of template.modules) {
    const module_ = await prisma.module.create({
      data: {
        tenantId,
        name: mod.name,
        slug: mod.slug,
        description: mod.description ?? null,
        sortOrder: sortOrder++,
      },
    });
    if (!firstSlug) firstSlug = module_.slug;

    for (let i = 0; i < mod.fields.length; i++) {
      const f = mod.fields[i];
      const settings: Record<string, unknown> = {};
      if (f.settings?.options) settings.options = f.settings.options;
      if (f.settings?.targetModuleSlug) settings.targetModuleSlug = f.settings.targetModuleSlug;
      await prisma.field.create({
        data: {
          moduleId: module_.id,
          name: f.name,
          slug: f.slug,
          fieldType: f.fieldType,
          isRequired: f.isRequired ?? false,
          sortOrder: i,
          settings: settings as object,
        },
      });
    }

    if (mod.defaultView) {
      const fieldSlugs = mod.fields.map((f) => f.slug);
      const columns = fieldSlugs.slice(0, 6);
      const viewSettings: Record<string, unknown> = {};
      if (mod.defaultView.viewType === "board" && mod.defaultView.boardColumnField) viewSettings.boardColumnField = mod.defaultView.boardColumnField;
      if (mod.defaultView.viewType === "calendar" && mod.defaultView.dateField) viewSettings.dateField = mod.defaultView.dateField;
      await prisma.view.create({
        data: {
          tenantId,
          moduleId: module_.id,
          name: "Default",
          viewType: mod.defaultView.viewType,
          filter: {},
          sort: [{ field: "createdAt", dir: "desc" }],
          columns: columns as object,
          settings: viewSettings as object,
        },
      });
    }
  }

  revalidatePath("/dashboard");
  if (firstSlug) revalidatePath(`/dashboard/m/${firstSlug}`);
  redirect(firstSlug ? `/dashboard/m/${firstSlug}` : "/dashboard");
}

export async function addFieldsToModule(
  tenantId: string,
  moduleSlug: string,
  fields: { name: string; slug: string; fieldType: string; isRequired?: boolean; settings?: { options?: string[]; targetModuleSlug?: string } }[]
) {
  await requireDashboardPermission(PERMISSIONS.modulesManage);
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) throw new Error("Module not found");
  const maxOrder = module_.fields.length > 0
    ? Math.max(...module_.fields.map((f) => f.sortOrder)) + 1
    : 0;
  const existingSlugs = new Set(module_.fields.map((f) => f.slug));
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    let slug = f.slug.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";
    let n = 0;
    while (existingSlugs.has(slug)) slug = `${f.slug}_${++n}`;
    existingSlugs.add(slug);
    const settings = (f.settings && Object.keys(f.settings).length > 0) ? (f.settings as object) : {};
    await prisma.field.create({
      data: {
        moduleId: module_.id,
        name: f.name,
        slug,
        fieldType: f.fieldType,
        isRequired: f.isRequired ?? false,
        sortOrder: maxOrder + i,
        settings,
      },
    });
  }
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  redirect(`/dashboard/m/${moduleSlug}`);
}

const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "tenant-user",
  "relation",
  "relation-multi",
  "file",
  "json",
  "activity",
] as const;

function applyHighlightRulesFromFormData(formData: FormData, mergedSettings: Record<string, unknown>): { error?: string } {
  if (!formData.has("highlightRulesJson")) return {};
  const parsed = parseHighlightRulesJsonField(formData.get("highlightRulesJson") as string | null);
  if (!parsed.ok) return { error: parsed.error };
  assignHighlightRulesToSettings(mergedSettings, parsed.rules);
  return {};
}

/** Date fields: `deadline` checkbox + optional `deadlineListDaysAhead` on field settings (not tenant). */
function mergeDateDeadlineFieldSettingsFromForm(
  formData: FormData,
  mergedSettings: Record<string, unknown>,
  fieldType: string
): void {
  if (fieldType !== "date") {
    delete mergedSettings.deadline;
    delete mergedSettings.deadlineListDaysAhead;
    return;
  }
  const on = formData.get("deadline") === "1" || formData.get("deadline") === "on";
  if (on) {
    mergedSettings.deadline = true;
    const raw = (formData.get("deadlineListDaysAhead") as string)?.trim();
    if (raw === "") {
      delete mergedSettings.deadlineListDaysAhead;
    } else {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0 && n <= 3650) mergedSettings.deadlineListDaysAhead = n;
    }
  } else {
    delete mergedSettings.deadline;
    delete mergedSettings.deadlineListDaysAhead;
  }
}

/** Add a single field to a module (from Manage fields UI). */
export async function addFieldToModule(moduleSlug: string, _prev: unknown, formData: FormData) {
  await requireDashboardPermission(PERMISSIONS.modulesManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) return { error: "Module not found." };
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Field name is required." };
  let slug = (formData.get("slug") as string)?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || name.toLowerCase().replace(/\s+/g, "_");
  const fieldType = (formData.get("fieldType") as string)?.trim();
  if (!fieldType || !FIELD_TYPES.includes(fieldType as (typeof FIELD_TYPES)[number])) return { error: "Valid field type is required." };
  const isRequired =
    fieldType === "activity"
      ? false
      : formData.get("isRequired") === "1" || formData.get("isRequired") === "on";
  const existingSlugs = new Set(module_.fields.map((f) => f.slug));
  let n = 0;
  while (existingSlugs.has(slug)) slug = `${slug}_${++n}`;
  const settings: Record<string, unknown> = {};
  if (fieldType === "select") {
    const opts = (formData.get("options") as string)?.trim();
    if (opts) settings.options = opts.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (fieldType === "relation" || fieldType === "relation-multi") {
    const target = (formData.get("targetModuleSlug") as string)?.trim();
    if (target) {
      settings.targetModuleSlug = target;
      const displayField = (formData.get("displayFieldSlug") as string)?.trim();
      if (displayField) settings.displayFieldSlug = displayField;
    }
    if (formData.get("showBacklinksOnTarget") === "1" || formData.get("showBacklinksOnTarget") === "on") {
      settings.showBacklinksOnTarget = true;
    }
  }
  if (fieldType === "activity") {
    const raw = (formData.get("activityLimit") as string)?.trim();
    if (raw !== "") {
      const lim = parseInt(raw, 10);
      if (Number.isFinite(lim) && lim >= 1 && lim <= ACTIVITY_FIELD_MAX_PREVIEW_LIMIT) settings.activityLimit = lim;
    }
  }
  settings.showInEntityList =
    formData.get("showInEntityList") === "1" || formData.get("showInEntityList") === "on";
  mergeDateDeadlineFieldSettingsFromForm(formData, settings, fieldType);
  const sortOrder = module_.fields.length > 0 ? Math.max(...module_.fields.map((f) => f.sortOrder)) + 1 : 0;
  await prisma.field.create({
    data: {
      moduleId: module_.id,
      name,
      slug,
      fieldType,
      isRequired,
      sortOrder,
      settings: Object.keys(settings).length > 0 ? (settings as object) : undefined,
    },
  });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  revalidatePath(`/dashboard/m/${moduleSlug}/fields`);
  redirect(`/dashboard/m/${moduleSlug}/fields`);
}

/** Update a field (name, type, required, settings). Slug cannot be changed. Type cannot be changed when records have values for this field. */
export async function updateFieldInModule(moduleSlug: string, fieldSlug: string, _prev: unknown, formData: FormData): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.modulesManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { where: { slug: fieldSlug } } },
  });
  if (!module_) return { error: "Module not found." };
  const field = module_.fields[0];
  if (!field) return { error: "Field not found." };
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Field name is required." };
  const fieldType = (formData.get("fieldType") as string)?.trim();
  if (!fieldType || !FIELD_TYPES.includes(fieldType as (typeof FIELD_TYPES)[number])) return { error: "Valid field type is required." };
  if (fieldType !== field.fieldType) {
    const rows = await prisma.$queryRaw<[{ count: bigint }]>(
      Prisma.sql`SELECT COUNT(*)::bigint as count FROM entities WHERE module_id = (${module_.id})::uuid AND deleted_at IS NULL AND ${sqlEntityDataKeyHasMeaningfulValue(fieldSlug)}`
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) {
      return {
        error: `Cannot change field type: ${count} record(s) still have a non-empty value for this field. Clear or migrate those values on each record, or ask a platform administrator for help.`,
      };
    }
  }
  const isRequired =
    fieldType === "activity"
      ? false
      : formData.get("isRequired") === "1" || formData.get("isRequired") === "on";
  const settings: Record<string, unknown> = {};
  if (fieldType === "select") {
    const opts = (formData.get("options") as string)?.trim();
    if (opts) settings.options = opts.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (fieldType === "relation" || fieldType === "relation-multi") {
    const target = (formData.get("targetModuleSlug") as string)?.trim();
    if (target) {
      settings.targetModuleSlug = target;
      const displayField = (formData.get("displayFieldSlug") as string)?.trim();
      if (displayField) settings.displayFieldSlug = displayField;
    }
    if (formData.get("showBacklinksOnTarget") === "1" || formData.get("showBacklinksOnTarget") === "on") {
      settings.showBacklinksOnTarget = true;
    }
  }
  const prevRaw = field.settings;
  const prev =
    prevRaw && typeof prevRaw === "object" && !Array.isArray(prevRaw)
      ? ({ ...(prevRaw as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const mergedSettings = { ...prev, ...settings } as Record<string, unknown>;
  mergedSettings.showInEntityList =
    formData.get("showInEntityList") === "1" || formData.get("showInEntityList") === "on";
  mergeDateDeadlineFieldSettingsFromForm(formData, mergedSettings, fieldType);
  if (fieldType !== "select") delete mergedSettings.options;
  if (fieldType === "activity") {
    const rawAct = (formData.get("activityLimit") as string)?.trim();
    if (rawAct === "") delete mergedSettings.activityLimit;
    else {
      const limAct = parseInt(rawAct, 10);
      if (Number.isFinite(limAct) && limAct >= 1 && limAct <= ACTIVITY_FIELD_MAX_PREVIEW_LIMIT) {
        mergedSettings.activityLimit = limAct;
      }
    }
  } else {
    delete mergedSettings.activityLimit;
  }
  const hlErr = applyHighlightRulesFromFormData(formData, mergedSettings);
  if (hlErr.error) return { error: hlErr.error };
  await prisma.field.update({
    where: { id: field.id },
    data: {
      name,
      fieldType,
      isRequired,
      settings: mergedSettings as object,
    },
  });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  revalidatePath(`/dashboard/m/${moduleSlug}/fields`);
  redirect(`/dashboard/m/${moduleSlug}/fields`);
}

/** Remove a field (fails if any entity has data for it). */
export async function removeFieldFromModule(moduleSlug: string, fieldSlug: string): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.modulesManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug },
    include: { fields: { where: { slug: fieldSlug } } },
  });
  if (!module_) return { error: "Module not found." };
  const field = module_.fields[0];
  if (!field) return { error: "Field not found." };
  const rows = await prisma.$queryRaw<[{ count: bigint }]>(
    Prisma.sql`SELECT COUNT(*)::bigint as count FROM entities WHERE module_id = (${module_.id})::uuid AND deleted_at IS NULL AND ${sqlEntityDataKeyHasMeaningfulValue(fieldSlug)}`
  );
  const entityCount = Number(rows[0]?.count ?? 0);
  if (entityCount > 0) {
    return {
      error: `Cannot remove: ${entityCount} record(s) still have a non-empty value for this field. Clear or migrate those values on every record, or ask a platform administrator for help.`,
    };
  }
  await prisma.field.delete({ where: { id: field.id } });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  revalidatePath(`/dashboard/m/${moduleSlug}/fields`);
  redirect(`/dashboard/m/${moduleSlug}/fields`);
}

/** Move a field up or down by one position. */
export async function reorderFieldInModule(moduleSlug: string, fieldSlug: string, direction: "up" | "down") {
  await requireDashboardPermission(PERMISSIONS.modulesManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) throw new Error("Unauthorized");
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) return { error: "Module not found." };
  const slugs = module_.fields.map((f) => f.slug);
  const fromIndex = slugs.indexOf(fieldSlug);
  if (fromIndex === -1) return { error: "Field not found." };
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  if (toIndex < 0 || toIndex >= slugs.length) return { error: "Already at boundary." };
  const reordered = [...slugs];
  const [removed] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, removed);
  for (let i = 0; i < reordered.length; i++) {
    const slug = reordered[i];
    const field = module_.fields.find((f) => f.slug === slug);
    if (field && field.sortOrder !== i) {
      await prisma.field.update({ where: { id: field.id }, data: { sortOrder: i } });
    }
  }
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  revalidatePath(`/dashboard/m/${moduleSlug}/fields`);
  redirect(`/dashboard/m/${moduleSlug}/fields`);
}

// -----------------------------------------------------------------------------
// Platform admin: modules & fields for another tenant (formData includes targetTenantId)
// -----------------------------------------------------------------------------

async function requirePlatformAdmin(): Promise<string> {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const { isPlatformAdmin } = await import("@/lib/developer-setup");
  if (!isPlatformAdmin(user?.email ?? null)) throw new Error("Only platform admins can edit another tenant's modules.");
  return userId;
}

function platformFieldsRedirect(targetTenantId: string, moduleSlug: string): string {
  return `/dashboard/platform/tenant/${targetTenantId}/modules/${moduleSlug}/fields`;
}

function platformModulesRedirect(targetTenantId: string): string {
  return `/dashboard/platform/tenant/${targetTenantId}/modules`;
}

/** Platform admin: create module. formData: targetTenantId, name, slug? */
export async function createModuleAsPlatformAdminFormAction(prev: unknown, formData: FormData): Promise<unknown> {
  try {
    await requirePlatformAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  if (!targetTenantId || !name) return { error: "Missing target tenant or module name." };
  let slug = (formData.get("slug") as string)?.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "");
  if (!slug) slug = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]+/g, "_");
  const existing = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug },
    select: { id: true },
  });
  if (existing) return { error: `A module with slug "${slug}" already exists for this tenant.` };
  const maxOrder = await prisma.module.findMany({
    where: { tenantId: targetTenantId },
    orderBy: { sortOrder: "desc" },
    take: 1,
    select: { sortOrder: true },
  });
  await prisma.module.create({
    data: {
      tenantId: targetTenantId,
      name,
      slug,
      sortOrder: (maxOrder[0]?.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath(platformModulesRedirect(targetTenantId));
  redirect(platformModulesRedirect(targetTenantId));
}

/**
 * Platform admin: change module display name and URL slug.
 * formData: targetTenantId, moduleSlug (current), name, slug (desired slug, normalized).
 * Changing slug breaks relation fields that still reference the old targetModuleSlug until those fields are updated.
 */
export async function updateModuleIdentityAsPlatformAdminFormAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  try {
    await requirePlatformAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const currentSlug = (formData.get("moduleSlug") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();
  const slugRaw = (formData.get("slug") as string)?.trim();
  if (!targetTenantId || !currentSlug) return { error: "Missing tenant or module." };
  if (!name) return { error: "Module name is required." };
  let newSlug =
    slugRaw
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_|_$/g, "") || "";
  if (!newSlug) return { error: "Module slug is required (letters, numbers, underscores)." };

  const module_ = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug: currentSlug },
    select: { id: true, slug: true },
  });
  if (!module_) return { error: "Module not found." };

  if (newSlug !== currentSlug) {
    const clash = await prisma.module.findFirst({
      where: { tenantId: targetTenantId, slug: newSlug, id: { not: module_.id } },
      select: { id: true },
    });
    if (clash) return { error: `Another module already uses slug "${newSlug}".` };
  }

  await prisma.module.update({
    where: { id: module_.id },
    data: { name, slug: newSlug },
  });

  revalidatePath(platformModulesRedirect(targetTenantId));
  revalidatePath(platformFieldsRedirect(targetTenantId, currentSlug));
  revalidatePath(platformFieldsRedirect(targetTenantId, newSlug));
  revalidatePath(`/dashboard/m/${currentSlug}`, "layout");
  revalidatePath(`/dashboard/m/${newSlug}`, "layout");

  redirect(platformFieldsRedirect(targetTenantId, newSlug));
}

/** Platform admin: disable module (set isActive false). formData: targetTenantId, moduleSlug. Accepts (formData) or (prev, formData). */
export async function disableModuleAsPlatformAdminFormAction(prevOrFormData: unknown, formDataArg?: FormData) {
  const formData = formDataArg instanceof FormData ? formDataArg : (prevOrFormData as FormData);
  await requirePlatformAdmin();
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  if (!targetTenantId || !moduleSlug) throw new Error("Missing target tenant or module.");
  const module_ = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug: moduleSlug },
    select: { id: true },
  });
  if (!module_) throw new Error("Module not found.");
  await prisma.module.update({ where: { id: module_.id }, data: { isActive: false } });
  revalidatePath(platformModulesRedirect(targetTenantId));
  redirect(platformModulesRedirect(targetTenantId));
}

/** Platform admin: enable module (set isActive true). formData: targetTenantId, moduleSlug. Accepts (formData) or (prev, formData). */
export async function enableModuleAsPlatformAdminFormAction(prevOrFormData: unknown, formDataArg?: FormData) {
  const formData = formDataArg instanceof FormData ? formDataArg : (prevOrFormData as FormData);
  await requirePlatformAdmin();
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  if (!targetTenantId || !moduleSlug) throw new Error("Missing target tenant or module.");
  const module_ = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug: moduleSlug },
    select: { id: true },
  });
  if (!module_) throw new Error("Module not found.");
  await prisma.module.update({ where: { id: module_.id }, data: { isActive: true } });
  revalidatePath(platformModulesRedirect(targetTenantId));
  redirect(platformModulesRedirect(targetTenantId));
}

/** Platform admin: delete module (fails if module has entities). formData: targetTenantId, moduleSlug. Accepts (formData) or (prev, formData). */
export async function deleteModuleAsPlatformAdminFormAction(prevOrFormData: unknown, formDataArg?: FormData) {
  const formData = formDataArg instanceof FormData ? formDataArg : (prevOrFormData as FormData);
  await requirePlatformAdmin();
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  if (!targetTenantId || !moduleSlug) throw new Error("Missing target tenant or module.");
  const module_ = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug: moduleSlug },
    select: { id: true },
  });
  if (!module_) throw new Error("Module not found.");
  const entityCount = await prisma.entity.count({ where: { moduleId: module_.id } });
  if (entityCount > 0) {
    throw new Error(`Cannot delete: module has ${entityCount} record(s). Delete or move the records first.`);
  }
  await prisma.module.delete({ where: { id: module_.id } });
  revalidatePath(platformModulesRedirect(targetTenantId));
  redirect(platformModulesRedirect(targetTenantId));
}

/** Platform admin (current tenant session): restore soft-deleted entity without tenant entities:write. */
export async function restoreEntityAsPlatformAdmin(
  entityId: string,
  moduleSlug: string
): Promise<{ error?: string }> {
  try {
    await requirePlatformAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    select: { id: true },
  });
  if (!module_) return { error: "Module not found." };
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, moduleId: module_.id, deletedAt: { not: null } },
    select: { id: true },
  });
  if (!entity) return { error: "Entity not found or not deleted." };
  await prisma.entity.update({
    where: { id: entityId },
    data: { deletedAt: null },
  });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  revalidatePath(`/dashboard/m/${moduleSlug}/${entityId}`);
  redirect(`/dashboard/m/${moduleSlug}`);
}

/**
 * Platform admin (current tenant session): remove the entity row permanently.
 * Blocked when order lines, payments, or ledger account lines reference this entity.
 */
export async function hardDeleteEntityAsPlatformAdmin(
  entityId: string,
  moduleSlug: string
): Promise<{ error?: string }> {
  try {
    await requirePlatformAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    select: { id: true },
  });
  if (!module_) return { error: "Module not found." };
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, tenantId, moduleId: module_.id },
    select: { id: true },
  });
  if (!entity) return { error: "Entity not found." };

  const ticketsSold = await prisma.orderLine.count({ where: { entityId } });
  if (ticketsSold > 0) {
    return {
      error:
        "Cannot permanently delete: order lines exist (e.g. tickets sold). Resolve orders first.",
    };
  }
  const payments = await prisma.payment.count({ where: { entityId } });
  if (payments > 0) {
    return { error: "Cannot permanently delete: payment records are linked to this entity." };
  }
  const ledgerAccounts = await prisma.ledgerLine.count({ where: { accountEntityId: entityId } });
  if (ledgerAccounts > 0) {
    return {
      error:
        "Cannot permanently delete: this entity is used as a ledger account. Remove or reassign ledger lines first.",
    };
  }

  const userId = (await headers()).get("x-user-id");
  const hardDeleteActor = await entityEventActorPayload(userId);
  await prisma.event.create({
    data: {
      tenantId,
      entityId,
      eventType: "entity_hard_deleted",
      data: { moduleSlug, ...hardDeleteActor } as object,
      createdBy: userId,
    },
  });
  try {
    await prisma.entity.delete({ where: { id: entityId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return {
        error:
          "Database refused delete (record is still referenced). Remove related data or contact support.",
      };
    }
    throw e;
  }
  const { fireWebhook } = await import("@/lib/webhooks");
  fireWebhook(tenantId, "entity.permanently_deleted", { entityId, moduleSlug });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  revalidatePath(`/dashboard/m/${moduleSlug}/${entityId}`);
  redirect(`/dashboard/m/${moduleSlug}?success=hard_deleted`);
}

/** Platform admin: add field. formData: targetTenantId, moduleSlug, name, slug?, fieldType, isRequired?, options?, targetModuleSlug? */
export async function addFieldToModuleAsPlatformAdminFormAction(_prev: unknown, formData: FormData) {
  await requirePlatformAdmin();
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  if (!targetTenantId || !moduleSlug) throw new Error("Missing target tenant or module.");
  const module_ = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) throw new Error("Module not found.");
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Field name is required." };
  let slug = (formData.get("slug") as string)?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || name.toLowerCase().replace(/\s+/g, "_");
  const fieldType = (formData.get("fieldType") as string)?.trim();
  if (!fieldType || !FIELD_TYPES.includes(fieldType as (typeof FIELD_TYPES)[number])) return { error: "Valid field type is required." };
  const isRequired =
    fieldType === "activity"
      ? false
      : formData.get("isRequired") === "1" || formData.get("isRequired") === "on";
  const existingSlugs = new Set(module_.fields.map((f) => f.slug));
  let n = 0;
  while (existingSlugs.has(slug)) slug = `${slug}_${++n}`;
  const settings: Record<string, unknown> = {};
  if (fieldType === "select") {
    const opts = (formData.get("options") as string)?.trim();
    if (opts) settings.options = opts.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (fieldType === "relation" || fieldType === "relation-multi") {
    const target = (formData.get("targetModuleSlug") as string)?.trim();
    if (target) {
      settings.targetModuleSlug = target;
      const displayField = (formData.get("displayFieldSlug") as string)?.trim();
      if (displayField) settings.displayFieldSlug = displayField;
    }
    if (formData.get("showBacklinksOnTarget") === "1" || formData.get("showBacklinksOnTarget") === "on") {
      settings.showBacklinksOnTarget = true;
    }
  }
  if (fieldType === "activity") {
    const raw = (formData.get("activityLimit") as string)?.trim();
    if (raw !== "") {
      const lim = parseInt(raw, 10);
      if (Number.isFinite(lim) && lim >= 1 && lim <= ACTIVITY_FIELD_MAX_PREVIEW_LIMIT) settings.activityLimit = lim;
    }
  }
  settings.showInEntityList =
    formData.get("showInEntityList") === "1" || formData.get("showInEntityList") === "on";
  mergeDateDeadlineFieldSettingsFromForm(formData, settings, fieldType);
  const sortOrder = module_.fields.length > 0 ? Math.max(...module_.fields.map((f) => f.sortOrder)) + 1 : 0;
  await prisma.field.create({
    data: {
      moduleId: module_.id,
      name,
      slug,
      fieldType,
      isRequired,
      sortOrder,
      settings: Object.keys(settings).length > 0 ? (settings as object) : undefined,
    },
  });
  revalidatePath(platformFieldsRedirect(targetTenantId, moduleSlug));
  redirect(platformFieldsRedirect(targetTenantId, moduleSlug));
}

/** Platform admin: update field. formData: targetTenantId, moduleSlug, fieldSlug, name, fieldType, isRequired?, options?, targetModuleSlug?. Type cannot be changed when records have values. Accepts (formData) or (prev, formData). */
export async function updateFieldInModuleAsPlatformAdminFormAction(prevOrFormData: unknown, formDataArg?: FormData): Promise<{ error?: string }> {
  const formData = formDataArg instanceof FormData ? formDataArg : (prevOrFormData as FormData);
  try {
    await requirePlatformAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  const fieldSlug = (formData.get("fieldSlug") as string)?.trim();
  if (!targetTenantId || !moduleSlug || !fieldSlug) return { error: "Missing target tenant, module, or field." };
  const module_ = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug: moduleSlug, isActive: true },
    include: { fields: { where: { slug: fieldSlug } } },
  });
  if (!module_) return { error: "Module not found." };
  const field = module_.fields[0];
  if (!field) return { error: "Field not found." };
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Field name is required." };
  const fieldType = (formData.get("fieldType") as string)?.trim();
  if (!fieldType || !FIELD_TYPES.includes(fieldType as (typeof FIELD_TYPES)[number])) return { error: "Valid field type is required." };
  if (fieldType !== field.fieldType) {
    const rows = await prisma.$queryRaw<[{ count: bigint }]>(
      Prisma.sql`SELECT COUNT(*)::bigint as count FROM entities WHERE module_id = (${module_.id})::uuid AND deleted_at IS NULL AND ${sqlEntityDataKeyHasMeaningfulValue(fieldSlug)}`
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) {
      return {
        error: `Cannot change field type: ${count} record(s) still have a non-empty value for this field. On this screen, use "Clear values" for this field first, or migrate data.`,
      };
    }
  }
  const isRequired =
    fieldType === "activity"
      ? false
      : formData.get("isRequired") === "1" || formData.get("isRequired") === "on";
  const settings: Record<string, unknown> = {};
  if (fieldType === "select") {
    const opts = (formData.get("options") as string)?.trim();
    if (opts) settings.options = opts.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (fieldType === "relation" || fieldType === "relation-multi") {
    const target = (formData.get("targetModuleSlug") as string)?.trim();
    if (target) {
      settings.targetModuleSlug = target;
      const displayField = (formData.get("displayFieldSlug") as string)?.trim();
      if (displayField) settings.displayFieldSlug = displayField;
    }
    if (formData.get("showBacklinksOnTarget") === "1" || formData.get("showBacklinksOnTarget") === "on") {
      settings.showBacklinksOnTarget = true;
    }
  }
  const prevRawPlatform = field.settings;
  const prevPlatform =
    prevRawPlatform && typeof prevRawPlatform === "object" && !Array.isArray(prevRawPlatform)
      ? ({ ...(prevRawPlatform as Record<string, unknown>) } as Record<string, unknown>)
      : {};
  const mergedSettingsPlatform = { ...prevPlatform, ...settings } as Record<string, unknown>;
  mergedSettingsPlatform.showInEntityList =
    formData.get("showInEntityList") === "1" || formData.get("showInEntityList") === "on";
  mergeDateDeadlineFieldSettingsFromForm(formData, mergedSettingsPlatform, fieldType);
  if (fieldType !== "select") delete mergedSettingsPlatform.options;
  if (fieldType === "activity") {
    const rawPl = (formData.get("activityLimit") as string)?.trim();
    if (rawPl === "") delete mergedSettingsPlatform.activityLimit;
    else {
      const limPl = parseInt(rawPl, 10);
      if (Number.isFinite(limPl) && limPl >= 1 && limPl <= ACTIVITY_FIELD_MAX_PREVIEW_LIMIT) {
        mergedSettingsPlatform.activityLimit = limPl;
      }
    }
  } else {
    delete mergedSettingsPlatform.activityLimit;
  }
  const hlErrPlatform = applyHighlightRulesFromFormData(formData, mergedSettingsPlatform);
  if (hlErrPlatform.error) return { error: hlErrPlatform.error };
  await prisma.field.update({
    where: { id: field.id },
    data: { name, fieldType, isRequired, settings: mergedSettingsPlatform as object },
  });
  revalidatePath(platformFieldsRedirect(targetTenantId, moduleSlug));
  redirect(platformFieldsRedirect(targetTenantId, moduleSlug));
}

/** Platform admin: remove field. formData: targetTenantId, moduleSlug, fieldSlug. Returns { error } when records have data. Accepts (formData) or (prev, formData). */
export async function removeFieldFromModuleAsPlatformAdminFormAction(
  prevOrFormData: unknown,
  formDataArg?: FormData
): Promise<{ error?: string }> {
  const formData = formDataArg instanceof FormData ? formDataArg : (prevOrFormData as FormData);
  try {
    await requirePlatformAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  const fieldSlug = (formData.get("fieldSlug") as string)?.trim();
  if (!targetTenantId || !moduleSlug || !fieldSlug) return { error: "Missing target tenant, module, or field." };
  const module_ = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug: moduleSlug },
    include: { fields: { where: { slug: fieldSlug } } },
  });
  if (!module_) return { error: "Module not found." };
  const field = module_.fields[0];
  if (!field) return { error: "Field not found." };
  const rows = await prisma.$queryRaw<[{ count: bigint }]>(
    Prisma.sql`SELECT COUNT(*)::bigint as count FROM entities WHERE module_id = (${module_.id})::uuid AND deleted_at IS NULL AND ${sqlEntityDataKeyHasMeaningfulValue(fieldSlug)}`
  );
  const count = Number(rows[0]?.count ?? 0);
  if (count > 0) {
    return {
      error: `Cannot remove: ${count} record(s) still have a non-empty value for this field. On this screen, use "Clear values" for this field first.`,
    };
  }
  await prisma.field.delete({ where: { id: field.id } });
  revalidatePath(platformFieldsRedirect(targetTenantId, moduleSlug));
  redirect(platformFieldsRedirect(targetTenantId, moduleSlug));
}

/** Platform admin: clear a field’s key from every entity row in the module (including soft-deleted), then refresh search_text. formData: targetTenantId, moduleSlug, fieldSlug. */
export async function clearModuleFieldValuesForAllEntitiesAsPlatformAdminFormAction(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; cleared?: number }> {
  try {
    await requirePlatformAdmin();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  const fieldSlug = (formData.get("fieldSlug") as string)?.trim();
  if (!targetTenantId || !moduleSlug || !fieldSlug) return { error: "Missing target tenant, module, or field." };
  const module_ = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug: moduleSlug, isActive: true },
    include: { fields: { where: { slug: fieldSlug } } },
  });
  if (!module_) return { error: "Module not found." };
  const field = module_.fields[0];
  if (!field) return { error: "Field not found." };

  const updatedRows = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE entities
      SET data = data - ${fieldSlug}
      WHERE tenant_id = ${targetTenantId}::uuid
        AND module_id = ${module_.id}::uuid
        AND (data ? ${fieldSlug})
    `
  );
  const cleared = typeof updatedRows === "number" ? updatedRows : 0;

  const { buildSearchText } = await import("@/lib/search-text");
  const pageSize = 200;
  let skip = 0;
  for (;;) {
    const batch = await prisma.entity.findMany({
      where: { tenantId: targetTenantId, moduleId: module_.id },
      select: { id: true, data: true },
      take: pageSize,
      skip,
      orderBy: { id: "asc" },
    });
    if (batch.length === 0) break;
    for (const e of batch) {
      const data = (e.data as Record<string, unknown>) ?? {};
      const searchText = buildSearchText(module_.name, data) || null;
      await prisma.entity.update({
        where: { id: e.id },
        data: { searchText },
      });
    }
    skip += pageSize;
  }

  revalidatePath(platformFieldsRedirect(targetTenantId, moduleSlug));
  return { cleared };
}

/** Platform admin: reorder field. formData: targetTenantId, moduleSlug, fieldSlug, direction (up|down). Accepts (formData) or (prev, formData). */
export async function reorderFieldInModuleAsPlatformAdminFormAction(prevOrFormData: unknown, formDataArg?: FormData) {
  const formData = formDataArg instanceof FormData ? formDataArg : (prevOrFormData as FormData);
  await requirePlatformAdmin();
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  const moduleSlug = (formData.get("moduleSlug") as string)?.trim();
  const fieldSlug = (formData.get("fieldSlug") as string)?.trim();
  const direction = (formData.get("direction") as string) === "up" ? "up" : "down";
  if (!targetTenantId || !moduleSlug || !fieldSlug) throw new Error("Missing target tenant, module, or field.");
  const module_ = await prisma.module.findFirst({
    where: { tenantId: targetTenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) throw new Error("Module not found.");
  const slugs = module_.fields.map((f) => f.slug);
  const fromIndex = slugs.indexOf(fieldSlug);
  if (fromIndex === -1) throw new Error("Field not found.");
  const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
  if (toIndex < 0 || toIndex >= slugs.length) throw new Error("Already at boundary.");
  const reordered = [...slugs];
  const [removed] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, removed);
  for (let i = 0; i < reordered.length; i++) {
    const slug = reordered[i];
    const f = module_.fields.find((x) => x.slug === slug);
    if (f && f.sortOrder !== i) {
      await prisma.field.update({ where: { id: f.id }, data: { sortOrder: i } });
    }
  }
  revalidatePath(platformFieldsRedirect(targetTenantId, moduleSlug));
  redirect(platformFieldsRedirect(targetTenantId, moduleSlug));
}

/** Unified AI: one prompt → create module, add fields, create view, enable public, set home, create entity, update/delete view, rename module, remove field, reorder. */
export async function handleAiPrompt(tenantId: string, _prev: unknown, formData: FormData) {
  const prompt = (formData.get("prompt") as string)?.trim();
  if (!prompt) return { error: "Describe what you want: create a module, add fields, create a view, show module on public site, set default home, add a record, edit/delete view, rename module, remove field, or reorder sidebar." };

  const modules = await prisma.module.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      fields: { orderBy: { sortOrder: "asc" }, select: { slug: true } },
      views: { select: { id: true, name: true } },
    },
  });
  const existingSlugs = modules.map((m) => m.slug);
  const moduleContext = modules.map((m) => ({
    slug: m.slug,
    name: m.name,
    fieldSlugs: [...m.fields.map((f) => f.slug), "createdAt"],
    views: m.views.map((v) => ({ id: v.id, name: v.name })),
    isActive: m.isActive,
  }));

  const { parseDashboardIntent } = await import("@/lib/ai");
  let intent: Awaited<ReturnType<typeof parseDashboardIntent>>;
  try {
    intent = await parseDashboardIntent(prompt, moduleContext, existingSlugs);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }

  if (intent.intent === "similar_module_exists") {
    const { existing } = intent.payload;
    return {
      error: `A module "${existing.name}" already exists. To add to it, say "add [field name] to ${existing.name}". To create a different module, use a distinct name.`,
    };
  }

  if (intent.intent === "create_module") {
    await requireDashboardPermission(PERMISSIONS.modulesManage);
    const suggestion = intent.payload;
    const similar = modules.find(
      (m) =>
        suggestion.slug === m.slug ||
        suggestion.name.toLowerCase() === m.name.toLowerCase() ||
        (suggestion.slug.replace(/s$/, "") === m.slug.replace(/s$/, "") && suggestion.slug.replace(/s$/, "").length >= 2)
    );
    if (similar) {
      return {
        error: `A module "${similar.name}" already exists. To add to it, say "add [field name] to ${similar.name}". To create a new module, use a different name.`,
      };
    }
    const maxOrder = await prisma.module
      .aggregate({ where: { tenantId }, _max: { sortOrder: true } })
      .then((r) => r._max.sortOrder ?? -1);
    const module_ = await prisma.module.create({
      data: {
        tenantId,
        name: suggestion.name,
        slug: suggestion.slug,
        description: suggestion.description ?? null,
        sortOrder: maxOrder + 1,
      },
    });
    for (let i = 0; i < suggestion.fields.length; i++) {
      const f = suggestion.fields[i];
      const settings = (f.settings && Object.keys(f.settings).length > 0) ? (f.settings as object) : {};
      await prisma.field.create({
        data: {
          moduleId: module_.id,
          name: f.name,
          slug: f.slug,
          fieldType: f.fieldType,
          isRequired: f.isRequired ?? false,
          sortOrder: i,
          settings,
        },
      });
    }
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/m/${module_.slug}`);
    redirect(`/dashboard/m/${module_.slug}`);
  }

  if (intent.intent === "add_fields") {
    await requireDashboardPermission(PERMISSIONS.modulesManage);
    const { moduleSlug, fields } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    await addFieldsToModule(tenantId, moduleSlug, fields);
    return;
  }

  if (intent.intent === "create_view") {
    await requireDashboardPermission(PERMISSIONS.viewsManage);
    const { moduleSlug, view } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const viewType = view.viewType === "board" || view.viewType === "calendar" ? view.viewType : "list";
    await prisma.view.create({
      data: {
        tenantId,
        moduleId: module_.id,
        name: view.name,
        viewType,
        filter: (view.filter ?? []) as object,
        sort: (view.sort ?? []) as object,
        columns: (view.columns ?? []) as object,
      },
    });
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "enable_public_module") {
    await requireDashboardPermission(PERMISSIONS.settingsManage);
    const { moduleSlug } = intent.payload;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (tenant?.settings as Record<string, unknown>) ?? {};
    const site = (settings.site as Record<string, unknown>) ?? {};
    const publicModules = (site.publicModules as Record<string, { slug: string; showInNav: boolean }>) ?? {};
    publicModules[moduleSlug] = { slug: moduleSlug, showInNav: true };
    site.publicModules = publicModules;
    settings.site = site;
    await prisma.tenant.update({ where: { id: tenantId }, data: { settings: settings as object } });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    redirect("/dashboard/settings?success=saved");
  }

  if (intent.intent === "disable_public_module") {
    await requireDashboardPermission(PERMISSIONS.settingsManage);
    const { moduleSlug } = intent.payload;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (tenant?.settings as Record<string, unknown>) ?? {};
    const site = (settings.site as Record<string, unknown>) ?? {};
    const publicModules = (site.publicModules as Record<string, { slug: string; showInNav: boolean }>) ?? {};
    delete publicModules[moduleSlug];
    site.publicModules = Object.keys(publicModules).length > 0 ? publicModules : undefined;
    settings.site = site;
    await prisma.tenant.update({ where: { id: tenantId }, data: { settings: settings as object } });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    redirect("/dashboard/settings?success=saved");
  }

  if (intent.intent === "set_default_home") {
    await requireDashboardPermission(PERMISSIONS.settingsManage);
    const payload = intent.payload;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (tenant?.settings as Record<string, unknown>) ?? {};
    const dashboard = (settings.dashboard as Record<string, unknown>) ?? {};
    if (payload.type === "module") {
      dashboard.home = { type: "module", moduleSlug: payload.moduleSlug };
    } else {
      const mod = modules.find((m) => m.slug === payload.moduleSlug);
      let viewId = payload.viewId;
      if (!viewId && payload.viewName && mod) {
        const v = mod.views?.find((v) => v.name.toLowerCase() === payload.viewName!.toLowerCase());
        viewId = v?.id;
      }
      if (viewId) dashboard.home = { type: "view", moduleSlug: payload.moduleSlug, viewId };
      else dashboard.home = { type: "module", moduleSlug: payload.moduleSlug };
    }
    settings.dashboard = dashboard;
    await prisma.tenant.update({ where: { id: tenantId }, data: { settings: settings as object } });
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  if (intent.intent === "create_entity") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { moduleSlug, data } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const searchText = Object.values(data).filter((v) => typeof v === "string" && v).join(" ");
    const userId = (await headers()).get("x-user-id");
    await prisma.entity.create({
      data: {
        tenantId,
        moduleId: module_.id,
        data: data as object,
        searchText: searchText != null ? searchText.slice(0, 10000) : null,
        createdBy: userId,
      },
    });
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "create_entities") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { moduleSlug, data: dataList } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const userId = (await headers()).get("x-user-id");
    for (const data of dataList) {
      const searchText = Object.values(data).filter((v) => typeof v === "string" && v).join(" ");
      await prisma.entity.create({
        data: {
          tenantId,
          moduleId: module_.id,
          data: data as object,
          searchText: searchText != null ? searchText.slice(0, 10000) : null,
          createdBy: userId,
        },
      });
    }
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "update_view") {
    await requireDashboardPermission(PERMISSIONS.viewsManage);
    const { moduleSlug, viewId, viewName, view: viewUpdates } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    let targetViewId = viewId;
    if (!targetViewId && viewName) {
      const v = module_.views?.find((v) => v.name.toLowerCase() === viewName.toLowerCase());
      targetViewId = v?.id;
    }
    if (!targetViewId) return { error: "View not found." };
    const existing = await prisma.view.findFirst({ where: { id: targetViewId, tenantId } });
    if (!existing) return { error: "View not found." };
    const data: { name?: string; viewType?: string; filter?: object; sort?: object; columns?: object } = {};
    if (viewUpdates.name !== undefined) data.name = viewUpdates.name;
    if (viewUpdates.viewType !== undefined && ["list", "board", "calendar"].includes(viewUpdates.viewType)) data.viewType = viewUpdates.viewType;
    if (viewUpdates.filter !== undefined) data.filter = viewUpdates.filter as object;
    if (viewUpdates.sort !== undefined) data.sort = viewUpdates.sort as object;
    if (viewUpdates.columns !== undefined) data.columns = viewUpdates.columns as object;
    if (Object.keys(data).length > 0) {
      await prisma.view.update({ where: { id: targetViewId }, data });
    }
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}?view=${targetViewId}`);
  }

  if (intent.intent === "delete_view") {
    await requireDashboardPermission(PERMISSIONS.viewsManage);
    const { moduleSlug, viewId, viewName } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    let targetViewId = viewId;
    if (!targetViewId && viewName) {
      const v = module_.views?.find((v) => v.name.toLowerCase() === viewName.toLowerCase());
      targetViewId = v?.id;
    }
    if (!targetViewId) return { error: "View not found." };
    const existing = await prisma.view.findFirst({ where: { id: targetViewId, tenantId } });
    if (!existing) return { error: "View not found." };
    await prisma.view.delete({ where: { id: targetViewId } });
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "rename_module") {
    await requireDashboardPermission(PERMISSIONS.modulesManage);
    const { moduleSlug, name, description } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const data: { name?: string; description?: string | null } = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description || null;
    if (Object.keys(data).length > 0) {
      await prisma.module.update({ where: { id: module_.id }, data });
    }
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect("/dashboard");
  }

  if (intent.intent === "remove_field") {
    await requireDashboardPermission(PERMISSIONS.modulesManage);
    const { moduleSlug, fieldSlug } = intent.payload;
    const module_ = await prisma.module.findFirst({
      where: { tenantId, slug: moduleSlug },
      include: { fields: { where: { slug: fieldSlug } } },
    });
    if (!module_) return { error: "Module not found." };
    const field = module_.fields[0];
    if (!field) return { error: "Field not found." };
    // Block delete if any entity in this module has data for this field (JSONB key exists)
    const rows = await prisma.$queryRaw<[{ count: bigint }]>(
      Prisma.sql`SELECT COUNT(*)::bigint as count FROM entities WHERE module_id = (${module_.id})::uuid AND deleted_at IS NULL AND ${sqlEntityDataKeyHasMeaningfulValue(fieldSlug)}`
    );
    const entityCount = Number(rows[0]?.count ?? 0);
    if (entityCount > 0) {
      return {
        error: `Cannot remove this field because ${entityCount} record(s) still have a non-empty value. Clear or migrate those values on every record, or ask a platform administrator for help.`,
      };
    }
    await prisma.field.delete({ where: { id: field.id } });
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "reorder_fields") {
    await requireDashboardPermission(PERMISSIONS.modulesManage);
    const { moduleSlug, fieldSlug, beforeFieldSlug, afterFieldSlug } = intent.payload;
    const module_ = await prisma.module.findFirst({
      where: { tenantId, slug: moduleSlug, isActive: true },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    });
    if (!module_) return { error: "Module not found." };
    const slugs = module_.fields.map((f) => f.slug);
    const fromIndex = slugs.indexOf(fieldSlug);
    if (fromIndex === -1) return { error: `Field "${fieldSlug}" not found in ${module_.name}.` };
    let toIndex: number;
    if (beforeFieldSlug !== undefined) {
      const idx = slugs.indexOf(beforeFieldSlug);
      if (idx === -1) return { error: `Field "${beforeFieldSlug}" not found in ${module_.name}.` };
      toIndex = fromIndex < idx ? idx - 1 : idx;
    } else if (afterFieldSlug !== undefined) {
      const idx = slugs.indexOf(afterFieldSlug);
      if (idx === -1) return { error: `Field "${afterFieldSlug}" not found in ${module_.name}.` };
      toIndex = fromIndex > idx ? idx + 1 : idx;
    } else {
      return { error: "Specify before or after which field to move." };
    }
    const reordered = [...slugs];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    for (let i = 0; i < reordered.length; i++) {
      const slug = reordered[i];
      const field = module_.fields.find((f) => f.slug === slug);
      if (field && field.sortOrder !== i) {
        await prisma.field.update({ where: { id: field.id }, data: { sortOrder: i } });
      }
    }
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "reorder_modules") {
    await requireDashboardPermission(PERMISSIONS.settingsManage);
    const { moduleSlugs } = intent.payload;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (tenant?.settings as Record<string, unknown>) ?? {};
    const dashboard = (settings.dashboard as Record<string, unknown>) ?? {};
    dashboard.sidebarOrder = moduleSlugs;
    settings.dashboard = dashboard;
    await prisma.tenant.update({ where: { id: tenantId }, data: { settings: settings as object } });
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  if (intent.intent === "delete_entity") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { moduleSlug, entityRef } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const match = await findEntityByRef(tenantId, module_.id, entityRef, module_.fields, false);
    if (!match) return { error: `No record in ${module_.name} matching "${entityRef}". Try being more specific or delete from the list view.` };
    const result = await deleteEntity(match.id, moduleSlug);
    if (result?.error) return { error: result.error };
  }

  if (intent.intent === "update_entity") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { moduleSlug, entityRef, data: patch } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const match = await findEntityByRef(tenantId, module_.id, entityRef, module_.fields, false);
    if (!match) return { error: `No record in ${module_.name} matching "${entityRef}".` };
    const current = (match.data as Record<string, unknown>) ?? {};
    const next = { ...current, ...patch };
    const searchText = Object.values(next).filter((v) => typeof v === "string" && v).join(" ");
    await prisma.entity.update({
      where: { id: match.id },
      data: { data: next as object, searchText: searchText != null ? searchText.slice(0, 10000) : null, updatedAt: new Date() },
    });
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "restore_entity") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { moduleSlug, entityRef } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const match = await findEntityByRef(tenantId, module_.id, entityRef, module_.fields, true, true);
    if (!match) return { error: `No deleted record in ${module_.name} matching "${entityRef}".` };
    await prisma.entity.update({ where: { id: match.id }, data: { deletedAt: null } });
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}?success=restored`);
  }

  if (intent.intent === "duplicate_entity") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { moduleSlug, entityRef, data: overrides } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const match = await findEntityByRef(tenantId, module_.id, entityRef, module_.fields, false);
    if (!match) return { error: `No record in ${module_.name} matching "${entityRef}".` };
    const current = (match.data as Record<string, unknown>) ?? {};
    const next = { ...current, ...(overrides ?? {}) };
    const searchText = Object.values(next).filter((v) => typeof v === "string" && v).join(" ");
    const userId = (await headers()).get("x-user-id");
    await prisma.entity.create({
      data: {
        tenantId,
        moduleId: module_.id,
        data: next as object,
        searchText: searchText != null ? searchText.slice(0, 10000) : null,
        createdBy: userId,
      },
    });
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "create_relationship") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { sourceModuleSlug, sourceEntityRef, targetModuleSlug, targetEntityRef, relationType } = intent.payload;
    const srcMod = modules.find((m) => m.slug === sourceModuleSlug);
    const tgtMod = modules.find((m) => m.slug === targetModuleSlug);
    if (!srcMod) return { error: "Source module not found." };
    if (!tgtMod) return { error: "Target module not found." };
    const source = await findEntityByRef(tenantId, srcMod.id, sourceEntityRef, srcMod.fields, false);
    const target = await findEntityByRef(tenantId, tgtMod.id, targetEntityRef, tgtMod.fields, false);
    if (!source) return { error: `No record in ${srcMod.name} matching "${sourceEntityRef}".` };
    if (!target) return { error: `No record in ${tgtMod.name} matching "${targetEntityRef}".` };
    await prisma.relationship.create({
      data: { tenantId, sourceId: source.id, targetId: target.id, relationType },
    });
    revalidatePath(`/dashboard/m/${sourceModuleSlug}`);
    revalidatePath(`/dashboard/m/${targetModuleSlug}`);
    redirect(`/dashboard/m/${sourceModuleSlug}`);
  }

  if (intent.intent === "add_tag_entity") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { moduleSlug, entityRef, tag } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const match = await findEntityByRef(tenantId, module_.id, entityRef, module_.fields, false);
    if (!match) return { error: `No record in ${module_.name} matching "${entityRef}".` };
    const existing = await prisma.entityTag.findFirst({ where: { tenantId, entityId: match.id, tag } });
    if (!existing) await prisma.entityTag.create({ data: { tenantId, entityId: match.id, tag } });
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "remove_tag_entity") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { moduleSlug, entityRef, tag } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const match = await findEntityByRef(tenantId, module_.id, entityRef, module_.fields, false);
    if (!match) return { error: `No record in ${module_.name} matching "${entityRef}".` };
    await prisma.entityTag.deleteMany({ where: { tenantId, entityId: match.id, tag } });
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "bulk_update_entities") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { moduleSlug, filter: filterList, data: patch } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const fieldSlugs = new Set(module_.fields.map((f) => f.slug));
    const entities = await prisma.entity.findMany({
      where: { tenantId, moduleId: module_.id, deletedAt: null },
      select: { id: true, data: true, createdAt: true },
    });
    const matched = filterEntitiesByConditions(entities, filterList);
    for (const e of matched) {
      const current = (e.data as Record<string, unknown>) ?? {};
      const next = { ...current };
      for (const key of Object.keys(patch)) {
        if (fieldSlugs.has(key)) next[key] = patch[key];
      }
      const searchText = Object.values(next).filter((v) => typeof v === "string" && v).join(" ");
      await prisma.entity.update({
        where: { id: e.id },
        data: { data: next as object, searchText: searchText != null ? searchText.slice(0, 10000) : null, updatedAt: new Date() },
      });
    }
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "bulk_delete_entities") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { moduleSlug, filter: filterList } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    const entities = await prisma.entity.findMany({
      where: { tenantId, moduleId: module_.id, deletedAt: null },
      select: { id: true, data: true, createdAt: true },
    });
    const matched = filterEntitiesByConditions(entities, filterList);
    const at = new Date();
    for (const e of matched) {
      await prisma.entity.update({ where: { id: e.id }, data: { deletedAt: at } });
    }
    revalidatePath(`/dashboard/m/${moduleSlug}`);
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "delete_relationship") {
    await requireDashboardPermission(PERMISSIONS.entitiesWrite);
    const { sourceModuleSlug, sourceEntityRef, targetModuleSlug, targetEntityRef, relationType } = intent.payload;
    const srcMod = modules.find((m) => m.slug === sourceModuleSlug);
    const tgtMod = modules.find((m) => m.slug === targetModuleSlug);
    if (!srcMod) return { error: "Source module not found." };
    if (!tgtMod) return { error: "Target module not found." };
    const source = await findEntityByRef(tenantId, srcMod.id, sourceEntityRef, srcMod.fields, false);
    const target = await findEntityByRef(tenantId, tgtMod.id, targetEntityRef, tgtMod.fields, false);
    if (!source) return { error: `No record in ${srcMod.name} matching "${sourceEntityRef}".` };
    if (!target) return { error: `No record in ${tgtMod.name} matching "${targetEntityRef}".` };
    const where: { tenantId: string; sourceId: string; targetId: string; relationType?: string } = { tenantId, sourceId: source.id, targetId: target.id };
    if (relationType) where.relationType = relationType;
    const deleted = await prisma.relationship.deleteMany({ where });
    if (deleted.count === 0) return { error: "No link found between those records." };
    revalidatePath(`/dashboard/m/${sourceModuleSlug}`);
    revalidatePath(`/dashboard/m/${targetModuleSlug}`);
    redirect(`/dashboard/m/${sourceModuleSlug}`);
  }

  if (intent.intent === "disable_module") {
    await requireDashboardPermission(PERMISSIONS.modulesManage);
    const { moduleSlug } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    await prisma.module.update({ where: { id: module_.id }, data: { isActive: false } });
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  if (intent.intent === "enable_module") {
    await requireDashboardPermission(PERMISSIONS.modulesManage);
    const { moduleSlug } = intent.payload;
    const module_ = modules.find((m) => m.slug === moduleSlug);
    if (!module_) return { error: "Module not found." };
    await prisma.module.update({ where: { id: module_.id }, data: { isActive: true } });
    revalidatePath("/dashboard");
    redirect(`/dashboard/m/${moduleSlug}`);
  }

  if (intent.intent === "delete_module") {
    await requireDashboardPermission(PERMISSIONS.modulesManage);
    const { moduleSlug } = intent.payload;
    const module_ = await prisma.module.findFirst({
      where: { tenantId, slug: moduleSlug, isActive: true },
      select: { id: true },
    });
    if (!module_) return { error: "Module not found." };
    const entityCount = await prisma.entity.count({
      where: { moduleId: module_.id },
    });
    if (entityCount > 0) {
      return {
        error: `Cannot delete this module because it still has ${entityCount} record(s). Delete or move the records first.`,
      };
    }
    await prisma.module.delete({ where: { id: module_.id } });
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }
}

export async function createViewFromAi(
  ctx: { tenantId: string; moduleId: string; moduleSlug: string; moduleName: string; fieldSlugs: string[] },
  _prev: unknown,
  formData: FormData
) {
  await requireDashboardPermission(PERMISSIONS.viewsManage);
  const prompt = (formData.get("prompt") as string)?.trim();
  if (!prompt) return { error: "Describe the view you want." };

  const { suggestViewFromPrompt } = await import("@/lib/ai");
  const suggestion = await suggestViewFromPrompt(
    prompt,
    ctx.moduleName,
    ctx.fieldSlugs
  );

  const view = await prisma.view.create({
    data: {
      tenantId: ctx.tenantId,
      moduleId: ctx.moduleId,
      name: suggestion.name,
      viewType: "list",
      filter: (suggestion.filter ?? []) as object,
      sort: (suggestion.sort ?? []) as object,
      columns: (suggestion.columns ?? []) as object,
    },
  });

  revalidatePath(`/dashboard/m/${ctx.moduleSlug}`);
  redirect(`/dashboard/m/${ctx.moduleSlug}?view=${view.id}`);
}

// -----------------------------------------------------------------------------
// Customer site AI (Phase 6)
// -----------------------------------------------------------------------------

export async function generateSiteFromAi(
  tenantId: string,
  _prev: unknown,
  formData: FormData
) {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const prompt = (formData.get("prompt") as string)?.trim();
  if (!prompt) return { error: "Describe your business or paste copy for your site." };

  const { suggestSiteFromPrompt } = await import("@/lib/ai");
  const suggestion = await suggestSiteFromPrompt(prompt);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  const site = (settings.site as Record<string, unknown>) ?? {};
  const pages = (settings.pages as Record<string, unknown>) ?? {};
  site.name = suggestion.siteName;
  site.tagline = suggestion.tagline;
  pages.home = suggestion.homeContent;
  settings.site = site;
  settings.pages = pages;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: settings as object },
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/s/[slug]");
  redirect("/dashboard/settings?success=saved");
}

// ---------------------------------------------------------------------------
// Consent (GDPR-style)
// ---------------------------------------------------------------------------

import { DEFAULT_CONSENT_TYPES } from "@/lib/consent";

export async function listConsents(filters: { userId?: string; consentType?: string; activeOnly?: boolean }) {
  await requireDashboardPermission(PERMISSIONS.entitiesRead);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized", consents: [] };
  const where: { tenantId: string; userId?: string; consentType?: string; revokedAt?: null } = { tenantId };
  if (filters.userId) where.userId = filters.userId;
  if (filters.consentType) where.consentType = filters.consentType;
  if (filters.activeOnly !== false) where.revokedAt = null; // active only
  const consents = await prisma.consent.findMany({
    where,
    orderBy: { grantedAt: "desc" },
    take: 200,
    select: {
      id: true,
      consentType: true,
      grantedAt: true,
      source: true,
      revokedAt: true,
      userId: true,
      user: { select: { email: true, name: true } },
    },
  });
  return { consents };
}

export async function revokeConsent(consentId: string): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const c = await prisma.consent.findFirst({
    where: { id: consentId, tenantId },
    select: { id: true, revokedAt: true },
  });
  if (!c) return { error: "Consent not found." };
  if (c.revokedAt) return { error: "Consent already revoked." };
  await prisma.consent.update({
    where: { id: consentId },
    data: { revokedAt: new Date() },
  });
  revalidatePath("/dashboard/consent");
  return {};
}

export async function grantConsentFormAction(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const userId = (formData.get("userId") as string)?.trim();
  const consentType = (formData.get("consentType") as string)?.trim();
  const source = (formData.get("source") as string)?.trim() || "dashboard";
  if (!userId || !consentType) return { error: "User and consent type are required." };
  if (consentType.length > 50) return { error: "Consent type too long." };
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { id: true },
  });
  if (!user) return { error: "User not found." };
  await prisma.consent.upsert({
    where: {
      tenantId_userId_consentType: { tenantId, userId: user.id, consentType },
    },
    create: {
      tenantId,
      userId: user.id,
      consentType,
      grantedAt: new Date(),
      source,
    },
    update: { grantedAt: new Date(), source, revokedAt: null },
  });
  revalidatePath("/dashboard/consent");
  return {};
}

export async function updateConsentTypesFormAction(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized" };
  const raw = (formData.get("consentTypes") as string)?.trim() || "";
  const consentTypes = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_CONSENT_TYPES;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  settings.consentTypes = consentTypes;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: settings as object },
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/consent");
  return {};
}

/** Platform admin only: update consent types for a target tenant. formData must include targetTenantId. */
export async function updateConsentTypesAsPlatformAdmin(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const targetTenantId = (formData.get("targetTenantId") as string)?.trim();
  if (!targetTenantId) return { error: "Missing target tenant." };
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) return { error: "Unauthorized" };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const { isPlatformAdmin } = await import("@/lib/developer-setup");
  if (!isPlatformAdmin(user?.email ?? null)) return { error: "Only platform admins can edit this." };
  const raw = (formData.get("consentTypes") as string)?.trim() || "";
  const consentTypes = raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_CONSENT_TYPES;
  const tenant = await prisma.tenant.findUnique({
    where: { id: targetTenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  settings.consentTypes = consentTypes;
  await prisma.tenant.update({
    where: { id: targetTenantId },
    data: { settings: settings as object },
  });
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/consent");
  revalidatePath(`/dashboard/platform/tenant/${targetTenantId}`);
  return {};
}

