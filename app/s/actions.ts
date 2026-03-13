"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTenantBySlug, getPublicModuleBySegment } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { getEntityAvailability } from "@/lib/capacity";
import { checkPublicFormRateLimit } from "@/lib/public-form-rate-limit";
import { sendContactFormEmail } from "@/lib/email";
import type { Availability } from "@/lib/capacity";

export type PublicFormState = { error?: string; success?: boolean };

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const real = h.get("x-real-ip");
    if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
    if (real) return real;
  } catch {
    // ignore
  }
  return "unknown";
}

export async function submitPublicForm(
  tenantSlug: string,
  segment: string,
  _prev: unknown,
  formData: FormData
): Promise<PublicFormState> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return { error: "Invalid request." };
  const ip = await getClientIp();
  if (!checkPublicFormRateLimit(tenant.id, ip)) {
    return { error: "Too many submissions. Please try again later." };
  }
  const module_ = await getPublicModuleBySegment(
    tenant.id,
    tenant.settings,
    segment
  );
  if (!module_) return { error: "Invalid request." };

  const data: Record<string, unknown> = {};
  const fieldSlugs = new Set(module_.fields.map((f) => f.slug));
  for (const [key, value] of formData.entries()) {
    if (!fieldSlugs.has(key)) continue;
    const v = value as string;
    if (v === "true") data[key] = true;
    else if (v === "false") data[key] = false;
    else if (v && !Number.isNaN(Number(v)) && v.trim() !== "") data[key] = Number(v);
    else data[key] = v || null;
  }

  const searchText = Object.values(data)
    .filter((v) => typeof v === "string" && v)
    .join(" ");

  await prisma.entity.create({
    data: {
      tenantId: tenant.id,
      moduleId: module_.id,
      data: data as object,
      searchText: searchText.slice(0, 10000) || null,
    },
  });

  redirect(`/s/${tenantSlug}/thank-you?from=${encodeURIComponent(segment)}`);
}

/** Public: get capacity/sold/available for an entity (customer site). */
export async function getEntityAvailabilityForSite(
  tenantSlug: string,
  entityId: string
): Promise<Availability | null> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return null;
  return getEntityAvailability(tenant.id, entityId);
}

/** Join waitlist when event is sold out. Creates an entity in the tenant's waitlist module. */
export async function joinWaitlist(
  tenantSlug: string,
  entityId: string,
  email: string,
  quantity: number
): Promise<PublicFormState> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return { error: "Site not found." };
  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const site = (settings.site as Record<string, unknown>) ?? {};
  const waitlist = site.waitlist as
    | { moduleSlug: string; eventFieldSlug: string; emailFieldSlug: string; quantityFieldSlug: string }
    | undefined;
  if (!waitlist?.moduleSlug || !waitlist.eventFieldSlug || !waitlist.emailFieldSlug || !waitlist.quantityFieldSlug) {
    return { error: "Waitlist is not configured for this site." };
  }
  const { capacity, sold, available } = await getEntityAvailability(tenant.id, entityId);
  if (capacity === null || (available !== null && available > 0)) {
    return { error: "This item is not sold out. Add to cart instead." };
  }
  const mod = await prisma.module.findFirst({
    where: { tenantId: tenant.id, slug: waitlist.moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!mod) return { error: "Waitlist module not found." };
  const emailTrim = (email ?? "").trim().toLowerCase();
  if (!emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    return { error: "Please enter a valid email address." };
  }
  const qty = Math.max(1, Math.floor(quantity));
  const data: Record<string, unknown> = {
    [waitlist.eventFieldSlug]: entityId,
    [waitlist.emailFieldSlug]: emailTrim,
    [waitlist.quantityFieldSlug]: qty,
  };
  const searchText = Object.values(data).filter((v) => typeof v === "string").join(" ");
  await prisma.entity.create({
    data: {
      tenantId: tenant.id,
      moduleId: mod.id,
      data: data as object,
      searchText: searchText.slice(0, 10000) || null,
    },
  });
  return { success: true };
}

export type ContactFormState = { error?: string };

export async function submitContactForm(
  tenantSlug: string,
  _prev: unknown,
  formData: FormData
): Promise<ContactFormState> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return { error: "Invalid request." };
  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const pages = (settings.pages as Record<string, unknown>) ?? {};
  const contact = (pages.contact as Record<string, unknown>) ?? {};
  const to = (contact.email as string)?.trim();
  if (!to || !to.includes("@")) return { error: "Contact form is not configured (no contact email)." };
  const ip = await getClientIp();
  if (!checkPublicFormRateLimit(tenant.id, ip)) {
    return { error: "Too many submissions. Please try again later." };
  }
  const name = (formData.get("name") as string)?.trim() ?? "";
  const senderEmail = (formData.get("email") as string)?.trim() ?? "";
  const message = (formData.get("message") as string)?.trim() ?? "";
  if (!senderEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
    return { error: "Please enter a valid email address." };
  }
  if (!message) return { error: "Please enter a message." };
  const sent = await sendContactFormEmail(tenant.id, to, {
    name,
    senderEmail,
    message: message.slice(0, 5000),
  });
  if (!sent) return { error: "We couldn't send your message. Please try again later." };
  redirect(`/s/${tenantSlug}/thank-you`);
}
