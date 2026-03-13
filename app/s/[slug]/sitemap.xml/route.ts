import { getTenantBySlug, getPublicModulesFromSettings } from "@/lib/tenant";
import { getSiteMeta, getBaseUrlForSitemap } from "@/lib/site-seo";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return new Response("Not found", { status: 404 });

  const meta = getSiteMeta(tenant);
  let base = getBaseUrlForSitemap(meta.canonicalBaseUrl);
  if (!base && request.url) {
    try {
      base = new URL(request.url).origin;
    } catch {
      // ignore
    }
  }
  if (!base) return new Response("Sitemap not configured. Set canonical base URL in Settings → SEO or set NEXT_PUBLIC_APP_URL.", { status: 404 });

  const entries: { url: string; lastMod?: Date; changeFreq: string; priority: number }[] = [];

  const add = (path: string, lastMod?: Date) => {
    entries.push({
      url: `${base}${path}`,
      lastMod,
      changeFreq: path === `/s/${slug}` ? "weekly" : "monthly",
      priority: path === `/s/${slug}` ? 1 : 0.8,
    });
  };

  add(`/s/${slug}`);
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

  const urlElements = entries
    .map(
      (e) =>
        `  <url><loc>${escapeXml(e.url)}</loc>${e.lastMod ? `<lastmod>${e.lastMod.toISOString().slice(0, 10)}</lastmod>` : ""}<changefreq>${e.changeFreq}</changefreq><priority>${e.priority}</priority></url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}