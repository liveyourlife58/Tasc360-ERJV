import { getTenantBySlug, getPublicModuleBySegment } from "@/lib/tenant";
import { isCustomerSiteEnabled } from "@/lib/dashboard-features";
import { getSiteMeta, getCanonicalUrl, getBaseUrlForSitemap } from "@/lib/site-seo";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

const FEED_ENTRIES_LIMIT = 50;

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; segment: string }> }
) {
  const { slug, segment } = await params;
  if (segment === "about" || segment === "contact") {
    return new Response("Not found", { status: 404 });
  }

  const tenant = await getTenantBySlug(slug);
  if (!tenant || !isCustomerSiteEnabled(tenant.settings)) return new Response("Not found", { status: 404 });

  const module_ = await getPublicModuleBySegment(tenant.id, tenant.settings, segment);
  if (!module_) return new Response("Not found", { status: 404 });

  const h = await headers();
  const meta = getSiteMeta(tenant);
  const listPath = `/s/${slug}/${segment}`;
  const listCanonical = getCanonicalUrl(listPath, meta.canonicalBaseUrl, h);
  const baseUrl =
    getBaseUrlForSitemap(meta.canonicalBaseUrl) ??
    (listCanonical.startsWith("http") ? new URL(listCanonical).origin : "");

  const entities = await prisma.entity.findMany({
    where: {
      tenantId: tenant.id,
      moduleId: module_.id,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: FEED_ENTRIES_LIMIT,
    select: { id: true, data: true, createdAt: true, updatedAt: true },
  });

  const title = `${module_.name} – ${meta.siteName}`;
  const updated = entities[0]?.updatedAt ?? new Date();
  const updatedStr = updated.toISOString();

  const entryEls = entities.map((entity) => {
    const data = (entity.data as Record<string, unknown>) ?? {};
    const nameSlug = module_.fields[0]?.slug ?? "name";
    const titleText = String(data[nameSlug] ?? data.name ?? entity.id.slice(0, 8)).slice(0, 120) || "Untitled";
    const descRaw = (data.description as string) ?? (data.notes as string) ?? "";
    const summary = descRaw ? String(descRaw).slice(0, 500) : titleText;
    const link = `${baseUrl}/s/${slug}/${segment}/${entity.id}`;
    const published = entity.createdAt.toISOString();
    const updatedAt = entity.updatedAt.toISOString();
    return `
  <entry>
    <title>${escapeXml(titleText)}</title>
    <link href="${escapeXml(link)}" />
    <id>${escapeXml(link)}</id>
    <updated>${updatedAt}</updated>
    <published>${published}</published>
    <summary>${escapeXml(summary)}</summary>
  </entry>`;
  });

  const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(title)}</title>
  <link href="${escapeXml(listCanonical)}" />
  <link href="${escapeXml(getCanonicalUrl(listPath + "/feed", meta.canonicalBaseUrl, h))}" rel="self" />
  <id>${escapeXml(listCanonical)}</id>
  <updated>${updatedStr}</updated>
  <generator uri="https://nextjs.org/" version="15">Next.js</generator>${entryEls.join("")}
</feed>`;

  return new Response(atom, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
