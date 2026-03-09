/**
 * Tenant dashboard settings from tenants.settings.dashboard
 */

export type DashboardBranding = {
  name?: string;
  logo?: string;
  primaryColor?: string;
};

export type DashboardHome =
  | { type: "module"; moduleSlug: string }
  | { type: "view"; moduleSlug: string; viewId: string };

export type DashboardSettings = {
  branding?: DashboardBranding;
  home?: DashboardHome;
  sidebarOrder?: string[];
};

export function getDashboardSettings(settings: unknown): DashboardSettings {
  if (!settings || typeof settings !== "object") return {};
  const d = (settings as Record<string, unknown>).dashboard;
  if (!d || typeof d !== "object") return {};
  const dash = d as Record<string, unknown>;
  return {
    branding: dash.branding as DashboardBranding | undefined,
    home: dash.home as DashboardHome | undefined,
    sidebarOrder: Array.isArray(dash.sidebarOrder)
      ? (dash.sidebarOrder as string[])
      : undefined,
  };
}

/**
 * Order module list by sidebarOrder (slugs). Modules not in list go after, by original order.
 */
export function orderModulesBySettings<T extends { slug: string }>(
  modules: T[],
  sidebarOrder: string[] | undefined
): T[] {
  if (!sidebarOrder?.length) return modules;
  const bySlug = new Map(modules.map((m) => [m.slug, m]));
  const result: T[] = [];
  for (const slug of sidebarOrder) {
    const m = bySlug.get(slug);
    if (m) result.push(m);
  }
  for (const m of modules) {
    if (!sidebarOrder.includes(m.slug)) result.push(m);
  }
  return result;
}
