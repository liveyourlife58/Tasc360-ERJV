import { prisma } from "./prisma";

export const PERMISSIONS = {
  entitiesRead: "entities:read",
  entitiesWrite: "entities:write",
  modulesManage: "modules:manage",
  viewsManage: "views:manage",
  settingsManage: "settings:manage",
  settingsDeveloper: "settings:developer",
  usersManage: "users:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Human-readable labels for the role editor and docs. Add new permissions here and in PERMISSIONS. */
export const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSIONS.entitiesRead]: "Read entities",
  [PERMISSIONS.entitiesWrite]: "Create & edit entities",
  [PERMISSIONS.modulesManage]: "Manage modules & fields",
  [PERMISSIONS.viewsManage]: "Manage views",
  [PERMISSIONS.settingsManage]: "Manage settings & billing",
  [PERMISSIONS.settingsDeveloper]: "Manage API keys, webhooks & integrations",
  [PERMISSIONS.usersManage]: "Manage users & roles",
  "*": "Full access (admin)",
};

/** Load user's permission list from role. If no role, returns ["*"] (full access for backward compatibility). */
export async function getPermissionsForUser(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleId: true },
  });
  if (!user?.roleId) return ["*"];
  const role = await prisma.role.findUnique({
    where: { id: user.roleId, isActive: true },
    select: { permissions: true },
  });
  if (!role?.permissions || !Array.isArray(role.permissions)) return ["*"];
  return role.permissions as string[];
}

/** Check if user has the given permission. Use in server actions before mutating. */
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const perms = await getPermissionsForUser(userId);
  return perms.includes(permission) || perms.includes("*");
}

/** Throw if user lacks permission. Call at start of server action. */
export async function requirePermission(userId: string, permission: string): Promise<void> {
  const ok = await hasPermission(userId, permission);
  if (!ok) throw new Error("Forbidden: insufficient permissions");
}
