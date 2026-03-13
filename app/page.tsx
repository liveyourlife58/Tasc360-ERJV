import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTenantByCustomDomain } from "@/lib/tenant";

export default async function HomePage() {
  const headersList = await headers();
  const host = headersList.get("host") ?? undefined;
  const tenant = await getTenantByCustomDomain(host ?? null);
  if (tenant) {
    redirect(`/s/${tenant.slug}`);
  }
  redirect("/login");
}
