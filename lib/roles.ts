import { prisma } from "./prisma";
import { PERMISSIONS } from "./permissions";

export const DEFAULT_ROLE_NAMES = {
  admin: "admin",
  standard: "standard",
} as const;

/** Permissions for the standard role (no settings, modules, or users management). */
const STANDARD_PERMISSIONS: string[] = [
  PERMISSIONS.entitiesRead,
  PERMISSIONS.entitiesWrite,
  PERMISSIONS.viewsManage,
];

/**
 * Ensure the tenant has default roles (admin and standard). Creates them if missing.
 * Call when loading subscription/team page or before adding first user.
 */
export async function ensureDefaultRoles(tenantId: string): Promise<{
  adminRoleId: string;
  standardRoleId: string;
}> {
  const existing = await prisma.role.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });
  const byName = Object.fromEntries(existing.map((r) => [r.name, r.id]));

  let adminRoleId = byName[DEFAULT_ROLE_NAMES.admin];
  let standardRoleId = byName[DEFAULT_ROLE_NAMES.standard];

  if (!adminRoleId) {
    const admin = await prisma.role.create({
      data: {
        tenantId,
        name: DEFAULT_ROLE_NAMES.admin,
        description: "Full access including settings and user management",
        permissions: ["*"],
        isActive: true,
      },
    });
    adminRoleId = admin.id;
  }
  if (!standardRoleId) {
    const standard = await prisma.role.create({
      data: {
        tenantId,
        name: DEFAULT_ROLE_NAMES.standard,
        description: "Can use modules and views; cannot manage settings or users",
        permissions: STANDARD_PERMISSIONS,
        isActive: true,
      },
    });
    standardRoleId = standard.id;
  }

  return { adminRoleId, standardRoleId };
}
