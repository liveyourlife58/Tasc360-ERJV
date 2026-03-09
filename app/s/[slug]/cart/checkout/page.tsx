import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { CheckoutPage } from "@/components/site/CheckoutPage";

export default async function SiteCheckoutRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return <CheckoutPage tenantSlug={tenant.slug} />;
}
