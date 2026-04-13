/**
 * Dashboard feature flags: controlled by platform admin per tenant.
 * Stored in tenant.settings.dashboardFeatures = { [key]: boolean }.
 * Default true when not set so existing tenants keep full dashboard access.
 */

export type DashboardFeatureKey =
  | "help"
  /** Summary home at `/dashboard` (stats + module tiles). */
  | "workspaceHome"
  | "approvals"
  | "activity"
  | "consent"
  | "finance"
  | "integrations"
  /** Team roster, roles, invites + plan & billing (single page at /dashboard/team). */
  | "teamBilling"
  | "settings"
  /** Public customer site at `/s/[slug]` (preview, cart, public modules, contact). */
  | "customerSite";

export const DASHBOARD_FEATURE_KEYS: DashboardFeatureKey[] = [
  "help",
  "workspaceHome",
  "approvals",
  "activity",
  "consent",
  "finance",
  "integrations",
  "teamBilling",
  "settings",
  "customerSite",
];

const DEFAULTS: Record<DashboardFeatureKey, boolean> = {
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

export type DashboardFeatures = Record<DashboardFeatureKey, boolean>;

/**
 * Legacy `team` and `subscription` were merged into `teamBilling`.
 * If either legacy flag is stored, effective access is (team ?? true) || (subscription ?? true)
 * to match previous defaults when a key was omitted.
 */
function legacyTeamBillingEnabled(raw: Record<string, unknown>): boolean | null {
  const hasTeam = "team" in raw;
  const hasSub = "subscription" in raw;
  if (!hasTeam && !hasSub) return null;
  const t = raw.team;
  const s = raw.subscription;
  const teamOn = hasTeam && typeof t === "boolean" ? t : true;
  const subOn = hasSub && typeof s === "boolean" ? s : true;
  return teamOn || subOn;
}

export function isDashboardFeatureEnabled(
  settings: unknown,
  feature: DashboardFeatureKey
): boolean {
  if (!settings || typeof settings !== "object") return DEFAULTS[feature];
  const df = (settings as Record<string, unknown>).dashboardFeatures;
  if (!df || typeof df !== "object") return DEFAULTS[feature];
  const raw = df as Record<string, unknown>;

  if (feature === "teamBilling") {
    if (typeof raw.teamBilling === "boolean") return raw.teamBilling;
    const legacy = legacyTeamBillingEnabled(raw);
    if (legacy !== null) return legacy;
    return DEFAULTS.teamBilling;
  }

  const value = raw[feature];
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

/** Public `/s/[slug]` customer site (modules, cart, contact). */
export function isCustomerSiteEnabled(settings: unknown): boolean {
  return isDashboardFeatureEnabled(settings, "customerSite");
}

/** Path prefix to dashboard feature key (for redirect when disabled). */
export const DASHBOARD_PATH_TO_FEATURE: Record<string, DashboardFeatureKey> = {
  "/dashboard/help": "help",
  "/dashboard/approvals": "approvals",
  "/dashboard/activity": "activity",
  "/dashboard/consent": "consent",
  "/dashboard/finance": "finance",
  "/dashboard/integrations": "integrations",
  "/dashboard/team": "teamBilling",
  "/dashboard/subscription": "teamBilling",
  "/dashboard/settings": "settings",
};
