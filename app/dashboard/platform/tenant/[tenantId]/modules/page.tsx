import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/developer-setup";
import {
  createModuleAsPlatformAdminFormAction,
  disableModuleAsPlatformAdminFormAction,
  enableModuleAsPlatformAdminFormAction,
  deleteModuleAsPlatformAdminFormAction,
} from "@/app/dashboard/actions";
import { CreateModuleForm } from "./CreateModuleForm";
import { PlatformModuleRow } from "./PlatformModuleRow";

export default async function PlatformTenantModulesPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!isPlatformAdmin(user?.email ?? null)) redirect("/dashboard");

  const { tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) notFound();

  const modules = await prisma.module.findMany({
    where: { tenantId },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
    select: { id: true, name: true, slug: true, isActive: true },
  });

  const entityCounts = await Promise.all(
    modules.map(async (m) => {
      const count = await prisma.entity.count({ where: { moduleId: m.id } });
      return { moduleId: m.id, count };
    })
  );
  const countByModuleId = new Map(entityCounts.map((c) => [c.moduleId, c.count]));

  const modulesWithCounts = modules.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    isActive: m.isActive ?? true,
    entityCount: countByModuleId.get(m.id) ?? 0,
  }));

  return (
    <div>
      <div className="page-header">
        <h1>Modules: {tenant.name ?? tenant.slug}</h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href={`/dashboard/platform/tenant/${tenantId}`} className="btn btn-secondary">
            Back to tenant settings
          </Link>
          <Link href="/dashboard/platform" className="btn btn-secondary">
            Platform admin
          </Link>
        </div>
      </div>
      <p className="page-description" style={{ marginBottom: "1.5rem" }}>
        Create, enable, disable, or delete modules. Click a module name to manage its fields.
      </p>

      <CreateModuleForm tenantId={tenantId} action={createModuleAsPlatformAdminFormAction} />

      <section>
        <h2 className="subscription-subheading">Modules ({modulesWithCounts.length})</h2>
        {modulesWithCounts.length === 0 ? (
          <p className="settings-intro">No modules yet. Create one above.</p>
        ) : (
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="subscription-team-table" style={{ width: "100%", minWidth: 480 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Records</th>
                  <th aria-hidden>Actions</th>
                </tr>
              </thead>
              <tbody>
                {modulesWithCounts.map((m) => (
                  <PlatformModuleRow
                    key={m.id}
                    tenantId={tenantId}
                    module={m}
                    disableFormAction={disableModuleAsPlatformAdminFormAction}
                    enableFormAction={enableModuleAsPlatformAdminFormAction}
                    deleteFormAction={deleteModuleAsPlatformAdminFormAction}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
