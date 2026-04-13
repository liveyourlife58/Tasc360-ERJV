"use server";

import crypto from "crypto";
import { headers } from "next/headers";
import { hash } from "bcryptjs";
import { createPlatformCheckoutSession, createPlatformPortalSession, updatePlatformSubscriptionQuantity } from "@/lib/stripe-platform";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { ensureDefaultRoles } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";

const INVITE_TOKEN_EXPIRY_DAYS = 7;

export async function createSubscriptionCheckout(): Promise<{ error?: string; redirectUrl?: string }> {
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId || !userId) return { error: "Unauthorized" };
  const ok = await hasPermission(userId, PERMISSIONS.settingsManage);
  if (!ok) return { error: "You don't have permission to manage billing." };
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  const user = await prisma.user.findFirst({
    where: { tenantId, isActive: true },
    select: { email: true, name: true },
  });
  const base = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  let result: Awaited<ReturnType<typeof createPlatformCheckoutSession>>;
  try {
    result = await createPlatformCheckoutSession(
      tenantId,
      `${base}/dashboard/team?success=1`,
      `${base}/dashboard/team?cancel=1`,
      user?.email ?? "",
      tenant?.name ?? user?.name ?? ""
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe checkout failed.";
    return { error: msg.includes("STRIPE_SECRET_KEY") ? "Stripe is not configured (STRIPE_SECRET_KEY)." : msg };
  }
  if ("error" in result) return { error: result.error };
  return { redirectUrl: result.url };
}

export async function openBillingPortal(): Promise<{ error?: string; redirectUrl?: string }> {
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId || !userId) return { error: "Unauthorized" };
  const ok = await hasPermission(userId, PERMISSIONS.settingsManage);
  if (!ok) return { error: "You don't have permission to manage billing." };
  const base = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  let result: Awaited<ReturnType<typeof createPlatformPortalSession>>;
  try {
    result = await createPlatformPortalSession(tenantId, `${base}/dashboard/team`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Billing portal failed.";
    return { error: msg.includes("STRIPE_SECRET_KEY") ? "Stripe is not configured (STRIPE_SECRET_KEY)." : msg };
  }
  if ("error" in result) return { error: result.error };
  return { redirectUrl: result.url };
}

export async function addTenantUser(
  tenantId: string,
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const userId = (await headers()).get("x-user-id");
  if (!userId) return { error: "Unauthorized" };
  const ok = await hasPermission(userId, PERMISSIONS.usersManage);
  if (!ok) return { error: "You don't have permission to add users." };
  const email = (formData.get("email") as string)?.trim()?.toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  const password = (formData.get("password") as string)?.trim();
  const inviteOnly = formData.get("inviteOnly") === "1";
  const roleId = (formData.get("roleId") as string)?.trim() || null;
  if (!email) return { error: "Email is required." };
  if (!inviteOnly && (!password || password.length < 8)) return { error: "Password must be at least 8 characters (or use Invite by email)." };
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (existing) return { error: "A user with this email already exists." };
  const { standardRoleId } = await ensureDefaultRoles(tenantId);
  const passwordHash = inviteOnly ? null : await hash(password, 10);
  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      name,
      passwordHash,
      roleId: roleId || standardRoleId,
      isActive: true,
    },
  });
  if (inviteOnly) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    });
    const base = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const setPasswordUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    await sendInviteEmail(email, tenant?.name ?? "Workspace", setPasswordUrl);
    const { logAuditEvent } = await import("@/lib/audit");
    await logAuditEvent(tenantId, "user_invited", { invitedUserId: user.id, email }, userId);
  }
  await updatePlatformSubscriptionQuantity(tenantId).catch(() => {});
  return {};
}

export async function updateTenantUser(
  tenantId: string,
  targetUserId: string,
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const userId = (await headers()).get("x-user-id");
  if (!userId) return { error: "Unauthorized" };
  const ok = await hasPermission(userId, PERMISSIONS.usersManage);
  if (!ok) return { error: "You don't have permission to edit users." };
  const email = (formData.get("email") as string)?.trim()?.toLowerCase();
  const name = (formData.get("name") as string)?.trim() || null;
  const roleId = (formData.get("roleId") as string)?.trim() || null;
  const password = (formData.get("password") as string)?.trim();
  const isActive = formData.get("isActive") === "1";
  if (!email) return { error: "Email is required." };
  const target = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId },
  });
  if (!target) return { error: "User not found." };
  const data: { email: string; name: string | null; roleId: string | null; isActive: boolean; deactivatedAt?: Date | null; passwordHash?: string } = {
    email,
    name,
    roleId: roleId || null,
    isActive,
    deactivatedAt: isActive ? null : new Date(),
  };
  if (password.length >= 8) data.passwordHash = await hash(password, 10);
  await prisma.user.update({
    where: { id: targetUserId },
    data,
  });
  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(tenantId, "user_updated", {
    targetUserId,
    email,
    roleId: data.roleId ?? undefined,
    isActive: data.isActive,
  }, userId);
  await updatePlatformSubscriptionQuantity(tenantId).catch(() => {});
  return {};
}
