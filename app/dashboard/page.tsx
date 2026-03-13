import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings, orderModulesBySettings } from "@/lib/dashboard-settings";
import { CreateModuleAiForm } from "@/components/dashboard/CreateModuleAiForm";
import { TemplatePicker } from "@/components/dashboard/TemplatePicker";
import { AskAiForm } from "@/components/dashboard/AskAiForm";
import { ExportDataButton } from "@/components/dashboard/ExportDataButton";
import { ImportDataForm } from "@/components/dashboard/ImportDataForm";

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
      {orderedModules.length === 0 ? (
        <>
          <section className="onboarding-intro" aria-label="Get started">
            <h2 className="onboarding-title">What&apos;s your business?</h2>
            <p className="onboarding-description">
              Start from an industry template or describe what you need with AI.
            </p>
          </section>
          <TemplatePicker />
          <section className="create-module-ai-section">
            <h2 className="create-module-ai-title">Or describe a custom module</h2>
            <CreateModuleAiForm tenantId={tenantId} />
          </section>
        </>
      ) : (
        <>
          <div className="page-header-actions" style={{ marginBottom: "1rem" }}>
            <AskAiForm />
            <ExportDataButton />
          </div>
          <details className="import-data-details">
            <summary>Import from export JSON</summary>
            <ImportDataForm />
          </details>
          <CreateModuleAiForm tenantId={tenantId} />
          <ul className="module-list">
            {orderedModules.map((m) => (
              <li key={m.id}>
                <a href={`/dashboard/m/${m.slug}`} className="module-list-link">
                  {m.name}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
