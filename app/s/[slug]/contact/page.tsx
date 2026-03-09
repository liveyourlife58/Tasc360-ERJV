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
  const path = `/s/${slug}/contact`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  return {
    title: "Contact",
    description: `Contact ${meta.siteName}. Get in touch.`,
    alternates: { canonical },
    openGraph: { url: canonical },
  };
}

export default async function SiteContactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const pages = (settings.pages as Record<string, unknown>) ?? {};
  const contactContent = pages.contact as string | undefined;

  return (
    <div className="site-page">
      <h1>Contact</h1>
      {contactContent ? (
        <div
          className="site-prose"
          dangerouslySetInnerHTML={{ __html: contactContent }}
        />
      ) : (
        <p>Get in touch. Add contact details from your dashboard settings.</p>
      )}
    </div>
  );
}
