"use server";

import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type ResetPasswordState = { error?: string };

export async function resetPassword(
  _prev: ResetPasswordState | null,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = (formData.get("token") as string)?.trim();
  const password = formData.get("password") as string;

  if (!token) return { error: "Invalid or expired reset link." };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters." };

  const row = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, tenantId: true } } },
  });
  if (!row || row.expiresAt < new Date()) {
    return { error: "Invalid or expired reset link. Please request a new one." };
  }

  const passwordHash = await hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({ where: { id: row.id } }),
  ]);

  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(row.user.tenantId, "auth_password_reset_completed", { userId: row.userId }, row.userId);

  redirect("/login?reset=1");
}
