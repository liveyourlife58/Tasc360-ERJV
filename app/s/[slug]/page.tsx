import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { getTenantBySlug, getPublicModulesFromSettings, getPublicModuleBySegment } from "@/lib/tenant";
import { getSiteMeta, getCanonicalUrl } from "@/lib/site-seo";
import { prisma } from "@/lib/prisma";
import { formatDateIfApplicable } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { title: "Not found" };
  const h = await headers();
  const meta = getSiteMeta(tenant);
  const path = `/s/${slug}`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  return {
    title: meta.metaTitle || meta.siteName,
    description: meta.metaDescription || meta.tagline || undefined,
    alternates: { canonical },
    openGraph: { url: canonical },
  };
}

export default async function SiteHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const site = (settings.site as Record<string, unknown>) ?? {};
  const siteName = (site.name as string) ?? tenant.name;
  const tagline = site.tagline as string | undefined;
  const heroImage = site.heroImage as string | undefined;
  const homepageSidebarModule = site.homepageSidebarModule as string | undefined;
  const homepageSidebarFieldSlugs = Array.isArray(site.homepageSidebarFieldSlugs)
    ? (site.homepageSidebarFieldSlugs as string[])
    : undefined;
  const pages = (settings.pages as Record<string, unknown>) ?? {};
  const homeContent = pages.home as string | undefined;

  const publicModules = getPublicModulesFromSettings(tenant.settings);
  const sidebarSegment =
    homepageSidebarModule && publicModules[homepageSidebarModule]
      ? publicModules[homepageSidebarModule].slug
      : null;
  const sidebarModule =
    sidebarSegment != null
      ? await getPublicModuleBySegment(tenant.id, tenant.settings, sidebarSegment)
      : null;
  const sidebarEntities =
    sidebarModule != null
      ? await prisma.entity.findMany({
          where: {
            tenantId: tenant.id,
            moduleId: sidebarModule.id,
            deletedAt: null,
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : [];

  const h = await headers();
  const meta = getSiteMeta(tenant);
  const path = `/s/${slug}`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: meta.siteName,
    url: canonical.startsWith("http") ? canonical : undefined,
    ...(meta.tagline && { description: meta.tagline }),
  };

  const hasSidebar = sidebarModule != null;

  return (
    <div className={hasSidebar ? "site-home site-home-with-sidebar" : "site-home"}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <div className="site-home-main">
        <section
          className={"site-hero" + (heroImage ? " site-hero-with-image" : "")}
          style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
        >
          {heroImage && <div className="site-hero-overlay" aria-hidden />}
          <div className="site-hero-inner">
            <h1 className="site-hero-title">{siteName}</h1>
            {tagline && <p className="site-hero-tagline">{tagline}</p>}
          </div>
        </section>
        <section className="site-content">
          {homeContent ? (
            <div
              className="site-prose"
              dangerouslySetInnerHTML={{ __html: homeContent }}
            />
          ) : (
            <p className="site-welcome-default">
              Welcome to {siteName}. This is your customer-facing site. Customize
              your homepage and branding from the dashboard.
            </p>
          )}
        </section>
      </div>
      {hasSidebar && (
        <aside className="site-home-sidebar" aria-label={`${sidebarModule!.name} list`}>
          <div className="site-home-sidebar-header">
            <h2 className="site-home-sidebar-title">
              <Link href={`/s/${slug}/${sidebarSegment}`}>{sidebarModule!.name}</Link>
            </h2>
            <Link href={`/s/${slug}/${sidebarSegment}`} className="site-home-sidebar-view-all">
              View all
            </Link>
          </div>
          {sidebarEntities.length === 0 ? (
            <p className="site-home-sidebar-empty">No items yet.</p>
          ) : (
            <ul className="site-home-sidebar-list">
              {sidebarEntities.map((entity) => {
                const data = (entity.data as Record<string, unknown>) ?? {};
                const firstFieldSlug = sidebarModule!.fields[0]?.slug ?? "name";
                const title =
                  String(
                    data[firstFieldSlug] ?? data.name ?? entity.id.slice(0, 8)
                  ).slice(0, 60) || "Untitled";
                const displayFields =
                  homepageSidebarFieldSlugs?.length &&
                  homepageSidebarFieldSlugs.some((s) =>
                    sidebarModule!.fields.some((f) => f.slug === s)
                  )
                    ? sidebarModule!.fields.filter((f) => homepageSidebarFieldSlugs!.includes(f.slug))
                    : null;
                return (
                  <li key={entity.id} className="site-home-sidebar-card">
                    <Link href={`/s/${slug}/${sidebarSegment}/${entity.id}`} className="site-home-sidebar-card-link">
                      <span className="site-home-sidebar-card-title">{title}</span>
                      {displayFields && displayFields.length > 0 && (
                        <dl className="site-home-sidebar-card-fields">
                          {displayFields.map((f) => (
                            <div key={f.id}>
                              <dt>{f.name}</dt>
                              <dd>{formatSidebarValue(data[f.slug], f.fieldType)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      )}
    </div>
  );
}

function formatSidebarValue(value: unknown, fieldType: string): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const dateStr = formatDateIfApplicable(value, fieldType);
  if (dateStr !== null) return dateStr;
  return String(value).slice(0, 80);
}
