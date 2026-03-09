import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings } from "@/lib/dashboard-settings";
import { Sidebar } from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) redirect("/login");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, settings: true },
  });
  const dashboardSettings = getDashboardSettings(tenant?.settings ?? null);
  const primaryColor =
    dashboardSettings.branding?.primaryColor ?? "#4f46e5";

  return (
    <div
      className="dashboard-layout"
      style={{ ["--dashboard-primary" as string]: primaryColor }}
    >
      <Sidebar tenantId={tenantId} tenant={tenant} dashboardSettings={dashboardSettings} tenantSlug={tenant?.slug} />
      <main className="dashboard-main">{children}</main>
    </div>
  );
}
