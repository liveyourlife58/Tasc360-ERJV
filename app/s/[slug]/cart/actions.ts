"use server";

import { getTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import type { SiteCartItem } from "@/lib/site-cart";

export async function submitCheckout(
  tenantSlug: string,
  items: SiteCartItem[],
  purchaser: { name: string; email: string }
): Promise<{ success: true } | { error: string }> {
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

  const totalCents = items.reduce((sum, i) => sum + i.amountCents * i.quantity, 0);

  await prisma.order.create({
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

  return { success: true };
}
