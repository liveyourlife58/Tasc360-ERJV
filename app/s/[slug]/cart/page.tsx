import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { CartPage } from "@/components/site/CartPage";

export default async function SiteCartRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return <CartPage tenantSlug={tenant.slug} />;
}
