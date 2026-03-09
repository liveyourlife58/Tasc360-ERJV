import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updateView } from "@/app/dashboard/actions";
import { EditViewForm } from "@/components/dashboard/EditViewForm";

export default async function EditViewPage({
  params,
}: {
  params: Promise<{ moduleSlug: string; viewId: string }>;
}) {
  const { moduleSlug, viewId } = await params;
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) notFound();

  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) notFound();

  const viewForModule = await prisma.view.findFirst({
    where: { id: viewId, tenantId, moduleId: module_.id },
  });
  if (!viewForModule) notFound();

  const columns = Array.isArray(viewForModule.columns) ? (viewForModule.columns as string[]) : [];

  return (
    <div>
      <div className="page-header">
        <h1>Edit view: {viewForModule.name}</h1>
        <Link href={`/dashboard/m/${moduleSlug}`} className="btn btn-secondary">
          Back to list
        </Link>
      </div>
      <EditViewForm
        viewId={viewId}
        moduleSlug={moduleSlug}
        initialName={viewForModule.name}
        initialColumns={columns}
        fieldSlugs={module_.fields.map((f) => f.slug)}
        action={updateView.bind(null, viewId, moduleSlug)}
      />
    </div>
  );
}
