import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getTenantBySlug, getPublicModuleBySegment } from "@/lib/tenant";
import { getSiteMeta, getCanonicalUrl } from "@/lib/site-seo";
import { headers } from "next/headers";

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
  const path = `/s/${slug}/thank-you`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  return {
    title: "Thank you",
    description: "Your submission has been received.",
    alternates: { canonical },
    openGraph: { url: canonical },
    robots: { index: false, follow: false },
  };
}

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { slug } = await params;
  const { from: segment } = await searchParams;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  const settings = (tenant.settings as Record<string, unknown>) ?? {};
  const site = (settings.site as Record<string, unknown>) ?? {};
  const siteName = (site.name as string) ?? tenant.name;

  const module_ =
    segment && segment.trim()
      ? await getPublicModuleBySegment(tenant.id, tenant.settings, segment.trim())
      : null;

  return (
    <div className="site-page site-thank-you">
      <h1>Thank you</h1>
      <p className="site-thank-you-lead">
        Your submission has been received.
        {module_ && (
          <> We&apos;ve recorded your {module_.name.slice(0, -1).toLowerCase()} submission.</>
        )}
      </p>
      <p className="site-thank-you-next">
        You can return to the home page or browse more content.
      </p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
        <Link href={`/s/${slug}`} className="btn btn-primary">
          Back to home
        </Link>
        {module_ && segment && (
          <Link href={`/s/${slug}/${segment}`} className="btn btn-secondary">
            View all {module_.name}
          </Link>
        )}
      </div>
    </div>
  );
}
