import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRoles } from "@/lib/roles";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { AddUserForm } from "../subscription/AddUserForm";
import { TeamTableWithEditModal } from "../subscription/TeamTableWithEditModal";
import { RolesSection } from "./RolesSection";

export default async function TeamPage() {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) redirect("/login");

  await ensureDefaultRoles(tenantId);

  const canManageUsers = await hasPermission(userId, PERMISSIONS.usersManage);

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        roleId: true,
        role: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.role.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, description: true, permissions: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rolesWithCount = await Promise.all(
    roles.map(async (r) => {
      const count = await prisma.user.count({ where: { tenantId, roleId: r.id } });
      return { ...r, userCount: count };
    })
  );

  return (
    <div>
      <div className="page-header">
        <h1>Team</h1>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>

      <section className="subscription-section">
        <h2 className="subscription-heading">Users ({users.length})</h2>
        <TeamTableWithEditModal
          users={users}
          roles={roles}
          tenantId={tenantId}
          currentUserId={userId}
          canManageUsers={canManageUsers}
        />

        {canManageUsers && (
          <>
            <h3 className="subscription-subheading">Add user</h3>
            <AddUserForm tenantId={tenantId} roles={roles} />
          </>
        )}

        {!canManageUsers && (
          <p className="settings-hint">Only users with the right role can add or edit team members. Ask an admin to change your role.</p>
        )}
      </section>

      {canManageUsers && (
        <section className="subscription-section">
          <RolesSection tenantId={tenantId} roles={rolesWithCount} />
        </section>
      )}
    </div>
  );
}
