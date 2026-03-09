import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EntityList } from "@/components/dashboard/EntityList";
import { ViewSelector } from "@/components/dashboard/ViewSelector";
import { CreateViewAiForm } from "@/components/dashboard/CreateViewAiForm";
import { applyViewToEntities, getColumnOrder } from "@/lib/view-utils";

export default async function ModuleEntityListPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { moduleSlug } = await params;
  const { view: viewId } = await searchParams;
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) notFound();

  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) notFound();

  const [views, entities] = await Promise.all([
    prisma.view.findMany({
      where: { tenantId, moduleId: module_.id },
      select: { id: true, name: true },
    }),
    prisma.entity.findMany({
      where: {
        tenantId,
        moduleId: module_.id,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        orderLines: { select: { quantity: true } },
      },
    }),
  ]);

  const selectedView = viewId
    ? views.find((v) => v.id === viewId)
    : null;
  const viewRow = selectedView
    ? await prisma.view.findUnique({
        where: { id: selectedView.id },
        select: { filter: true, sort: true, columns: true },
      })
    : null;
  const viewConfig =
    viewRow &&
    (viewRow.filter || viewRow.sort || viewRow.columns)
      ? {
          filter: viewRow.filter as Record<string, unknown>,
          sort: viewRow.sort as unknown,
          columns: viewRow.columns as unknown,
        }
      : null;

  const filteredEntities = applyViewToEntities(
    entities as { id: string; data: unknown }[],
    viewConfig
  );
  const fieldSlugs = module_.fields.map((f) => f.slug);
  const columnSlugs = getColumnOrder(viewConfig, fieldSlugs, 8);

  return (
    <div>
      <div className="page-header">
        <h1>{module_.name}</h1>
        <Link href={`/dashboard/m/${moduleSlug}/new`} className="btn btn-primary">
          New {module_.name.slice(0, -1)}
        </Link>
      </div>
      <div className="view-selector-row">
        <ViewSelector
          moduleSlug={moduleSlug}
          views={views.map((v) => ({ id: v.id, name: v.name }))}
          currentViewId={viewId ?? null}
          fieldSlugs={fieldSlugs}
          createViewCtx={{
            tenantId,
            moduleId: module_.id,
            moduleSlug,
          }}
        />
        <CreateViewAiForm
          ctx={{
            tenantId,
            moduleId: module_.id,
            moduleSlug,
            moduleName: module_.name,
            fieldSlugs,
          }}
        />
      </div>
      <EntityList
        moduleSlug={moduleSlug}
        module={module_}
        fields={module_.fields}
        entities={filteredEntities as { id: string; data: Record<string, unknown> | unknown; metadata?: unknown; orderLines?: { quantity: number }[] }[]}
        columnSlugs={columnSlugs.length ? columnSlugs : undefined}
      />
    </div>
  );
}
