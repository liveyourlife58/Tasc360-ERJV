"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { ensureDefaultRoles } from "@/lib/roles";

export type AddUserState = { error?: string };

export async function addTenantUser(
  tenantId: string,
  _prev: AddUserState | null,
  formData: FormData
): Promise<AddUserState> {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) return { error: "Unauthorized" };
  await requirePermission(userId, PERMISSIONS.usersManage);

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const name = (formData.get("name") as string)?.trim() || undefined;
  const roleId = (formData.get("roleId") as string)?.trim() || null;
  const password = formData.get("password") as string;

  if (!email) return { error: "Email is required." };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters." };

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });
  if (!tenant) return { error: "Tenant not found." };

  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
    select: { id: true },
  });
  if (existing) return { error: "A user with this email already exists in your workspace." };

  const roles = await prisma.role.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
  });
  const validRoleIds = new Set(roles.map((r) => r.id));
  const assignedRoleId = roleId && validRoleIds.has(roleId) ? roleId : null;
  if (roleId && !assignedRoleId) return { error: "Invalid role." };

  const passwordHash = await hash(password, 10);

  await prisma.user.create({
    data: {
      tenantId,
      email,
      name: name || null,
      passwordHash,
      roleId: assignedRoleId,
      isActive: true,
    },
  });

  redirect("/dashboard/subscription");
}

export type UpdateUserState = { error?: string };

export async function updateTenantUser(
  tenantId: string,
  targetUserId: string,
  _prev: UpdateUserState | null,
  formData: FormData
): Promise<UpdateUserState> {
  const h = await headers();
  const currentUserId = h.get("x-user-id");
  if (!currentUserId) return { error: "Unauthorized" };
  await requirePermission(currentUserId, PERMISSIONS.usersManage);

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const name = (formData.get("name") as string)?.trim() || undefined;
  const roleId = (formData.get("roleId") as string)?.trim() || null;
  const newPassword = (formData.get("password") as string)?.trim();
  const isActive = formData.get("isActive") === "1";

  if (!email) return { error: "Email is required." };

  const targetUser = await prisma.user.findFirst({
    where: { id: targetUserId, tenantId },
    select: { id: true, email: true, roleId: true },
  });
  if (!targetUser) return { error: "User not found." };

  const roles = await prisma.role.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, permissions: true },
  });
  const validRoleIds = new Set(roles.map((r) => r.id));
  const roleHasUsersManage = (role: { permissions: unknown }) =>
    Array.isArray(role.permissions) &&
    (role.permissions.includes("*") || role.permissions.includes(PERMISSIONS.usersManage));
  const assignedRoleId = roleId && validRoleIds.has(roleId) ? roleId : null;
  if (roleId && !assignedRoleId) return { error: "Invalid role." };

  const isEditingSelf = currentUserId === targetUserId;
  if (isEditingSelf) {
    if (assignedRoleId) {
      const newRole = roles.find((r) => r.id === assignedRoleId);
      if (newRole && !roleHasUsersManage(newRole))
        return { error: "You cannot assign yourself a role that cannot manage users (you would lose access)." };
    }
  }

  if (email !== targetUser.email) {
    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
      select: { id: true },
    });
    if (existing) return { error: "A user with this email already exists in your workspace." };
  }

  const effectiveActive = isEditingSelf ? true : isActive;
  const update: {
    email: string;
    name?: string | null;
    roleId: string | null;
    isActive: boolean;
    deactivatedAt?: Date | null;
    passwordHash?: string;
  } = {
    email,
    name: name || null,
    roleId: assignedRoleId,
    isActive: effectiveActive,
    deactivatedAt: effectiveActive ? null : new Date(),
  };
  if (newPassword.length >= 8) {
    update.passwordHash = await hash(newPassword, 10);
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: update,
  });

  redirect("/dashboard/subscription");
}
