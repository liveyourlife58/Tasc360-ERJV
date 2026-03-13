import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  addFieldToModule,
  removeFieldFromModule,
  reorderFieldInModule,
  updateFieldInModule,
} from "@/app/dashboard/actions";
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
    select: { slug: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <div className="page-header">
        <h1>Manage fields: {module_.name}</h1>
        <Link href={`/dashboard/m/${moduleSlug}`} className="btn btn-secondary">
          Back to {module_.name}
        </Link>
      </div>
      <p className="settings-intro" style={{ marginBottom: "1.5rem" }}>
        Add, reorder, or remove fields. You cannot remove a field if any record has a value for it.
      </p>

      <section style={{ marginBottom: "2rem" }}>
        <h2 className="subscription-subheading">Add field</h2>
        <AddFieldForm
          moduleSlug={moduleSlug}
          action={addFieldToModule.bind(null, moduleSlug)}
          otherModuleSlugs={otherModules.map((m) => ({ slug: m.slug, name: m.name }))}
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
                otherModuleSlugs={otherModules.map((m) => ({ slug: m.slug, name: m.name }))}
              />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
