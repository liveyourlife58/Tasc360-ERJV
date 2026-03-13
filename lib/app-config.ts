/**
 * Central config for layout and UI constants. Change here instead of scattering magic numbers.
 */

export const APP_CONFIG = {
  /** Max width (px) of the dashboard main content area. */
  dashboardMaxWidth: 1400,
  /** Entity list page size (pagination). */
  entityPageSize: 50,
  /** Max entities fetched per module for list (before pagination slice). */
  entityFetchLimit: 500,
  /** Subscription grace period (days) when payment is past_due. Overridden by env SUBSCRIPTION_GRACE_DAYS. */
  subscriptionGraceDays: 7,
  /** API rate limit per tenant per minute. Overridden by env API_RATE_LIMIT_PER_MINUTE. */
  apiRateLimitPerMinute: 100,
  /** Max webhook deliveries to keep per tenant. */
  webhookDeliveriesMax: 50,
  /** Max entities per module in export. */
  exportEntitiesPerModuleLimit: 2000,
  /** Max request body size (bytes) for /api/v1 POST/PATCH. 1MB default. */
  apiMaxBodyBytes: 1024 * 1024,
} as const;

export function getSubscriptionGraceDays(): number {
  const env = process.env.SUBSCRIPTION_GRACE_DAYS;
  const n = env ? parseInt(env, 10) : NaN;
  return Number.isNaN(n) || n < 0 ? APP_CONFIG.subscriptionGraceDays : Math.min(365, n);
}

export function getApiRateLimitPerMinute(): number {
  const env = process.env.API_RATE_LIMIT_PER_MINUTE;
  const n = env ? parseInt(env, 10) : NaN;
  return Number.isNaN(n) || n < 1 ? APP_CONFIG.apiRateLimitPerMinute : Math.min(10000, n);
}
