import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings } from "@/lib/dashboard-settings";
import { getSubscriptionGraceDays } from "@/lib/app-config";
import { getAllowDeveloperSetup, isPlatformAdmin } from "@/lib/developer-setup";
import { getDashboardFeatures, DASHBOARD_PATH_TO_FEATURE } from "@/lib/dashboard-features";
import { resolveDashboardLandingPath } from "@/lib/resolve-dashboard-landing";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardSidebarToggle } from "@/components/dashboard/DashboardSidebarToggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  const pathname = h.get("x-pathname") ?? "";
  if (!tenantId || !userId) redirect("/login");

  const [tenant, user, hasDeveloperPermission] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, settings: true, subscriptionStatus: true, subscriptionCurrentPeriodEnd: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    hasPermission(userId, PERMISSIONS.settingsDeveloper),
  ]);
  const dashboardSettings = getDashboardSettings(tenant?.settings ?? null);
  const dashboardFeatures = getDashboardFeatures(tenant?.settings ?? null);
  const allowDeveloperSetup = getAllowDeveloperSetup(tenant?.settings ?? null);
  const showDeveloperLinks = allowDeveloperSetup && hasDeveloperPermission;
  const platformAdmin = isPlatformAdmin(user?.email ?? null);
  const showPlatformAdminLink = platformAdmin;
  const primaryColor =
    dashboardSettings.branding?.primaryColor ?? "#0d9488";

  const pathNoQuery = pathname.replace(/\?.*$/, "").replace(/\/$/, "") || "/dashboard";
  if (pathNoQuery === "/dashboard" && !dashboardFeatures.workspaceHome) {
    redirect(
      await resolveDashboardLandingPath(prisma, {
        tenantId,
        tenantSettings: tenant?.settings ?? null,
        dashboardFeatures,
        platformAdmin,
      })
    );
  }
  const isTeamBillingPage =
    pathNoQuery === "/dashboard/team" ||
    pathNoQuery.startsWith("/dashboard/team/") ||
    pathNoQuery === "/dashboard/subscription" ||
    pathNoQuery.startsWith("/dashboard/subscription/");
  const allowedStatuses = ["active", "trialing"];
  const graceDays = getSubscriptionGraceDays();
  const periodEnd = tenant?.subscriptionCurrentPeriodEnd ? new Date(tenant.subscriptionCurrentPeriodEnd) : null;
  const graceEnd = periodEnd ? new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000) : null;
  const isPastDueWithGrace =
    tenant?.subscriptionStatus === "past_due" && graceEnd && new Date() <= graceEnd;
  const hasSubscription = !!tenant?.subscriptionStatus;
  const isAllowed =
    !hasSubscription ||
    allowedStatuses.includes(tenant!.subscriptionStatus!) ||
    isPastDueWithGrace;

  if (!isTeamBillingPage && !isAllowed) {
    redirect(
      dashboardFeatures.teamBilling
        ? "/dashboard/team?gated=1"
        : await resolveDashboardLandingPath(prisma, {
            tenantId,
            tenantSettings: tenant?.settings ?? null,
            dashboardFeatures,
            platformAdmin,
          })
    );
  }

  const pathWithoutQuery = pathNoQuery;
  if (isTeamBillingPage) {
    if (!dashboardFeatures.teamBilling) {
      redirect(
        dashboardFeatures.workspaceHome
          ? "/dashboard"
          : await resolveDashboardLandingPath(prisma, {
              tenantId,
              tenantSettings: tenant?.settings ?? null,
              dashboardFeatures,
              platformAdmin,
            })
      );
    }
  } else {
    const featureForPath = (Object.entries(DASHBOARD_PATH_TO_FEATURE) as [string, keyof typeof dashboardFeatures][]).find(
      ([path]) => pathWithoutQuery === path || pathWithoutQuery.startsWith(path + "/")
    )?.[1];
    if (featureForPath && !dashboardFeatures[featureForPath]) {
      if (!(platformAdmin && featureForPath === "settings")) {
        redirect(
          dashboardFeatures.workspaceHome
            ? "/dashboard"
            : await resolveDashboardLandingPath(prisma, {
                tenantId,
                tenantSettings: tenant?.settings ?? null,
                dashboardFeatures,
                platformAdmin,
              })
        );
      }
    }
  }

  return (
    <div
      id="dashboard-layout"
      className="dashboard-layout flex min-h-screen"
      style={{ ["--dashboard-primary" as string]: primaryColor }}
    >
      <a
        href="#dashboard-main-content"
        className="absolute top-0 left-0 -translate-y-full focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[var(--dashboard-primary,#0d9488)] focus:z-[100] px-4 py-2 bg-white border border-slate-200 rounded-b shadow-sm text-sm font-medium text-slate-700"
      >
        Skip to main content
      </a>
      <Sidebar tenantId={tenantId} tenant={tenant} dashboardSettings={dashboardSettings} dashboardFeatures={dashboardFeatures} tenantSlug={tenant?.slug} pathname={pathname} showDeveloperLinks={showDeveloperLinks} showPlatformAdminLink={showPlatformAdminLink} />
      <main id="dashboard-main-content" className="dashboard-main flex-1 min-w-0 ml-60 p-6 md:pl-8 md:pr-8 max-w-[1400px]" tabIndex={-1}>
        <DashboardSidebarToggle />
        {isPastDueWithGrace && (
          <div className="flex flex-wrap items-center gap-3 p-4 mb-4 bg-amber-100 text-amber-900 rounded-lg border border-amber-200" role="alert">
            <span className="flex-1 min-w-0">Your payment is past due. Please update your payment method to avoid losing access.</span>
            <a href="/dashboard/team" className="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors">
              Update payment method
            </a>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
