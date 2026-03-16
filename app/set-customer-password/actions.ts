"use server";

import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type SetCustomerPasswordState = { error?: string };

export async function setCustomerPassword(
  _prev: SetCustomerPasswordState | null,
  formData: FormData
): Promise<SetCustomerPasswordState> {
  const token = (formData.get("token") as string)?.trim();
  const password = formData.get("password") as string;

  if (!token) return { error: "Invalid or expired link." };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters." };

  const now = new Date();
  const byInvite = await prisma.tenantEndUser.findFirst({
    where: { inviteToken: token, inviteTokenExpiresAt: { gt: now } },
    select: { id: true, tenantId: true },
  });
  const byReset = await prisma.tenantEndUser.findFirst({
    where: { resetToken: token, resetTokenExpiresAt: { gt: now } },
    select: { id: true, tenantId: true },
  });
  const row = byInvite ?? byReset;
  if (!row) return { error: "Invalid or expired link. Please request a new one." };

  const passwordHash = await hash(password, 10);
  await prisma.tenantEndUser.update({
    where: { id: row.id },
    data: {
      passwordHash,
      inviteToken: null,
      inviteTokenExpiresAt: null,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  });

  redirect("/set-customer-password?success=1");
}
