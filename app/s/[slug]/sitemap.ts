import type { MetadataRoute } from "next";
import { getTenantBySlug } from "@/lib/tenant";
import { getSiteMeta, getBaseUrlForSitemap } from "@/lib/site-seo";
import { getPublicModulesFromSettings } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export default async function sitemap({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<MetadataRoute.Sitemap> {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return [];

  const meta = getSiteMeta(tenant);
  const base = getBaseUrlForSitemap(meta.canonicalBaseUrl);
  if (!base) return [];

  const entries: MetadataRoute.Sitemap = [];

  const add = (path: string, lastMod?: Date) => {
    entries.push({
      url: `${base}${path}`,
      lastModified: lastMod,
      changeFrequency: path === `/s/${slug}` ? "weekly" : "monthly",
      priority: path === `/s/${slug}` ? 1 : 0.8,
    });
  };

  add(`/s/${slug}`);
  add(`/s/${slug}/about`);
  add(`/s/${slug}/contact`);

  const publicModules = getPublicModulesFromSettings(tenant.settings);
  for (const [_moduleSlug, config] of Object.entries(publicModules)) {
    const segment = typeof config === "object" && config?.slug ? config.slug : _moduleSlug;
    add(`/s/${slug}/${segment}`);

    const module_ = await prisma.module.findFirst({
      where: { tenantId: tenant.id, slug: _moduleSlug, isActive: true },
      select: { id: true },
    });
    if (module_) {
      const entities = await prisma.entity.findMany({
        where: { tenantId: tenant.id, moduleId: module_.id, deletedAt: null },
        select: { id: true, updatedAt: true },
      });
      for (const e of entities) {
        add(`/s/${slug}/${segment}/${e.id}`, e.updatedAt ?? undefined);
      }
    }
  }

  return entries;
}
