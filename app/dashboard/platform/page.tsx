import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAllowDeveloperSetup, isPlatformAdmin } from "@/lib/developer-setup";
import { updateTenantDeveloperSetupFormAction } from "../actions";
import { SuccessBanner } from "@/components/dashboard/SuccessBanner";
import { PlatformTenantTable } from "./PlatformTenantTable";

export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!isPlatformAdmin(user?.email ?? null)) redirect("/dashboard");

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, settings: true },
  });
  const tenantsWithFlag = tenants.map((t) => ({
    id: t.id,
    name: t.name ?? "—",
    slug: t.slug ?? "—",
    allowDeveloperSetup: getAllowDeveloperSetup(t.settings),
  }));

  const params = await searchParams;

  return (
    <div>
      <Suspense fallback={null}>
        <SuccessBanner successKey={params.success} />
      </Suspense>
      <div className="page-header">
        <h1>Platform admin</h1>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
      <p className="page-description" style={{ marginBottom: "1.5rem" }}>
        Manage &quot;Allow developer setup&quot; for each tenant. Only visible to users listed in{" "}
        <code>PLATFORM_ADMIN_EMAILS</code>. When enabled, tenants with the right permission can see API keys, Webhooks and Integrations.
      </p>
      <PlatformTenantTable tenants={tenantsWithFlag} updateAction={updateTenantDeveloperSetupFormAction} />
    </div>
  );
}
