import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings, orderModulesBySettings } from "@/lib/dashboard-settings";

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
        <p className="settings-hint" style={{ maxWidth: "36rem", lineHeight: 1.5 }}>
          No modules yet. Open{" "}
          <Link href="/dashboard/settings" className="module-list-link">
            Dashboard settings
          </Link>{" "}
          and choose <strong>Modules &amp; data</strong> (under Dashboard &amp; backend) to start from a template, use AI, or
          import data.
        </p>
      ) : (
        <ul className="dashboard-module-tiles" role="list">
          {orderedModules.map((m) => (
            <li key={m.id} className="dashboard-module-tile">
              <Link href={`/dashboard/m/${m.slug}`} className="dashboard-module-tile-link">
                <span className="dashboard-module-tile-label">{m.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
