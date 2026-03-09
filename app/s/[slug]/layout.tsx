import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { getTenantBySlug, getPublicModulesFromSettings } from "@/lib/tenant";
import { getSiteMeta, getCanonicalUrl } from "@/lib/site-seo";
import { prisma } from "@/lib/prisma";
import { SiteCartProvider } from "@/components/site/SiteCartProvider";
import { CartLink } from "@/components/site/CartLink";

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
  const title = meta.metaTitle || meta.siteName;
  const description = meta.metaDescription || meta.tagline || `Welcome to ${meta.siteName}.`;
  const path = `/s/${slug}`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  const metadataBase =
    canonical.startsWith("http") && /^https?:\/\//.test(canonical)
      ? new URL(canonical)
      : undefined;

  return {
    title: { default: title, template: `%s | ${meta.siteName}` },
    description,
    metadataBase,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: meta.siteName,
      ...(meta.ogImage && { images: [{ url: meta.ogImage, width: 1200, height: 630, alt: meta.siteName }] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(meta.ogImage && { images: [meta.ogImage] }),
    },
  };
}

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const site = (settings.site as Record<string, unknown>) ?? {};
  const siteName = (site.name as string) ?? tenant.name;
  const logo = site.logo as string | undefined;
  const primaryColor = (site.primaryColor as string) ?? "#4f46e5";
  const publicModules = getPublicModulesFromSettings(tenant.settings);
  const navModules = Object.entries(publicModules).filter(
    ([_, v]) => v.showInNav !== false
  );
  const moduleNames = navModules.length
    ? await prisma.module.findMany({
        where: {
          tenantId: tenant.id,
          slug: { in: navModules.map(([s]) => s) },
          isActive: true,
        },
        select: { slug: true, name: true },
      })
    : [];

  return (
    <SiteCartProvider tenantSlug={tenant.slug}>
      <div className="site-layout" style={{ ["--site-primary" as string]: primaryColor }}>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href={`/s/${tenant.slug}`} className="site-logo">
              {logo ? (
                <img src={logo} alt={siteName} className="site-logo-img" />
              ) : (
                <span className="site-logo-text">{siteName}</span>
              )}
            </Link>
            <nav className="site-nav">
              <Link href={`/s/${tenant.slug}`}>Home</Link>
              {moduleNames.map((m) => {
                const pub = publicModules[m.slug];
                return pub ? (
                  <Link key={m.slug} href={`/s/${tenant.slug}/${pub.slug}`}>
                    {m.name}
                  </Link>
                ) : null;
              })}
              <Link href={`/s/${tenant.slug}/about`}>About</Link>
              <Link href={`/s/${tenant.slug}/contact`}>Contact</Link>
              <CartLink tenantSlug={tenant.slug} />
            </nav>
          </div>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <span>© {new Date().getFullYear()} {siteName}. All rights reserved.</span>
          </div>
        </footer>
      </div>
    </SiteCartProvider>
  );
}
