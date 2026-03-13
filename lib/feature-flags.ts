/**
 * Tenant feature flags. Stored in tenant.settings.features = { [key]: boolean }.
 * Default true when not set so existing tenants keep current behavior.
 */

export type FeatureKey = "myOrders" | "refunds";

const DEFAULTS: Record<FeatureKey, boolean> = {
  myOrders: true,
  refunds: true,
};

export function isFeatureEnabled(
  settings: unknown,
  feature: FeatureKey
): boolean {
  if (!settings || typeof settings !== "object") return DEFAULTS[feature];
  const features = (settings as Record<string, unknown>).features;
  if (!features || typeof features !== "object") return DEFAULTS[feature];
  const value = (features as Record<string, unknown>)[feature];
  if (typeof value === "boolean") return value;
  return DEFAULTS[feature];
}

export function getFeatureFlags(settings: unknown): Record<FeatureKey, boolean> {
  return {
    myOrders: isFeatureEnabled(settings, "myOrders"),
    refunds: isFeatureEnabled(settings, "refunds"),
  };
}
