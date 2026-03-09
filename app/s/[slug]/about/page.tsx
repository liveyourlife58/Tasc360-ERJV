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
  const path = `/s/${slug}/about`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  return {
    title: "About",
    description: `About ${meta.siteName}.`,
    alternates: { canonical },
    openGraph: { url: canonical },
  };
}

export default async function SiteAboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const pages = (settings.pages as Record<string, unknown>) ?? {};
  const aboutContent = pages.about as string | undefined;

  return (
    <div className="site-page">
      <h1>About</h1>
      {aboutContent ? (
        <div
          className="site-prose"
          dangerouslySetInnerHTML={{ __html: aboutContent }}
        />
      ) : (
        <p>About us. Add content from your dashboard settings.</p>
      )}
    </div>
  );
}
