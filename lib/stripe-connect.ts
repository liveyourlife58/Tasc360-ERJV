/**
 * Stripe Connect: tenants charge their customers via their own Stripe account.
 * Uses STRIPE_SECRET_KEY (platform) with stripe_account for Connect requests.
 */

import Stripe from "stripe";
import { prisma } from "./prisma";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export type ConnectConfig = {
  accountId: string;
  onboardingComplete: boolean;
};

export function getTenantConnectConfig(tenant: { settings: unknown }): ConnectConfig | null {
  const s = tenant.settings as Record<string, unknown> | null;
  if (!s) return null;
  const accountId = s.stripeConnectAccountId as string | undefined;
  if (!accountId || typeof accountId !== "string") return null;
  const onboardingComplete = s.stripeConnectOnboardingComplete === true;
  return { accountId, onboardingComplete };
}

/** Create a Connect Express account for the tenant. Returns account id. */
export async function createConnectAccount(
  tenantId: string,
  email: string,
  businessName: string
): Promise<{ accountId: string } | { error: string }> {
  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    country: "US",
    email: email || undefined,
    capabilities: { card_payments: { requested: true } },
    metadata: { tenantId },
    business_type: "company",
    company: { name: businessName || undefined },
  });
  const settings = await getTenantSettingsForUpdate(tenantId);
  settings.stripeConnectAccountId = account.id;
  settings.stripeConnectOnboardingComplete = false;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: settings as object },
  });
  return { accountId: account.id };
}

/** Create an Account Link for onboarding (Stripe-hosted). */
export async function createConnectAccountLink(
  tenantId: string,
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<{ url: string } | { error: string }> {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return { url: link.url };
}

/** Mark Connect onboarding complete (call after checking account.charges_enabled or from Dashboard). */
export async function setConnectOnboardingComplete(tenantId: string, complete: boolean): Promise<void> {
  const settings = await getTenantSettingsForUpdate(tenantId);
  settings.stripeConnectOnboardingComplete = complete;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: settings as object },
  });
}

/** Create Checkout Session for tenant's customer (payment goes to tenant's Connect account). */
export async function createConnectCheckoutSession(
  tenantId: string,
  connectAccountId: string,
  lineItems: { name: string; amountCents: number; quantity: number; description?: string }[],
  successUrl: string,
  cancelUrl: string,
  metadata: Record<string, string>
): Promise<{ sessionId: string; url: string } | { error: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: lineItems.map((item) => ({
        price_data: {
          currency: "usd",
          unit_amount: item.amountCents,
          product_data: {
            name: item.name,
            description: item.description,
            images: undefined,
          },
        },
        quantity: item.quantity,
      })),
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    },
    { stripeAccount: connectAccountId }
  );
  const url = session.url;
  if (!url || !session.id) return { error: "Failed to create checkout session." };
  return { sessionId: session.id, url };
}

async function getTenantSettingsForUpdate(tenantId: string): Promise<Record<string, unknown>> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  return ((tenant?.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>;
}
