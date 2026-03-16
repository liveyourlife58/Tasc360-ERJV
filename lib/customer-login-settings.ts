/**
 * Tenant customer login settings (end-user accounts for custom frontends).
 * Stored in tenant.settings.customerLogin.
 */

export type CustomerLoginSettings = {
  enabled?: boolean;
  allowSelfSignup?: boolean;
};

export function getCustomerLoginSettings(settings: unknown): CustomerLoginSettings {
  if (!settings || typeof settings !== "object") return {};
  const c = (settings as Record<string, unknown>).customerLogin;
  if (!c || typeof c !== "object") return {};
  const obj = c as Record<string, unknown>;
  return {
    enabled: obj.enabled === true,
    allowSelfSignup: obj.allowSelfSignup === true,
  };
}
