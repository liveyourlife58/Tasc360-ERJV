import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantBySlug } from "@/lib/tenant";

export default async function SiteThankYouRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();

  return (
    <div className="site-page site-thank-you">
      <h1>Thank you</h1>
      <p>Your order has been received. We appreciate your support.</p>
      <p>
        <Link href={`/s/${tenant.slug}`} className="btn btn-primary">
          Return to home
        </Link>
      </p>
    </div>
  );
}
