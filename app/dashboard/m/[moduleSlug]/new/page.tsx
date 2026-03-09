import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EntityForm } from "@/components/dashboard/EntityForm";
import { createEntity } from "@/app/dashboard/actions";
import { getRelationOptions } from "@/lib/relation-options";
import { getModulePaymentType } from "@/lib/module-settings";

export default async function NewEntityPage({
  params,
}: {
  params: Promise<{ moduleSlug: string }>;
}) {
  const { moduleSlug } = await params;
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId || !userId) notFound();

  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) notFound();

  const relationOptions = await getRelationOptions(tenantId, module_.fields);
  const modulePaymentType = getModulePaymentType(module_);

  return (
    <div>
      <div className="page-header">
        <h1>New {module_.name.slice(0, -1)}</h1>
        <Link href={`/dashboard/m/${moduleSlug}`} className="btn btn-secondary">
          Back to list
        </Link>
      </div>
      <EntityForm
        moduleSlug={moduleSlug}
        moduleName={module_.name}
        fields={module_.fields}
        initialData={{}}
        relationOptions={relationOptions}
        modulePaymentType={modulePaymentType ?? undefined}
        action={createEntity.bind(null, { tenantId, moduleId: module_.id, createdBy: userId })}
      />
    </div>
  );
}
