/**
 * SEO helpers for the customer site (/s/[slug]).
 * Reads from tenant.settings (site.metaTitle, site.metaDescription, site.ogImage, site.canonicalBaseUrl).
 */

export type SiteMeta = {
  siteName: string;
  tagline: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  canonicalBaseUrl: string | null;
};

export function getSiteMeta(tenant: { name: string; settings: unknown }): SiteMeta {
  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const site = (settings.site as Record<string, unknown>) ?? {};
  const siteName = (site.name as string) ?? tenant.name;
  return {
    siteName,
    tagline: (site.tagline as string) ?? null,
    metaTitle: (site.metaTitle as string) ?? null,
    metaDescription: (site.metaDescription as string) ?? null,
    ogImage: (site.ogImage as string) ?? (site.logo as string) ?? null,
    canonicalBaseUrl: (site.canonicalBaseUrl as string) ?? null,
  };
}

/** Build canonical URL for a path. Prefer tenant's canonicalBaseUrl; else use request origin from headers. */
export function getCanonicalUrl(
  path: string,
  canonicalBaseUrl: string | null,
  headers: Headers
): string {
  if (canonicalBaseUrl) {
    const base = canonicalBaseUrl.replace(/\/$/, "");
    return `${base}${path}`;
  }
  const host = headers.get("host");
  const proto = headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}${path}`;
  return path;
}

/** Base URL for sitemap/robots when no request headers (e.g. canonicalBaseUrl or env). */
export function getBaseUrlForSitemap(canonicalBaseUrl: string | null): string | null {
  if (canonicalBaseUrl) return canonicalBaseUrl.replace(/\/$/, "");
  const env = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL;
  if (env) return env.startsWith("http") ? env.replace(/\/$/, "") : `https://${env}`;
  return null;
}
