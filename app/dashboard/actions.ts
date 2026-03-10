"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { filterEntitiesByConditions } from "@/lib/view-utils";

async function requireDashboardPermission(permission: string) {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) throw new Error("Unauthorized");
  await requirePermission(userId, permission);
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

  const searchText = Object.values(data)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ")
    .slice(0, 10000) || null;

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

  await prisma.entity.create({
    data: {
      tenantId: ctx.tenantId,
      moduleId: ctx.moduleId,
      data: data as object,
      metadata: Object.keys(metadata).length > 0 ? (metadata as object) : undefined,
      searchText,
      createdBy: ctx.createdBy,
    },
  });

  const slug = moduleRow?.slug ?? "";
  revalidatePath(`/dashboard/m/${slug}`);
  redirect(`/dashboard/m/${slug}`);
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
      metadata: true,
      module: {
        select: {
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

  const searchText = Object.values(data)
    .flatMap((v) => (Array.isArray(v) ? v : [v]))
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ")
    .slice(0, 10000) || null;

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

  const entity = await prisma.entity.update({
    where: { id: ctx.entityId },
    data: {
      data: data as object,
      metadata: metadata as object,
      searchText: searchText != null ? searchText.slice(0, 10000) : null,
    },
    include: { module: { select: { slug: true } } },
  });

  const slug = entity.module?.slug ?? "";
  revalidatePath(`/dashboard/m/${slug}`);
  revalidatePath(`/dashboard/m/${slug}/${entity.id}`);
  redirect(`/dashboard/m/${slug}`);
}

/** Return entity data for given IDs in a relation target module (for relation-multi modal). */
export async function getRelationEntityData(moduleSlug: string, entityIds: string[]) {
  await requireDashboardPermission(PERMISSIONS.entitiesRead);
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) return { error: "Unauthorized", entities: null, fields: null };
  const ids = entityIds.filter((id) => typeof id === "string" && id.trim()).slice(0, 100);
  if (ids.length === 0) return { error: null, entities: [], fields: [] };

  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    select: { id: true, fields: { orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } } },
  });
  if (!module_) return { error: "Module not found", entities: null, fields: null };

  const entities = await prisma.entity.findMany({
    where: { tenantId, moduleId: module_.id, id: { in: ids }, deletedAt: null },
    select: { id: true, data: true },
  });

  return {
    error: null,
    entities: entities.map((e) => ({ id: e.id, data: (e.data as Record<string, unknown>) ?? {} })),
    fields: module_.fields,
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
        select: { purchaserName: true, purchaserEmail: true, createdAt: true },
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

  await prisma.entity.update({
    where: { id: entityId },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  redirect(`/dashboard/m/${moduleSlug}`);
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
  await prisma.view.update({
    where: { id: viewId },
    data: {
      name,
      columns: columns.length ? (columns as object) : [],
    },
  });
  revalidatePath(`/dashboard/m/${moduleSlug}`);
  redirect(`/dashboard/m/${moduleSlug}?view=${viewId}`);
}

// -----------------------------------------------------------------------------
// Tenant dashboard settings (Phase 2)
// -----------------------------------------------------------------------------

export async function updateDashboardSettings(
  tenantId: string,
  _prev: unknown,
  formData: FormData
) {
  await requireDashboardPermission(PERMISSIONS.settingsManage);
  const prisma = (await import("@/lib/prisma")).prisma;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  const section = (formData.get("settingsSection") as string) || null;

  if (section !== "customer") {
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
    const apiKeyRaw = (formData.get("apiKey") as string)?.trim();
    if (apiKeyRaw !== undefined && apiKeyRaw !== "") {
      settings.apiKey = apiKeyRaw;
    }
  }

  if (section !== "backend") {
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
    const homepageSidebarModule = (formData.get("homepageSidebarModule") as string)?.trim();
    if (homepageSidebarModule !== undefined) {
      site.homepageSidebarModule = homepageSidebarModule || undefined;
    }
    const sidebarFieldSlugs = formData.getAll("homepageSidebarFieldSlugs").filter((v): v is string => typeof v === "string" && v.trim() !== "");
    if (sidebarFieldSlugs.length >= 0) {
      site.homepageSidebarFieldSlugs = sidebarFieldSlugs.length ? sidebarFieldSlugs : undefined;
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
    redirect("/dashboard/settings");
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
    redirect("/dashboard/settings");
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
      Prisma.sql`SELECT COUNT(*)::bigint as count FROM entities WHERE module_id = (${module_.id})::uuid AND deleted_at IS NULL AND (data ? ${fieldSlug})`
    );
    const entityCount = Number(rows[0]?.count ?? 0);
    if (entityCount > 0) {
      return {
        error: `Cannot remove this field because ${entityCount} record(s) still have a value for it. Clear or migrate the data first.`,
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
    redirect(`/dashboard/m/${moduleSlug}`);
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
  redirect("/dashboard/settings");
}
