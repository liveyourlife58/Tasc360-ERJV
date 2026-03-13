import { prisma } from "./prisma";

/**
 * Resolve tenant for the customer-facing site from:
 * - Subdomain: acme.yourapp.com → slug "acme"
 * - Path: yourapp.com/s/acme → slug "acme"
 * - Custom domain: lookup in DB (e.g. tenants.settings or tenant_domains)
 */
export async function getTenantIdForSite(options: {
  host?: string | null;
  pathname?: string;
  sitePathPrefix?: string; // e.g. "/s"
}): Promise<string | null> {
  const { host, pathname = "", sitePathPrefix = "/s" } = options;

  // Path-based: /s/[slug] or /[slug] for first segment
  const pathSlug = pathname.startsWith(`${sitePathPrefix}/`)
    ? pathname.slice(sitePathPrefix.length + 1).split("/")[0]
    : pathname.slice(1).split("/")[0];
  if (pathSlug && pathSlug !== "dashboard" && pathSlug !== "api" && pathSlug !== "login") {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: pathSlug, isActive: true },
      select: { id: true },
    });
    if (tenant) return tenant.id;
  }

  // Subdomain: acme.yourapp.com (ignore www and reserved)
  if (host) {
    const parts = host.split(".");
    if (parts.length >= 2) {
      const sub = parts[0].toLowerCase();
      if (sub !== "www" && sub !== "app" && sub !== "api") {
        const tenant = await prisma.tenant.findUnique({
          where: { slug: sub, isActive: true },
          select: { id: true },
        });
        if (tenant) return tenant.id;
      }
    }
  }

  return null;
}

export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug, isActive: true },
    select: { id: true, name: true, slug: true, settings: true },
  });
}

/** Resolve tenant by custom domain (e.g. donate.tenant.org). Store in tenant.settings.site.customDomain. */
export async function getTenantByCustomDomain(host: string | null): Promise<{ id: string; slug: string } | null> {
  if (!host || typeof host !== "string") return null;
  const normalized = host.toLowerCase().replace(/^www\./, "").trim();
  if (!normalized) return null;
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, settings: true },
  });
  for (const t of tenants) {
    const site = (t.settings as Record<string, unknown>)?.site as Record<string, unknown> | undefined;
    const customDomain = (site?.customDomain as string)?.toLowerCase()?.replace(/^www\./, "")?.trim();
    if (customDomain === normalized) return { id: t.id, slug: t.slug };
  }
  return null;
}

/** Public module config: keyed by module slug, value is { slug: URL segment, showInNav } */
export type PublicModulesConfig = Record<
  string,
  { slug: string; showInNav?: boolean }
>;

export function getPublicModulesFromSettings(settings: unknown): PublicModulesConfig {
  if (!settings || typeof settings !== "object") return {};
  const site = (settings as Record<string, unknown>).site;
  if (!site || typeof site !== "object") return {};
  const pm = (site as Record<string, unknown>).publicModules;
  if (!pm || typeof pm !== "object") return {};
  return pm as PublicModulesConfig;
}

/** Resolve module (with fields) for a public URL segment. Returns null if segment is not a public module slug. */
export async function getPublicModuleBySegment(
  tenantId: string,
  settings: unknown,
  segment: string
) {
  const publicModules = getPublicModulesFromSettings(settings);
  const entry = Object.entries(publicModules).find(
    ([_, v]) => v.slug === segment
  );
  if (!entry) return null;
  const [moduleSlug] = entry;
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  return module_;
}
