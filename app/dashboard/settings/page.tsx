import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings } from "@/lib/dashboard-settings";
import { getModulePaymentType } from "@/lib/module-settings";
import { updateDashboardSettings } from "../actions";
import { DashboardSettingsForm } from "./DashboardSettingsForm";
import { GenerateSiteAiForm } from "./GenerateSiteAiForm";

export default async function DashboardSettingsPage() {
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) redirect("/login");

  const [tenant, modules] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, settings: true },
    }),
    prisma.module.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, settings: true },
    }),
  ]);
  const dashboardSettings = getDashboardSettings(tenant?.settings ?? null);
  const site = ((tenant?.settings as Record<string, unknown>)?.site as Record<string, unknown>) ?? {};
  const publicModules = (site.publicModules as Record<string, { slug: string; showInNav?: boolean }>) ?? {};
  const modulePaymentTypes: Record<string, "payment" | "donation" | null> = {};
  for (const m of modules) {
    modulePaymentTypes[m.slug] = getModulePaymentType(m);
  }

  const viewsByModule: Record<string, { id: string; name: string }[]> = {};
  for (const m of modules) {
    const views = await prisma.view.findMany({
      where: { tenantId, moduleId: m.id },
      select: { id: true, name: true },
    });
    viewsByModule[m.slug] = views;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard settings</h1>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>
      <section className="settings-section" style={{ marginBottom: "2rem" }}>
        <h2 className="settings-heading">Generate with AI (customer site)</h2>
        <GenerateSiteAiForm tenantId={tenantId} />
      </section>
      <DashboardSettingsForm
        tenantId={tenantId}
        action={updateDashboardSettings.bind(null, tenantId)}
        branding={dashboardSettings.branding}
        home={dashboardSettings.home}
        sidebarOrder={dashboardSettings.sidebarOrder}
        publicModules={publicModules}
        modulePaymentTypes={modulePaymentTypes}
        modules={modules}
        viewsByModule={viewsByModule}
      />
    </div>
  );
}
