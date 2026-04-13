/**
 * Platform (SaaS) Stripe: the app's Stripe account charges tenants for subscription.
 * Uses STRIPE_SECRET_KEY. Create customers, subscriptions, and billing portal.
 */

import Stripe from "stripe";
import { prisma } from "./prisma";
import { getTrialDays } from "./app-config";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

/** Platform Stripe Price ID for per-seat subscription (from env or Dashboard). */
export function getPlatformPriceId(): string | null {
  return process.env.STRIPE_PLATFORM_PRICE_ID?.trim() || null;
}

/** Get or create Stripe Customer for tenant. Returns customer id. */
export async function getOrCreatePlatformCustomer(
  tenantId: string,
  email: string,
  name: string
): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });
  if (tenant?.stripeCustomerId) return tenant.stripeCustomerId;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
    metadata: { tenantId },
  });
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/** Create a Checkout Session for subscription (redirect tenant to Stripe). */
export async function createPlatformCheckoutSession(
  tenantId: string,
  successUrl: string,
  cancelUrl: string,
  customerEmail: string,
  tenantName: string
): Promise<{ url: string } | { error: string }> {
  const priceId = getPlatformPriceId();
  if (!priceId) return { error: "Platform billing is not configured (STRIPE_PLATFORM_PRICE_ID)." };
  if (priceId.startsWith("prod_")) {
    return {
      error:
        "STRIPE_PLATFORM_PRICE_ID must be a Price ID (price_…), not a Product ID (prod_…). In Stripe: Product → Pricing → copy the Price ID.",
    };
  }
  const stripe = getStripe();
  const customerId = await getOrCreatePlatformCustomer(tenantId, customerEmail, tenantName);
  const activeCount = await prisma.user.count({ where: { tenantId, isActive: true } });
  const quantity = Math.max(1, activeCount);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity }],
    success_url: successUrl.includes("?") ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}` : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { tenantId },
      trial_period_days: getTrialDays() > 0 ? getTrialDays() : undefined,
    },
    metadata: { tenantId },
    allow_promotion_codes: true,
  });
  const url = session.url;
  if (!url) return { error: "Failed to create checkout session." };
  return { url };
}

/** Create Billing Portal session (manage subscription, payment method). */
export async function createPlatformPortalSession(
  tenantId: string,
  returnUrl: string
): Promise<{ url: string } | { error: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });
  if (!tenant?.stripeCustomerId) return { error: "No billing account. Subscribe first." };
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: returnUrl,
  });
  if (!session.url) return { error: "Failed to create portal session." };
  return { url: session.url };
}

/** Update subscription quantity (per-seat). Call when user count changes. */
export async function updatePlatformSubscriptionQuantity(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeSubscriptionId: true },
  });
  if (!tenant?.stripeSubscriptionId) return;
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
  const item = subscription.items.data[0];
  if (!item) return;
  const activeCount = await prisma.user.count({ where: { tenantId, isActive: true } });
  const quantity = Math.max(1, activeCount);
  if (item.quantity === quantity) return;
  await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
    items: [{ id: item.id, quantity }],
    proration_behavior: "create_prorations",
  });
}

/** After checkout success: retrieve session and sync tenant subscription. */
export async function syncTenantSubscriptionFromCheckoutSession(sessionId: string): Promise<void> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  const raw = session.subscription;
  // With expand: ["subscription"], Stripe returns a full Subscription object, not sub_xxx string.
  if (typeof raw === "object" && raw !== null && "id" in raw) {
    await applyStripeSubscriptionToTenant(raw as Stripe.Subscription);
    return;
  }
  if (typeof raw === "string" && raw.length > 0) {
    await syncTenantSubscriptionFromStripe(raw);
  }
}

/** Persist subscription fields from a Stripe Subscription object (expanded session or API retrieve). */
async function applyStripeSubscriptionToTenant(sub: Stripe.Subscription): Promise<{ tenantId: string } | null> {
  const tenantId = sub.metadata?.tenantId;
  if (!tenantId || typeof tenantId !== "string") return null;
  const subData = sub as Stripe.Subscription & { current_period_end?: number };
  const periodEnd = subData.current_period_end;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      subscriptionCurrentPeriodEnd:
        typeof periodEnd === "number" ? new Date(periodEnd * 1000) : null,
    },
  });
  return { tenantId };
}

/** Sync tenant subscription fields from Stripe subscription (e.g. after webhook). */
export async function syncTenantSubscriptionFromStripe(
  subscriptionId: string
): Promise<{ tenantId: string } | null> {
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  return applyStripeSubscriptionToTenant(sub);
}

/** Clear subscription when canceled/deleted. */
export async function clearTenantSubscription(tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripeSubscriptionId: null,
      subscriptionStatus: "canceled",
      subscriptionCurrentPeriodEnd: null,
    },
  });
}
