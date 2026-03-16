/**
 * Dashboard feature flags: controlled by platform admin per tenant.
 * Stored in tenant.settings.dashboardFeatures = { [key]: boolean }.
 * Default true when not set so existing tenants keep full dashboard access.
 */

export type DashboardFeatureKey =
  | "help"
  | "approvals"
  | "activity"
  | "consent"
  | "finance"
  | "integrations"
  | "team"
  | "subscription"
  | "settings";

export const DASHBOARD_FEATURE_KEYS: DashboardFeatureKey[] = [
  "help",
  "approvals",
  "activity",
  "consent",
  "finance",
  "integrations",
  "team",
  "subscription",
  "settings",
];

const DEFAULTS: Record<DashboardFeatureKey, boolean> = {
  help: true,
  approvals: true,
  activity: true,
  consent: true,
  finance: true,
  integrations: true,
  team: true,
  subscription: true,
  settings: true,
};

export type DashboardFeatures = Record<DashboardFeatureKey, boolean>;

export function isDashboardFeatureEnabled(
  settings: unknown,
  feature: DashboardFeatureKey
): boolean {
  if (!settings || typeof settings !== "object") return DEFAULTS[feature];
  const df = (settings as Record<string, unknown>).dashboardFeatures;
  if (!df || typeof df !== "object") return DEFAULTS[feature];
  const value = (df as Record<string, unknown>)[feature];
  if (typeof value === "boolean") return value;
  return DEFAULTS[feature];
}

export function getDashboardFeatures(settings: unknown): DashboardFeatures {
  const out = {} as DashboardFeatures;
  for (const key of DASHBOARD_FEATURE_KEYS) {
    out[key] = isDashboardFeatureEnabled(settings, key);
  }
  return out;
}

/** Path prefix to dashboard feature key (for redirect when disabled). */
export const DASHBOARD_PATH_TO_FEATURE: Record<string, DashboardFeatureKey> = {
  "/dashboard/help": "help",
  "/dashboard/approvals": "approvals",
  "/dashboard/activity": "activity",
  "/dashboard/consent": "consent",
  "/dashboard/finance": "finance",
  "/dashboard/integrations": "integrations",
  "/dashboard/team": "team",
  "/dashboard/subscription": "subscription",
  "/dashboard/settings": "settings",
};
