import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getTenantBySlug } from "@/lib/tenant";
import { getSiteMeta, getCanonicalUrl } from "@/lib/site-seo";

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
  const pages = (settings.pages as Record<string, unknown>) ?? {};
  const homeContent = pages.home as string | undefined;

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

  return (
    <div className="site-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <section className="site-hero">
        <h1 className="site-hero-title">{siteName}</h1>
        {tagline && <p className="site-hero-tagline">{tagline}</p>}
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
  );
}
