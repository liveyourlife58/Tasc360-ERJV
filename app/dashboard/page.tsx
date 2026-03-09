import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings, orderModulesBySettings } from "@/lib/dashboard-settings";
import { CreateModuleAiForm } from "@/components/dashboard/CreateModuleAiForm";

export default async function DashboardHome() {
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) redirect("/login");

  const [tenant, modules] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    }),
    prisma.module.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  const dashboardSettings = getDashboardSettings(tenant?.settings ?? null);
  const orderedModules = orderModulesBySettings(
    modules,
    dashboardSettings.sidebarOrder
  );

  const home = dashboardSettings.home;
  if (home?.type === "module") {
    const m = modules.find((x) => x.slug === home.moduleSlug);
    if (m) redirect(`/dashboard/m/${m.slug}`);
  }
  if (home?.type === "view") {
    redirect(`/dashboard/m/${home.moduleSlug}?view=${home.viewId}`);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Modules</h1>
      </div>
      <CreateModuleAiForm tenantId={tenantId} />
      {orderedModules.length === 0 && (
        <p style={{ color: "#6b7280", marginTop: "1rem" }}>
          No modules yet. Describe one above with AI, or create via the API or seed data.
        </p>
      )}
    </div>
  );
}
