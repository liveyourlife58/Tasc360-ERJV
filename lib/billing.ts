/**
 * Billing configuration and helpers.
 * Platform fee: fixed monthly amount. Per-user fee: per active seat per month.
 * When Stripe is connected, create a subscription with these amounts and quantity = active user count.
 */

const DEFAULT_PLATFORM_FEE_USD = 0;
const DEFAULT_PER_USER_FEE_USD = 25;

export type BillingConfig = {
  platformFeeUsd: number;
  perUserFeeUsd: number;
  platformFeeCents: number;
  perUserFeeCents: number;
};

function parseEnvNumber(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw == null || raw === "") return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

/** Read billing config from env (BILLING_PLATFORM_FEE_USD, BILLING_PER_USER_FEE_USD) or defaults. */
export function getBillingConfig(): BillingConfig {
  const platformFeeUsd = parseEnvNumber("BILLING_PLATFORM_FEE_USD", DEFAULT_PLATFORM_FEE_USD);
  const perUserFeeUsd = parseEnvNumber("BILLING_PER_USER_FEE_USD", DEFAULT_PER_USER_FEE_USD);
  return {
    platformFeeUsd,
    perUserFeeUsd,
    platformFeeCents: Math.round(platformFeeUsd * 100),
    perUserFeeCents: Math.round(perUserFeeUsd * 100),
  };
}

/** Estimated monthly total in USD (platform + per-user × activeCount). */
export function computeMonthlyTotalUsd(activeUserCount: number): number {
  const { platformFeeUsd, perUserFeeUsd } = getBillingConfig();
  return platformFeeUsd + activeUserCount * perUserFeeUsd;
}
