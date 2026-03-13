import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EntityList } from "@/components/dashboard/EntityList";
import { EntityBoard } from "@/components/dashboard/EntityBoard";
import { EntityCalendar } from "@/components/dashboard/EntityCalendar";
import { ModuleViewSelectorRow } from "@/components/dashboard/ModuleViewSelectorRow";
import { RestoreEntityButton } from "@/components/dashboard/RestoreEntityButton";
import { SuccessBanner } from "@/components/dashboard/SuccessBanner";
import { updateView, deleteViewFormAction, updateEntitySingleField, setModuleDefaultView } from "@/app/dashboard/actions";
import { APP_CONFIG } from "@/lib/app-config";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { applyViewToEntities, getColumnOrder } from "@/lib/view-utils";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export default async function ModuleEntityListPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleSlug: string }>;
  searchParams: Promise<{ view?: string; deleted?: string; success?: string; page?: string }>;
}) {
  const { moduleSlug } = await params;
  const { view: viewId, deleted: showDeleted, success: successKey, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const PAGE_SIZE = APP_CONFIG.entityPageSize;
  const isDeletedView = showDeleted === "1";
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) notFound();
  const canRead = await hasPermission(userId, PERMISSIONS.entitiesRead);
  if (!canRead) notFound();

  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) notFound();

  const [tenant, views, entities] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    }),
    prisma.view.findMany({
      where: { tenantId, moduleId: module_.id },
      select: { id: true, name: true, columns: true, viewType: true, settings: true, filter: true, sort: true },
    }),
    prisma.entity.findMany({
      where: {
        tenantId,
        moduleId: module_.id,
        ...(isDeletedView ? { deletedAt: { not: null } } : { deletedAt: null }),
      },
      orderBy: { createdAt: "desc" },
      take: APP_CONFIG.entityFetchLimit,
      include: {
        orderLines: { select: { quantity: true } },
      },
    }),
  ]);

  const defaultViewId = (module_.settings as Record<string, unknown> | null)?.defaultViewId as string | undefined;
  if (!viewId && !isDeletedView && defaultViewId && views.some((v) => v.id === defaultViewId)) {
    redirect(`/dashboard/m/${moduleSlug}?view=${defaultViewId}`);
  }

  const selectedView = viewId
    ? views.find((v) => v.id === viewId)
    : null;
  const viewRow = selectedView
    ? await prisma.view.findUnique({
        where: { id: selectedView.id },
        select: { filter: true, sort: true, columns: true, viewType: true, settings: true },
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
  const totalCount = filteredEntities.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const paginatedEntities = filteredEntities.slice(start, start + PAGE_SIZE);

  const fieldSlugs = module_.fields.map((f) => f.slug);
  const columnSlugs = getColumnOrder(viewConfig, fieldSlugs, 8);
  const selectFieldSlugs = module_.fields.filter((f) => f.fieldType === "select").map((f) => f.slug);
  const dateFieldSlugs = module_.fields.filter((f) => f.fieldType === "date").map((f) => f.slug);
  const viewType = viewRow?.viewType === "board" || viewRow?.viewType === "calendar" ? viewRow.viewType : "list";
  const viewSettings = (viewRow?.settings as { boardColumnField?: string; dateField?: string }) ?? {};
  const boardColumnField = viewType === "board" ? (viewSettings.boardColumnField ?? selectFieldSlugs[0] ?? null) : null;
  const dateField = viewType === "calendar" ? (viewSettings.dateField ?? dateFieldSlugs[0] ?? null) : null;

  function buildPageUrl(nextPage: number) {
    const params = new URLSearchParams();
    if (viewId) params.set("view", viewId);
    if (showDeleted === "1") params.set("deleted", "1");
    if (nextPage > 1) params.set("page", String(nextPage));
    const q = params.toString();
    return q ? `/dashboard/m/${moduleSlug}?${q}` : `/dashboard/m/${moduleSlug}`;
  }
  const exportCsvUrl =
    `/dashboard/m/${moduleSlug}/export` +
    (viewId || showDeleted === "1"
      ? "?" + new URLSearchParams({ ...(viewId && { view: viewId }), ...(showDeleted === "1" && { deleted: "1" }) }).toString()
      : "");

  const entityListProps = {
    moduleSlug,
    module: module_,
    fields: module_.fields.map((f) => ({ ...f, settings: (f.settings ?? {}) as Record<string, unknown> })),
    entities: paginatedEntities as { id: string; data: Record<string, unknown> | unknown; metadata?: unknown; orderLines?: { quantity: number }[] }[],
    columnSlugs: columnSlugs.length ? columnSlugs : undefined,
    allowRefund: isFeatureEnabled(tenant?.settings ?? null, "refunds"),
  };

  return (
    <div>
      <Suspense fallback={null}>
        <SuccessBanner successKey={successKey} />
      </Suspense>
      <div className="module-page-sticky-header">
        <div className="page-header">
          <h1>{module_.name}</h1>
          <div className="page-header-actions">
            {isDeletedView ? (
              <Link href={`/dashboard/m/${moduleSlug}`} className="btn btn-secondary">
                Back to list
              </Link>
            ) : (
              <Link href={`/dashboard/m/${moduleSlug}?deleted=1`} className="btn btn-secondary">
                Show deleted
              </Link>
            )}
            <Link href={`/dashboard/m/${moduleSlug}/fields`} className="btn btn-secondary">
              Manage fields
            </Link>
            <a href={exportCsvUrl} className="btn btn-secondary" download>
              Export CSV
            </a>
            <Link href={`/dashboard/m/${moduleSlug}/new`} className="btn btn-primary">
              New {module_.name.slice(0, -1)}
            </Link>
          </div>
        </div>
        {isDeletedView && (
          <p className="module-page-deleted-hint">
            Soft-deleted records. Restore to bring them back to the list.
          </p>
        )}
        <ModuleViewSelectorRow
        moduleSlug={moduleSlug}
        views={views.map((v) => ({
          id: v.id,
          name: v.name,
          columns: Array.isArray(v.columns) ? (v.columns as string[]) : [],
          viewType: v.viewType ?? "list",
          settings: v.settings as { boardColumnField?: string; dateField?: string } | null,
          filter: (Array.isArray(v.filter) ? v.filter : []) as unknown[],
          sort: (Array.isArray(v.sort) ? v.sort : []) as unknown[],
        }))}
        currentViewId={viewId ?? null}
        defaultViewId={defaultViewId ?? null}
        setDefaultViewAction={setModuleDefaultView}
        fieldSlugs={fieldSlugs}
        selectFieldSlugs={selectFieldSlugs}
        dateFieldSlugs={dateFieldSlugs}
        updateViewAction={updateView}
        deleteViewAction={deleteViewFormAction}
        createViewCtx={{
          tenantId,
          moduleId: module_.id,
          moduleSlug,
          moduleName: module_.name,
          fieldSlugs,
        }}
      />
      </div>
      {viewType === "board" && boardColumnField && !isDeletedView ? (
        <EntityBoard
          moduleSlug={moduleSlug}
          entities={entityListProps.entities}
          fields={entityListProps.fields}
          boardColumnField={boardColumnField}
          updateColumnAction={updateEntitySingleField}
        />
      ) : viewType === "calendar" && dateField && !isDeletedView ? (
        <EntityCalendar
          moduleSlug={moduleSlug}
          entities={entityListProps.entities}
          fields={entityListProps.fields}
          dateField={dateField}
        />
      ) : isDeletedView ? (
        <table className="entity-table">
          <thead>
            <tr>
              <th>Record</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {entityListProps.entities.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ color: "#6b7280", padding: "2rem" }}>
                  No deleted records.
                </td>
              </tr>
            ) : (
              entityListProps.entities.map((entity) => {
                const title = String((entity.data as Record<string, unknown>)?.[entityListProps.fields[0]?.slug ?? "name"] ?? entity.id.slice(0, 8));
                return (
                  <tr key={entity.id}>
                    <td>
                      <Link href={`/dashboard/m/${moduleSlug}/${entity.id}`}>{title}</Link>
                    </td>
                    <td>
                      <RestoreEntityButton entityId={entity.id} moduleSlug={moduleSlug} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      ) : (
        <EntityList {...entityListProps} />
      )}
      {!isDeletedView && totalCount > PAGE_SIZE && (
        <nav className="pagination-bar" aria-label="Pagination">
          <p className="pagination-info">
            Showing {start + 1}–{Math.min(start + PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="pagination-links">
            {currentPage > 1 ? (
              <Link href={buildPageUrl(currentPage - 1)} className="btn btn-secondary pagination-btn">
                ← Previous
              </Link>
            ) : (
              <span className="pagination-btn-disabled">← Previous</span>
            )}
            <span className="pagination-page">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages ? (
              <Link href={buildPageUrl(currentPage + 1)} className="btn btn-secondary pagination-btn">
                Next →
              </Link>
            ) : (
              <span className="pagination-btn-disabled">Next →</span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
