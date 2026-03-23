import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/developer-setup";
import {
  addFieldToModuleAsPlatformAdminFormAction,
  updateFieldInModuleAsPlatformAdminFormAction,
  removeFieldFromModuleAsPlatformAdminFormAction,
  reorderFieldInModuleAsPlatformAdminFormAction,
  updateModuleListOrderAsPlatformAdminFormAction,
} from "@/app/dashboard/actions";
import { getModuleEntityListCreatedAtOrder } from "@/lib/module-settings";
import { AddFieldForm } from "@/components/dashboard/AddFieldForm";
import { FieldListRow } from "@/components/dashboard/FieldListRow";
import { PlatformModuleIdentityForm } from "../../PlatformModuleIdentityForm";

export default async function PlatformTenantModuleFieldsPage({
  params,
}: {
  params: Promise<{ tenantId: string; moduleSlug: string }>;
}) {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!isPlatformAdmin(user?.email ?? null)) redirect("/dashboard");

  const { tenantId, moduleSlug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });
  if (!tenant) notFound();

  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) notFound();

  const otherModules = await prisma.module.findMany({
    where: { tenantId, isActive: true, id: { not: module_.id } },
    select: {
      slug: true,
      name: true,
      fields: { orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const recordCountByFieldId = new Map<string, number>();
  await Promise.all(
    module_.fields.map(async (f) => {
      const rows = await prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`SELECT COUNT(*)::bigint as count FROM entities WHERE module_id = (${module_.id})::uuid AND deleted_at IS NULL AND (data ? ${f.slug})`
      );
      recordCountByFieldId.set(f.id, Number(rows[0]?.count ?? 0));
    })
  );

  const extraFormFields = { targetTenantId: tenantId, moduleSlug };

  return (
    <div>
      <div className="page-header">
        <h1>Manage fields: {module_.name}</h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href={`/dashboard/platform/tenant/${tenantId}/modules`} className="btn btn-secondary">
            Back to modules
          </Link>
          <Link href={`/dashboard/platform/tenant/${tenantId}`} className="btn btn-secondary">
            Tenant settings
          </Link>
        </div>
      </div>
      <p className="settings-intro" style={{ marginBottom: "1.5rem" }}>
        Tenant: <strong>{tenant.name ?? tenant.slug}</strong>. Add, reorder, or remove fields. You cannot remove a field if any record has a value for it.
      </p>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="subscription-subheading">Module name &amp; slug</h2>
        <p className="settings-intro" style={{ marginBottom: "1rem" }}>
          Platform only. Renaming is safe; changing the slug updates URLs for this module but can break relation fields
          and bookmarks until those are fixed.
        </p>
        <PlatformModuleIdentityForm
          tenantId={tenantId}
          moduleSlug={moduleSlug}
          initialName={module_.name}
          initialSlug={module_.slug}
        />
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="subscription-subheading">Record list order</h2>
        <p className="settings-intro" style={{ marginBottom: "0.75rem" }}>
          Same setting as <strong>Manage fields</strong> in the tenant dashboard: default order when loading records (by creation time). Saved views with their own sort still apply that sort after load.
        </p>
        <form action={updateModuleListOrderAsPlatformAdminFormAction} className="settings-form" style={{ maxWidth: 420 }}>
          <input type="hidden" name="targetTenantId" value={tenantId} />
          <input type="hidden" name="moduleSlug" value={moduleSlug} />
          <div className="form-group">
            <label htmlFor="platformListOrder">Created date</label>
            <select id="platformListOrder" name="listOrder" defaultValue={getModuleEntityListCreatedAtOrder(module_)}>
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary">
            Save list order
          </button>
        </form>
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="subscription-subheading">Add field</h2>
        <AddFieldForm
          action={addFieldToModuleAsPlatformAdminFormAction}
          extraFormFields={extraFormFields}
          otherModules={otherModules.map((m) => ({
            slug: m.slug,
            name: m.name,
            fields: m.fields.map((f) => ({ slug: f.slug, name: f.name })),
          }))}
        />
      </section>

      <section>
        <h2 className="subscription-subheading">Fields ({module_.fields.length})</h2>
        {module_.fields.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: "0.9375rem" }}>No fields yet. Add one above.</p>
        ) : (
          <table className="entity-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>Name</th>
                <th>Slug</th>
                <th>Type</th>
                <th>Required</th>
                <th>Settings</th>
                <th style={{ width: 120 }}></th>
              </tr>
            </thead>
            <tbody>
              {module_.fields.map((field, index) => (
                <FieldListRow
                  key={field.id}
                  moduleSlug={moduleSlug}
                  field={field}
                  isFirst={index === 0}
                  isLast={index === module_.fields.length - 1}
                  removeFormAction={removeFieldFromModuleAsPlatformAdminFormAction}
                  reorderFormAction={reorderFieldInModuleAsPlatformAdminFormAction}
                  updateFormAction={updateFieldInModuleAsPlatformAdminFormAction}
                  extraFormFields={extraFormFields}
                  fieldRecordCount={recordCountByFieldId.get(field.id) ?? 0}
                  otherModules={otherModules.map((m) => ({
                    slug: m.slug,
                    name: m.name,
                    fields: m.fields.map((f) => ({ slug: f.slug, name: f.name })),
                  }))}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
