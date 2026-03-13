import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { logout } from "@/app/login/actions";
import type { DashboardSettings } from "@/lib/dashboard-settings";
import { orderModulesBySettings } from "@/lib/dashboard-settings";

type TenantStub = { id: string; name: string; settings: unknown } | null;

function isActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href + "/");
}

export async function Sidebar({
  tenantId,
  tenant,
  dashboardSettings,
  tenantSlug,
  pathname = "",
}: {
  tenantId: string;
  tenant?: TenantStub;
  dashboardSettings?: DashboardSettings;
  tenantSlug?: string | null;
  pathname?: string;
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
      <div className="dashboard-sidebar-groups">
        <div className="dashboard-sidebar-group">
          <span className="dashboard-sidebar-group-title" aria-hidden>Workspace</span>
          <nav>
            <Link href="/dashboard" className={isActive("/dashboard", pathname) ? "active" : undefined}>
              Home
            </Link>
            {orderedModules.map((m) => {
              const href = `/dashboard/m/${m.slug}`;
              return (
                <Link key={m.id} href={href} className={isActive(href, pathname) ? "active" : undefined}>
                  {m.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="dashboard-sidebar-group">
          <span className="dashboard-sidebar-group-title" aria-hidden>Settings &amp; billing</span>
          <nav>
            <Link href="/dashboard/help" className={isActive("/dashboard/help", pathname) ? "active" : undefined}>
              Help
            </Link>
            <Link href="/dashboard/approvals" className={isActive("/dashboard/approvals", pathname) ? "active" : undefined}>
              Approvals
            </Link>
            <Link href="/dashboard/activity" className={isActive("/dashboard/activity", pathname) ? "active" : undefined}>
              Activity
            </Link>
            <Link href="/dashboard/consent" className={isActive("/dashboard/consent", pathname) ? "active" : undefined}>
              Consent
            </Link>
            <Link href="/dashboard/finance" className={isActive("/dashboard/finance", pathname) ? "active" : undefined}>
              Finance
            </Link>
            <Link href="/dashboard/team" className={isActive("/dashboard/team", pathname) ? "active" : undefined}>
              Team
            </Link>
            <Link href="/dashboard/subscription" className={isActive("/dashboard/subscription", pathname) ? "active" : undefined}>
              Subscription &amp; billing
            </Link>
            <Link href="/dashboard/settings" className={isActive("/dashboard/settings", pathname) ? "active" : undefined}>
              Settings
            </Link>
          </nav>
        </div>
      </div>
      <div className="dashboard-sidebar-footer">
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
