/**
 * Transactional email via Resend. Platform sends on behalf of tenants.
 * Tenant opt-in: tenant.settings.emailNotifications = { approvalRequested?, paymentReceived?, webhookFailed? }
 * Recipient: tenant.settings.notificationEmail or first user with settingsManage (from roles).
 *
 * Emails "from the tenant": set tenant.settings.emailFromAddress (e.g. notifications@tenant.com)
 * and optionally emailFromName. Domain must be verified in your Resend account. If not set,
 * From uses the platform default with the tenant name as display name and Reply-To set to
 * the tenant's notification email so replies go to the tenant.
 */

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const PLATFORM_FROM_EMAIL = process.env.EMAIL_FROM ?? "notifications@resend.dev";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function getResend() {
  if (!RESEND_API_KEY) return null;
  return new Resend(RESEND_API_KEY);
}

export type TenantFromConfig = {
  from: string; // "Name <email>" or just "email"
  replyTo?: string;
};

/** Resolve From and Reply-To for a tenant so emails appear to come from the tenant. */
export function getTenantFromConfig(
  settings: Record<string, unknown> | null,
  tenantName: string,
  fallbackReplyTo: string | null
): TenantFromConfig {
  const fromAddress = settings?.emailFromAddress as string | undefined;
  const fromName = (settings?.emailFromName as string)?.trim() || tenantName;

  if (fromAddress && typeof fromAddress === "string" && fromAddress.includes("@")) {
    const from = fromName ? `"${fromName.replace(/"/g, "")}" <${fromAddress}>` : fromAddress;
    return {
      from,
      replyTo: (settings?.emailReplyTo as string) || fallbackReplyTo || undefined,
    };
  }

  const platformFrom = fromName ? `"${fromName.replace(/"/g, "")}" <${PLATFORM_FROM_EMAIL}>` : PLATFORM_FROM_EMAIL;
  return {
    from: platformFrom,
    replyTo: fallbackReplyTo || undefined,
  };
}

export type EmailNotificationType = "approvalRequested" | "paymentReceived" | "paymentFailed" | "webhookFailed";

function getTenantEmailOptIn(settings: Record<string, unknown> | null, type: EmailNotificationType): boolean {
  const notifications = (settings?.emailNotifications as Record<string, boolean>) ?? {};
  return !!notifications[type];
}

/** Resolve recipient email for a tenant: settings.notificationEmail or first user email. */
export async function getTenantNotificationEmail(tenantId: string): Promise<string | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  const override = settings.notificationEmail as string | undefined;
  if (override && typeof override === "string" && override.includes("@")) return override;
  const roles = await prisma.role.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, permissions: true },
  });
  const manageRoleId = roles.find((r) => {
    const p = r.permissions as string[] | null;
    return Array.isArray(p) && (p.includes("settings:manage") || p.includes("*"));
  })?.id;
  if (manageRoleId) {
    const user = await prisma.user.findFirst({
      where: { tenantId, roleId: manageRoleId, isActive: true },
      select: { email: true },
    });
    if (user?.email) return user.email;
  }
  const fallback = await prisma.user.findFirst({
    where: { tenantId, isActive: true },
    select: { email: true },
  });
  return fallback?.email ?? null;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  fromConfig: TenantFromConfig
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: fromConfig.from,
      to: [to],
      subject,
      html,
      ...(fromConfig.replyTo && { reply_to: [fromConfig.replyTo] }),
    });
    return !error;
  } catch {
    return false;
  }
}

/** Send "Approval requested" email if tenant opted in. */
export async function sendApprovalRequestedEmail(tenantId: string, payload: { entityId: string; approvalType: string }): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true, name: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  if (!getTenantEmailOptIn(settings, "approvalRequested")) return;
  const to = await getTenantNotificationEmail(tenantId);
  if (!to) return;
  const fromConfig = getTenantFromConfig(settings, tenant?.name ?? "Tenant", to);
  const subject = `Approval requested: ${payload.approvalType}`;
  const html = `<p>An approval has been requested for ${payload.approvalType} (entity ${payload.entityId}).</p><p>View in your dashboard.</p>`;
  await sendEmail(to, subject, html, fromConfig);
}

/** Send "Payment received" email if tenant opted in. */
export async function sendPaymentReceivedEmail(tenantId: string, payload: { amountCents: number; currency: string; orderId?: string }): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true, name: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  if (!getTenantEmailOptIn(settings, "paymentReceived")) return;
  const to = await getTenantNotificationEmail(tenantId);
  if (!to) return;
  const fromConfig = getTenantFromConfig(settings, tenant?.name ?? "Tenant", to);
  const amount = (payload.amountCents / 100).toFixed(2);
  const subject = `Payment received: ${payload.currency} ${amount}`;
  const html = `<p>A payment of ${payload.currency} ${amount} was received.${payload.orderId ? ` Order: ${payload.orderId}` : ""}</p>`;
  await sendEmail(to, subject, html, fromConfig);
}

/** Send "Payment failed" (dunning) email if tenant opted in. */
export async function sendPaymentFailedEmail(tenantId: string, payload: { invoiceId: string }): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true, name: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  if (!getTenantEmailOptIn(settings, "paymentFailed")) return;
  const to = await getTenantNotificationEmail(tenantId);
  if (!to) return;
  const fromConfig = getTenantFromConfig(settings, tenant?.name ?? "Tenant", to);
  const subject = "Payment failed – update your payment method";
  const html = `<p>We couldn't process your subscription payment. Please update your payment method in the dashboard to avoid service interruption.</p><p>Invoice: ${payload.invoiceId}</p>`;
  await sendEmail(to, subject, html, fromConfig);
}

/** Send order confirmation (receipt) to the purchaser. Call after order is completed (free checkout or Stripe webhook). */
export async function sendOrderConfirmationEmail(
  tenantId: string,
  orderId: string
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId, tenantId },
    include: { orderLines: { include: { entity: { select: { id: true, data: true } } } }, tenant: { select: { name: true, slug: true, settings: true } } },
  });
  if (!order || order.status !== "completed") return;
  const email = (order.purchaserEmail ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const resend = getResend();
  if (!resend) return;
  const settings = (order.tenant?.settings as Record<string, unknown>) ?? {};
  const tenantName = order.tenant?.name ?? "Store";
  const fromConfig = getTenantFromConfig(settings, tenantName, email);
  const base = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const slug = order.tenant?.slug ?? "";
  const myOrdersUrl = slug ? `${base}/s/${slug}/my-orders?email=${encodeURIComponent(email)}` : "";
  const total = (order.totalCents / 100).toFixed(2);
  const lines = order.orderLines.map((l) => {
    const title = (l.entity?.data as Record<string, unknown>)?.title ?? (l.entity?.data as Record<string, unknown>)?.name ?? "Item";
    return `<tr><td>${String(title).slice(0, 80)}</td><td>${l.quantity}</td><td>$${((l.amountCents * l.quantity) / 100).toFixed(2)}</td></tr>`;
  }).join("");
  const subject = `Order confirmation from ${tenantName}`;
  const html = `
    <p>Hi ${order.purchaserName || "there"},</p>
    <p>Thanks for your order. Here are the details:</p>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
      <thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <p><strong>Total: $${total}</strong></p>
    ${myOrdersUrl ? `<p><a href="${myOrdersUrl}">View your orders</a></p>` : ""}
    <p>— ${tenantName}</p>
  `;
  await sendEmail(email, subject, html, fromConfig);
}

/** Send password reset email (platform, not tenant-branded). */
export async function sendPasswordResetEmail(to: string, tenantName: string, resetUrl: string): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: PLATFORM_FROM_EMAIL,
      to: [to],
      subject: `Reset your password – ${tenantName}`,
      html: `<p>You requested a password reset for your account at ${tenantName}.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Send invite email (set password link for new user). */
export async function sendInviteEmail(to: string, tenantName: string, setPasswordUrl: string): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: PLATFORM_FROM_EMAIL,
      to: [to],
      subject: `You're invited to ${tenantName}`,
      html: `<p>You've been invited to join ${tenantName}.</p><p><a href="${setPasswordUrl}">Set your password</a> to get started.</p><p>This link expires in 7 days.</p>`,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Send "Webhook delivery failed" email if tenant opted in. */
export async function sendWebhookFailedEmail(tenantId: string, payload: { event: string; url: string; errorMessage: string }): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true, name: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  if (!getTenantEmailOptIn(settings, "webhookFailed")) return;
  const to = await getTenantNotificationEmail(tenantId);
  if (!to) return;
  const fromConfig = getTenantFromConfig(settings, tenant?.name ?? "Tenant", to);
  const subject = `Webhook delivery failed: ${payload.event}`;
  const html = `<p>Webhook delivery to ${payload.url} failed for event "${payload.event}".</p><p>Error: ${payload.errorMessage}</p>`;
  await sendEmail(to, subject, html, fromConfig);
}

/** Send contact form message from customer site to tenant's contact email. */
export async function sendContactFormEmail(
  tenantId: string,
  to: string,
  payload: { name: string; senderEmail: string; message: string }
): Promise<boolean> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true, name: true },
  });
  if (!tenant) return false;
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  const fromConfig = getTenantFromConfig(settings, tenant.name ?? "Site", to);
  const replyTo = payload.senderEmail && payload.senderEmail.includes("@") ? payload.senderEmail : undefined;
  const resend = getResend();
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: fromConfig.from,
      to: [to],
      replyTo: replyTo ? [replyTo] : undefined,
      subject: `Contact form: ${(payload.name || "Someone").slice(0, 50)}`,
      html: [
        `<p><strong>From:</strong> ${escapeHtml(payload.name || "—")}<br/><strong>Email:</strong> ${escapeHtml(payload.senderEmail || "—")}</p>`,
        `<p><strong>Message:</strong></p><p>${escapeHtml((payload.message || "").replace(/\n/g, "<br/>"))}</p>`,
      ].join(""),
    });
    return !error;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
