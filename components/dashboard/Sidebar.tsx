import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { logout } from "@/app/login/actions";
import type { DashboardSettings } from "@/lib/dashboard-settings";
import { orderModulesBySettings } from "@/lib/dashboard-settings";

type TenantStub = { id: string; name: string; settings: unknown } | null;

export async function Sidebar({
  tenantId,
  tenant,
  dashboardSettings,
  tenantSlug,
}: {
  tenantId: string;
  tenant?: TenantStub;
  dashboardSettings?: DashboardSettings;
  tenantSlug?: string | null;
}) {
  const modules = await prisma.module.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });
  const orderedModules = orderModulesBySettings(
    modules,
    dashboardSettings?.sidebarOrder
  );

  const displayName =
    dashboardSettings?.branding?.name ?? tenant?.name ?? "Dashboard";
  const logo = dashboardSettings?.branding?.logo;

  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-sidebar-brand">
        {logo ? (
          <img src={logo} alt={displayName} className="dashboard-sidebar-logo" />
        ) : (
          <span className="dashboard-sidebar-name">{displayName}</span>
        )}
      </div>
      <nav>
        <Link href="/dashboard">Home</Link>
        {orderedModules.map((m) => (
          <Link key={m.id} href={`/dashboard/m/${m.slug}`}>
            {m.name}
          </Link>
        ))}
      </nav>
      <div className="dashboard-sidebar-footer">
        <Link href="/dashboard/subscription">Subscription &amp; team</Link>
        <Link href="/dashboard/settings">Settings</Link>
        {tenantSlug && (
          <a href={`/s/${tenantSlug}`} target="_blank" rel="noopener noreferrer">
            Preview site
          </a>
        )}
        <form action={logout}>
          <button type="submit" className="btn btn-secondary sidebar-logout">
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
