import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { getTenantBySlug, getPublicModulesFromSettings } from "@/lib/tenant";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getSiteMeta, getCanonicalUrl } from "@/lib/site-seo";
import { getTenantLocale } from "@/lib/format";
import { HtmlLang } from "@/components/site/HtmlLang";
import { prisma } from "@/lib/prisma";
import { SiteCartProvider } from "@/components/site/SiteCartProvider";
import { CartLink } from "@/components/site/CartLink";
import { CookieBanner } from "@/components/site/CookieBanner";
import { LogoImage } from "@/components/site/LogoImage";
import { BackToTop } from "@/components/site/BackToTop";

export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Viewport> {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return {};
  const site = (tenant.settings as Record<string, unknown>)?.site as Record<string, unknown> | undefined;
  const primaryColor = (site?.primaryColor as string) ?? "#0d9488";
  return { themeColor: primaryColor };
}

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
  const site = (tenant.settings as Record<string, unknown>)?.site as Record<string, unknown> | undefined;
  const faviconUrl = (site?.faviconUrl as string)?.trim() || undefined;
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
    ...(faviconUrl && { icons: { icon: faviconUrl } }),
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
  const primaryColor = (site.primaryColor as string) ?? "#0d9488";
  const footerHtml = (site.footerHtml as string) ?? "";
  const showCookieBanner = (site.showCookieBanner as boolean) === true;
  const cookiePolicyUrl = (site.cookiePolicyUrl as string) || null;
  const locale = getTenantLocale(tenant.settings);
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
      <HtmlLang locale={locale} />
      <a href="#site-main" className="skip-link skip-link-site">
        Skip to main content
      </a>
      <div className="site-layout" style={{ ["--site-primary" as string]: primaryColor }}>
        <header className="site-header">
          <div className="site-header-inner">
            <Link href={`/s/${tenant.slug}`} className="site-logo">
              {logo ? (
                <LogoImage src={logo} alt={siteName} className="site-logo-img" />
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
              <Link href={`/s/${tenant.slug}/contact`}>Contact</Link>
              {isFeatureEnabled(tenant.settings, "myOrders") && (
                <Link href={`/s/${tenant.slug}/my-orders`}>My orders</Link>
              )}
            </nav>
            <div className="site-header-cart">
              <CartLink tenantSlug={tenant.slug} />
            </div>
          </div>
        </header>
        <main id="site-main" className="site-main" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            {footerHtml.trim() ? (
              <div className="site-footer-custom" dangerouslySetInnerHTML={{ __html: footerHtml }} />
            ) : (
              <span>
                © {new Date().getFullYear()} {siteName}. All rights reserved.
                {" · "}
                <Link href={`/s/${tenant.slug}/sitemap.xml`} className="site-footer-sitemap-link">Sitemap</Link>
              </span>
            )}
          </div>
        </footer>
        {showCookieBanner && (
          <CookieBanner show={true} tenantSlug={tenant.slug} policyUrl={cookiePolicyUrl} />
        )}
        <BackToTop />
      </div>
    </SiteCartProvider>
  );
}
