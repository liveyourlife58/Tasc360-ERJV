/**
 * Stripe webhooks: platform (subscription) and Connect (tenant customer payments).
 * Platform events: no Stripe-Account header. Connect events: Stripe-Account = acct_xxx.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  syncTenantSubscriptionFromStripe,
  clearTenantSubscription,
} from "@/lib/stripe-platform";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}
const platformSecret = process.env.STRIPE_WEBHOOK_SECRET;
const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

/** Resolve tenant ID for audit logging. Connect: from account. Platform: from event metadata or subscription. */
async function getTenantIdForAudit(event: Stripe.Event, connectAccountId: string | null): Promise<string | null> {
  if (connectAccountId) {
    const tenant = await prisma.tenant.findFirst({
      where: { settings: { path: ["stripeConnectAccountId"], equals: connectAccountId } },
      select: { id: true },
    });
    return tenant?.id ?? null;
  }
  const obj = event.data.object as { metadata?: { tenantId?: string }; subscription?: string };
  if (obj.metadata?.tenantId) return obj.metadata.tenantId;
  if (typeof obj.subscription === "string") {
    try {
      const sub = await getStripe().subscriptions.retrieve(obj.subscription);
      return (sub.metadata?.tenantId as string) ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }
  const connectAccountId = request.headers.get("stripe-account");
  const secret = connectAccountId && connectSecret ? connectSecret : platformSecret;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const existing = await prisma.stripeProcessedEvent.findUnique({
    where: { id: event.id },
  });
  if (existing) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const result = connectAccountId
    ? await handleConnectEvent(event, connectAccountId)
    : await handlePlatformEvent(event);

  await prisma.stripeProcessedEvent.create({ data: { id: event.id } }).catch(() => {});

  const tenantId = await getTenantIdForAudit(event, connectAccountId);
  if (tenantId) {
    const { logAuditEvent } = await import("@/lib/audit");
    logAuditEvent(tenantId, "stripe_webhook_processed", {
      stripeEventId: event.id,
      type: event.type,
    }, null).catch(() => {});
  }

  return result;
}

async function handlePlatformEvent(event: Stripe.Event): Promise<NextResponse> {
  switch (event.type) {
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      await syncTenantSubscriptionFromStripe(sub.id);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (tenantId) await clearTenantSubscription(tenantId);
      break;
    }
    case "invoice.paid":
      break;
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
      const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      const tenantId = subId
        ? (await (async () => {
            const stripe = getStripe();
            const sub = await stripe.subscriptions.retrieve(subId);
            return (sub.metadata?.tenantId as string) ?? null;
          })())
        : null;
      if (tenantId) {
        const { sendPaymentFailedEmail } = await import("@/lib/email");
        sendPaymentFailedEmail(tenantId, { invoiceId: invoice.id ?? "" }).catch(() => {});
      }
      break;
    }
    default:
      // Unhandled event type
      break;
  }
  return NextResponse.json({ received: true });
}

async function handleConnectEvent(event: Stripe.Event, connectAccountId: string): Promise<NextResponse> {
  const tenant = await prisma.tenant.findFirst({
    where: {
      settings: { path: ["stripeConnectAccountId"], equals: connectAccountId },
    },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ received: true }); // ignore if tenant not found
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "payment" && session.mode !== "subscription") break;
      const orderId = session.metadata?.orderId as string | undefined;
      const tenantId = session.metadata?.tenantId as string | undefined;
      if (!orderId || tenantId !== tenant.id) break;
      const paymentIntentId = session.payment_intent as string | undefined;
      const amountTotal = session.amount_total ?? 0;
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "completed" },
      });
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { orderLines: { orderBy: { id: "asc" }, take: 1 } },
      });
      const firstEntityId = order?.orderLines[0]?.entityId;
      const externalId = paymentIntentId ?? session.id;
      if (firstEntityId && externalId) {
        const existing = await prisma.payment.findFirst({
          where: { tenantId: tenant.id, externalId },
        });
        if (existing) {
          await prisma.payment.update({
            where: { id: existing.id },
            data: { status: "succeeded" },
          });
        } else {
          await prisma.payment.create({
            data: {
              tenantId: tenant.id,
              entityId: firstEntityId,
              amountCents: amountTotal,
              currency: (session.currency ?? "usd").toUpperCase().slice(0, 3),
              status: "succeeded",
              provider: "stripe",
              externalId,
              metadata: { orderId } as object,
            },
          });
        }
      }
      const currency = (session.currency ?? "usd").toUpperCase().slice(0, 3);
      const { sendPaymentReceivedEmail, sendOrderConfirmationEmail } = await import("@/lib/email");
      sendPaymentReceivedEmail(tenant.id, { amountCents: amountTotal, currency, orderId }).catch(() => {});
      sendOrderConfirmationEmail(tenant.id, orderId).catch(() => {});
      break;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const tenantIdMeta = pi.metadata?.tenantId as string | undefined;
      const orderId = pi.metadata?.orderId as string | undefined;
      if (!orderId || tenantIdMeta !== tenant.id) break;
      await prisma.order.updateMany({
        where: { id: orderId, tenantId: tenant.id },
        data: { status: "completed" },
      });
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { orderLines: { orderBy: { id: "asc" }, take: 1 } },
      });
      const firstEntityId = order?.orderLines[0]?.entityId;
      if (firstEntityId) {
        const existing = await prisma.payment.findFirst({
          where: { tenantId: tenant.id, externalId: pi.id },
        });
        if (existing) {
          await prisma.payment.update({
            where: { id: existing.id },
            data: { status: "succeeded" },
          });
        } else {
          await prisma.payment.create({
            data: {
              tenantId: tenant.id,
              entityId: firstEntityId,
              amountCents: pi.amount,
              currency: (pi.currency ?? "usd").toUpperCase().slice(0, 3),
              status: "succeeded",
              provider: "stripe",
              externalId: pi.id,
              metadata: { orderId } as object,
            },
          });
        }
      }
      break;
    }
    default:
      break;
  }
  return NextResponse.json({ received: true });
}
