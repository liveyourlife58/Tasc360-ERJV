import { getTenantBySlug } from "@/lib/tenant";
import { isCustomerSiteEnabled } from "@/lib/dashboard-features";
import { getSiteMeta, getBaseUrlForSitemap } from "@/lib/site-seo";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant || !isCustomerSiteEnabled(tenant.settings)) {
    return new Response("User-agent: *\nDisallow: /", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const meta = getSiteMeta(tenant);
  const base = getBaseUrlForSitemap(meta.canonicalBaseUrl);
  const lines = ["User-agent: *", "Allow: /"];
  if (base) {
    lines.push(`Sitemap: ${base}/s/${slug}/sitemap.xml`);
  }

  return new Response(lines.join("\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
