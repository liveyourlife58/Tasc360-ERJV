"use server";

import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

const TOKEN_EXPIRY_HOURS = 1;

export type ForgotPasswordState = { error?: string; success?: boolean };

export async function requestPasswordReset(
  _prev: ForgotPasswordState | null,
  formData: FormData
): Promise<ForgotPasswordState> {
  const workspace = (formData.get("workspace") as string)?.trim().toLowerCase();
  const email = (formData.get("email") as string)?.trim();

  if (!workspace || !email) {
    return { error: "Workspace and email are required." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: workspace, isActive: true },
    select: { id: true, name: true },
  });
  if (!tenant) {
    return { success: true }; // Don't reveal whether workspace exists
  }

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    select: { id: true },
  });
  if (!user) {
    return { success: true }; // Don't reveal whether email exists
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
  const sent = await sendPasswordResetEmail(email, tenant.name, resetUrl);
  if (!sent) {
    return { error: "We couldn't send the reset email. Please try again later." };
  }

  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(tenant.id, "auth_password_reset_requested", { email }, null);

  return { success: true };
}
