"use server";

import { headers } from "next/headers";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function createRole(
  tenantId: string,
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const userId = (await headers()).get("x-user-id");
  if (!userId) return { error: "Unauthorized" };
  const ok = await hasPermission(userId, PERMISSIONS.usersManage);
  if (!ok) return { error: "You don't have permission to manage roles." };
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Role name is required." };
  const description = (formData.get("description") as string)?.trim() || null;
  const permissions = formData.getAll("permissions") as string[];
  const perms = permissions.filter((p) => typeof p === "string" && p.length > 0);
  const existing = await prisma.role.findFirst({
    where: { tenantId, name },
  });
  if (existing) return { error: "A role with this name already exists." };
  await prisma.role.create({
    data: {
      tenantId,
      name,
      description,
      permissions: perms.length > 0 ? perms : [],
      isActive: true,
    },
  });
  return {};
}

export async function updateRole(
  tenantId: string,
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  const userId = (await headers()).get("x-user-id");
  if (!userId) return { error: "Unauthorized" };
  const ok = await hasPermission(userId, PERMISSIONS.usersManage);
  if (!ok) return { error: "You don't have permission to manage roles." };
  const roleId = (formData.get("roleId") as string)?.trim();
  if (!roleId) return { error: "Role is required." };
  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Role name is required." };
  const description = (formData.get("description") as string)?.trim() || null;
  const permissions = formData.getAll("permissions") as string[];
  const perms = permissions.filter((p) => typeof p === "string" && p.length > 0);
  const role = await prisma.role.findFirst({
    where: { id: roleId, tenantId },
  });
  if (!role) return { error: "Role not found." };
  const otherWithName = await prisma.role.findFirst({
    where: { tenantId, name, id: { not: roleId } },
  });
  if (otherWithName) return { error: "Another role already has this name." };
  await prisma.role.update({
    where: { id: roleId },
    data: { name, description, permissions: perms },
  });
  return {};
}
