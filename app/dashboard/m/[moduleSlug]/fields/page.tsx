import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sqlEntityDataKeyHasMeaningfulValue } from "@/lib/entity-data-field-measure";
import {
  addFieldToModule,
  removeFieldFromModule,
  reorderFieldInModule,
  updateFieldInModule,
  updateModuleListOrderFormAction,
} from "@/app/dashboard/actions";
import { getModuleEntityListCreatedAtOrder } from "@/lib/module-settings";
import { AddFieldForm } from "@/components/dashboard/AddFieldForm";
import { FieldListRow } from "@/components/dashboard/FieldListRow";

export default async function ModuleFieldsPage({
  params,
}: {
  params: Promise<{ moduleSlug: string }>;
}) {
  const { moduleSlug } = await params;
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) notFound();

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
        Prisma.sql`SELECT COUNT(*)::bigint as count FROM entities WHERE module_id = (${module_.id})::uuid AND deleted_at IS NULL AND ${sqlEntityDataKeyHasMeaningfulValue(f.slug)}`
      );
      recordCountByFieldId.set(f.id, Number(rows[0]?.count ?? 0));
    })
  );

  return (
    <div>
      <div className="page-header">
        <h1>Manage fields: {module_.name}</h1>
        <Link href={`/dashboard/m/${moduleSlug}`} className="btn btn-secondary">
          Back to {module_.name}
        </Link>
      </div>
      <p className="settings-intro" style={{ marginBottom: "1.5rem" }}>
        Add, reorder, or remove fields. You cannot remove a field while any record still has a non-empty value for it (cleared selects and blank values no longer block removal). To change a field type or remove it when data blocks you, update records individually or ask a platform administrator for help.
      </p>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="subscription-subheading">Record list order</h2>
        <p className="settings-intro" style={{ marginBottom: "0.75rem" }}>
          Default order when loading records in this module (by creation time). If a saved view defines its own sort, that sort is applied after load.
        </p>
        <form action={updateModuleListOrderFormAction} className="settings-form" style={{ maxWidth: 420 }}>
          <input type="hidden" name="moduleSlug" value={moduleSlug} />
          <div className="form-group">
            <label htmlFor="listOrder">Created date</label>
            <select id="listOrder" name="listOrder" defaultValue={getModuleEntityListCreatedAtOrder(module_)}>
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
          action={addFieldToModule.bind(null, moduleSlug)}
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
                removeAction={removeFieldFromModule}
                reorderAction={reorderFieldInModule}
                updateAction={updateFieldInModule}
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
