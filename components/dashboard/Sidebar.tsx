import { prisma } from "@/lib/prisma";
import { logout } from "@/app/login/actions";
import type { DashboardSettings } from "@/lib/dashboard-settings";
import { orderModulesBySettings } from "@/lib/dashboard-settings";
import type { DashboardFeatures } from "@/lib/dashboard-features";
import { SidebarActiveLink } from "@/components/dashboard/SidebarActiveLink";

type TenantStub = { id: string; name: string; settings: unknown } | null;

const linkBase =
  "block py-2 px-4 rounded-md mx-2 text-slate-700 hover:bg-slate-200 hover:no-underline transition-colors";
const linkActive = "bg-teal-100 text-teal-800 font-medium hover:bg-teal-100";

const DEFAULT_DASHBOARD_FEATURES: DashboardFeatures = {
  help: true,
  workspaceHome: true,
  approvals: true,
  activity: true,
  consent: true,
  finance: true,
  integrations: true,
  teamBilling: true,
  settings: true,
  customerSite: true,
};

export async function Sidebar({
  tenantId,
  tenant,
  dashboardSettings,
  dashboardFeatures = DEFAULT_DASHBOARD_FEATURES,
  tenantSlug,
  showDeveloperLinks = false,
  showPlatformAdminLink = false,
}: {
  tenantId: string;
  tenant?: TenantStub;
  dashboardSettings?: DashboardSettings;
  dashboardFeatures?: DashboardFeatures;
  tenantSlug?: string | null;
  showDeveloperLinks?: boolean;
  showPlatformAdminLink?: boolean;
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
    <aside className="dashboard-sidebar fixed top-0 left-0 w-60 h-screen border-r border-slate-200 bg-slate-50 flex flex-col overflow-y-auto z-40">
      <div className="px-4 pb-4 pt-0 font-semibold text-lg">
        {logo ? (
          <img src={logo} alt={displayName} className="max-w-full h-9 w-auto object-contain block" />
        ) : (
          <span className="text-[var(--dashboard-primary,#0d9488)]">{displayName}</span>
        )}
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-none mt-4">
          <span className="block py-1 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500" aria-hidden>
            Workspace
          </span>
          <nav className="flex flex-col gap-0.5">
            {dashboardFeatures.workspaceHome && (
              <SidebarActiveLink href="/dashboard" baseClassName={linkBase} activeClassName={linkActive}>
                Dashboard
              </SidebarActiveLink>
            )}
            {orderedModules.map((m) => {
              const href = `/dashboard/m/${m.slug}`;
              return (
                <SidebarActiveLink key={m.id} href={href} baseClassName={linkBase} activeClassName={linkActive}>
                  {m.name}
                </SidebarActiveLink>
              );
            })}
          </nav>
        </div>
        <div className="flex-none mt-4">
          <span className="block py-1 px-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500" aria-hidden>
            Settings &amp; billing
          </span>
          <nav className="flex flex-col gap-0.5">
            {dashboardFeatures.help && (
              <SidebarActiveLink href="/dashboard/help" baseClassName={linkBase} activeClassName={linkActive}>
                Help
              </SidebarActiveLink>
            )}
            {dashboardFeatures.approvals && (
              <SidebarActiveLink href="/dashboard/approvals" baseClassName={linkBase} activeClassName={linkActive}>
                Approvals
              </SidebarActiveLink>
            )}
            {dashboardFeatures.activity && (
              <SidebarActiveLink href="/dashboard/activity" baseClassName={linkBase} activeClassName={linkActive}>
                Activity
              </SidebarActiveLink>
            )}
            {dashboardFeatures.consent && (
              <SidebarActiveLink href="/dashboard/consent" baseClassName={linkBase} activeClassName={linkActive}>
                Consent
              </SidebarActiveLink>
            )}
            {dashboardFeatures.finance && (
              <SidebarActiveLink href="/dashboard/finance" baseClassName={linkBase} activeClassName={linkActive}>
                Finance
              </SidebarActiveLink>
            )}
            {dashboardFeatures.integrations && showDeveloperLinks && (
              <SidebarActiveLink href="/dashboard/integrations" baseClassName={linkBase} activeClassName={linkActive}>
                Integrations
              </SidebarActiveLink>
            )}
            {dashboardFeatures.teamBilling && (
              <SidebarActiveLink
                href="/dashboard/team"
                baseClassName={linkBase}
                activeClassName={linkActive}
                alsoActivePrefixes={["/dashboard/subscription"]}
              >
                Team &amp; billing
              </SidebarActiveLink>
            )}
            {(dashboardFeatures.settings || showPlatformAdminLink) && (
              <SidebarActiveLink href="/dashboard/settings" baseClassName={linkBase} activeClassName={linkActive}>
                Settings
              </SidebarActiveLink>
            )}
            {showPlatformAdminLink && (
              <SidebarActiveLink href="/dashboard/platform" baseClassName={linkBase} activeClassName={linkActive}>
                Platform admin
              </SidebarActiveLink>
            )}
          </nav>
        </div>
      </div>
      <div className="mt-auto pt-4 border-t border-slate-200 p-4 flex flex-col gap-0.5">
        {tenantSlug && dashboardFeatures.customerSite && (
          <a
            href={`/s/${tenantSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-2 px-4 rounded-md mx-2 text-slate-700 hover:bg-slate-200 transition-colors text-sm"
          >
            Preview site
          </a>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="w-full py-2 px-4 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}
