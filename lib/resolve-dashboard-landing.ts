import type { PrismaClient } from "@prisma/client";
import { getDashboardSettings, orderModulesBySettings } from "@/lib/dashboard-settings";
import type { DashboardFeatures } from "@/lib/dashboard-features";

export type ResolveDashboardLandingParams = {
  tenantId: string;
  tenantSettings: unknown;
  dashboardFeatures: DashboardFeatures;
  /** Platform admins may open settings when the tenant feature is off. */
  platformAdmin: boolean;
};

/**
 * Where to send the user instead of `/dashboard` when workspace home is disabled
 * or when subscription gating cannot use `/dashboard` as a fallback.
 */
export async function resolveDashboardLandingPath(
  prisma: PrismaClient,
  params: ResolveDashboardLandingParams
): Promise<string> {
  const { tenantId, tenantSettings, dashboardFeatures, platformAdmin } = params;
  const dashboardSettings = getDashboardSettings(tenantSettings);
  const home = dashboardSettings.home;

  const modules = await prisma.module.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { slug: true },
  });
  const ordered = orderModulesBySettings(modules, dashboardSettings.sidebarOrder);

  if (home?.type === "module") {
    const m = ordered.find((x) => x.slug === home.moduleSlug);
    if (m) return `/dashboard/m/${m.slug}`;
  }
  if (home?.type === "view") {
    return `/dashboard/m/${home.moduleSlug}?view=${encodeURIComponent(home.viewId)}`;
  }

  const first = ordered[0];
  if (first) return `/dashboard/m/${first.slug}`;

  if (dashboardFeatures.settings || platformAdmin) return "/dashboard/settings";
  if (dashboardFeatures.teamBilling) return "/dashboard/team";
  if (dashboardFeatures.help) return "/dashboard/help";
  if (dashboardFeatures.approvals) return "/dashboard/approvals";
  if (dashboardFeatures.activity) return "/dashboard/activity";
  if (dashboardFeatures.consent) return "/dashboard/consent";
  if (dashboardFeatures.finance) return "/dashboard/finance";
  if (dashboardFeatures.integrations) return "/dashboard/integrations";
  return "/dashboard/settings";
}
