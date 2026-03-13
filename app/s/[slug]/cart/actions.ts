"use server";

import { getTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { checkCapacity } from "@/lib/capacity";
import { getTenantConnectConfig } from "@/lib/stripe-connect";
import type { SiteCartItem } from "@/lib/site-cart";

export async function submitCheckout(
  tenantSlug: string,
  items: SiteCartItem[],
  purchaser: { name: string; email: string }
): Promise<{ success: true } | { redirectUrl: string } | { error: string }> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return { error: "Site not found." };
  if (!items.length) return { error: "Your cart is empty." };
  const name = (purchaser.name ?? "").trim();
  const email = (purchaser.email ?? "").trim().toLowerCase();
  if (!name) return { error: "Please enter your name." };
  if (!email) return { error: "Please enter your email." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address." };

  for (const item of items) {
    if (
      !item.entityId ||
      !item.segment ||
      !item.moduleSlug ||
      typeof item.amountCents !== "number" ||
      item.quantity < 1
    ) {
      return { error: "Invalid cart item." };
    }
  }

  const quantityByEntity = new Map<string, number>();
  for (const item of items) {
    quantityByEntity.set(item.entityId, (quantityByEntity.get(item.entityId) ?? 0) + item.quantity);
  }
  for (const [entityId, quantity] of quantityByEntity) {
    const err = await checkCapacity(tenant.id, entityId, quantity);
    if (err) return { error: err };
  }

  const totalCents = items.reduce((sum, i) => sum + i.amountCents * i.quantity, 0);
  const connectConfig = getTenantConnectConfig(tenant);

  if (connectConfig?.onboardingComplete && totalCents > 0) {
    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        purchaserName: name,
        purchaserEmail: email,
        status: "pending_payment",
        totalCents,
        orderLines: {
          create: items.map((i) => ({
            entityId: i.entityId,
            quantity: i.quantity,
            amountCents: i.amountCents,
            lineType: i.type,
          })),
        },
      },
    });
    const base = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const { createConnectCheckoutSession } = await import("@/lib/stripe-connect");
    const result = await createConnectCheckoutSession(
      tenant.id,
      connectConfig.accountId,
      items.map((i) => ({
        name: i.title,
        amountCents: i.amountCents,
        quantity: i.quantity,
        description: i.type === "donation" ? "Donation" : undefined,
      })),
      `${base}/s/${tenantSlug}/cart/thank-you`,
      `${base}/s/${tenantSlug}/cart/checkout`,
      { orderId: order.id, tenantId: tenant.id }
    );
    if ("error" in result) return { error: result.error };
    return { redirectUrl: result.url };
  }

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      purchaserName: name,
      purchaserEmail: email,
      status: "completed",
      totalCents,
      orderLines: {
        create: items.map((i) => ({
          entityId: i.entityId,
          quantity: i.quantity,
          amountCents: i.amountCents,
          lineType: i.type,
        })),
      },
    },
  });
  const { sendOrderConfirmationEmail } = await import("@/lib/email");
  sendOrderConfirmationEmail(tenant.id, order.id).catch(() => {});
  return { success: true };
}
