"use server";

import { redirect } from "next/navigation";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const workspace = (formData.get("workspace") as string)?.trim().toLowerCase();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!workspace || !email || !password) {
    return { error: "Workspace, email, and password are required." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: workspace, isActive: true },
    select: { id: true },
  });
  if (!tenant) {
    return { error: "Invalid workspace or password." };
  }

  const user = await prisma.user.findUnique({
    where: {
      tenantId_email: { tenantId: tenant.id, email },
    },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      isActive: true,
      accountLocked: true,
      lockedUntil: true,
      failedLoginAttempts: true,
    },
  });
  if (!user || !user.isActive || !user.passwordHash) {
    return { error: "Invalid workspace or password." };
  }

  const now = new Date();
  if (user.accountLocked && user.lockedUntil && user.lockedUntil > now) {
    return {
      error: `Account temporarily locked. Try again after ${user.lockedUntil.toLocaleTimeString()}.`,
    };
  }
  if (user.accountLocked && user.lockedUntil && user.lockedUntil <= now) {
    await prisma.user.update({
      where: { id: user.id },
      data: { accountLocked: false, lockedUntil: null, failedLoginAttempts: 0 },
    });
  }

  const ok = await compare(password, user.passwordHash);
  if (!ok) {
    const newAttempts = user.failedLoginAttempts + 1;
    const updates: { failedLoginAttempts: number; accountLocked?: boolean; lockedUntil?: Date | null } = {
      failedLoginAttempts: newAttempts,
    };
    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockEnd = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
      updates.accountLocked = true;
      updates.lockedUntil = lockEnd;
    }
    await prisma.user.update({ where: { id: user.id }, data: updates });
    return { error: "Invalid workspace or password." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      accountLocked: false,
      lockedUntil: null,
      lastLoginAt: now,
    },
  });

  await setSession({
    userId: user.id,
    tenantId: tenant.id,
    email: user.email,
    name: user.name ?? undefined,
  });

  const { logAuditEvent } = await import("@/lib/audit");
  await logAuditEvent(tenant.id, "auth_login", { email: user.email }, user.id);

  const from = (formData.get("from") as string) || "/dashboard";
  const target = from.startsWith("/dashboard") ? from : "/dashboard";
  redirect(target);
}

export async function logout() {
  const { clearSession } = await import("@/lib/auth");
  await clearSession();
  redirect("/login");
}
