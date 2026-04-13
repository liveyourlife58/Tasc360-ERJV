import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EntityList } from "@/components/dashboard/EntityList";
import { EntityBoard, type BoardLaneSource } from "@/components/dashboard/EntityBoard";
import { EntityCalendar } from "@/components/dashboard/EntityCalendar";
import { ModuleViewSelectorRow } from "@/components/dashboard/ModuleViewSelectorRow";
import { RestoreEntityButton } from "@/components/dashboard/RestoreEntityButton";
import { SuccessBanner } from "@/components/dashboard/SuccessBanner";
import { updateView, deleteViewFormAction, updateEntitySingleField, setModuleDefaultView } from "@/app/dashboard/actions";
import { APP_CONFIG } from "@/lib/app-config";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { applyViewToEntities, filterEntitiesByKeyword, getColumnOrder } from "@/lib/view-utils";
import { getModuleDeadlineFieldSortSpecs, sortEntitiesWithOverdueDeadlineFirst } from "@/lib/deadline-field";
import { getTenantTimeZone } from "@/lib/tenant-timezone";
import { getTenantLocale } from "@/lib/format";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { isPlatformAdmin } from "@/lib/developer-setup";
import { buildRelationLabelMaps, getRelationOptions } from "@/lib/relation-options";
import { ModuleListSearchBar } from "@/components/dashboard/ModuleListSearchBar";
import { getModuleEntityListCreatedAtOrder } from "@/lib/module-settings";
import { getInverseBacklinksByTargetEntityIds } from "@/lib/inverse-relation-backlinks";
import { fieldSlugsShownInEntityList } from "@/lib/field-entity-list";
import { formatTenantUserOptionLabel } from "@/lib/tenant-user-field";
import { loadActivitySummariesForEntities } from "@/lib/activity-field";

export default async function ModuleEntityListPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleSlug: string }>;
  searchParams: Promise<{ view?: string; deleted?: string; success?: string; page?: string; q?: string }>;
}) {
  const { moduleSlug } = await params;
  const { view: viewId, deleted: showDeleted, success: successKey, page: pageParam, q: qParam } = await searchParams;
  const searchQuery = typeof qParam === "string" ? qParam.trim() : "";
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const PAGE_SIZE = APP_CONFIG.entityPageSize;
  const isDeletedView = showDeleted === "1";
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) notFound();
  const canRead = await hasPermission(userId, PERMISSIONS.entitiesRead);
  if (!canRead) notFound();

  const userEmail = (
    await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  )?.email;
  const userIsPlatformAdmin = isPlatformAdmin(userEmail ?? null);

  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) notFound();

  const entityCreatedAtOrder = getModuleEntityListCreatedAtOrder(module_);

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
      orderBy: { createdAt: entityCreatedAtOrder },
      take: APP_CONFIG.entityFetchLimit,
      include: {
        orderLines: { select: { quantity: true } },
      },
    }),
  ]);

  const defaultViewId = (module_.settings as Record<string, unknown> | null)?.defaultViewId as string | undefined;
  if (!viewId && !isDeletedView && defaultViewId && views.some((v) => v.id === defaultViewId)) {
    const sp = new URLSearchParams();
    sp.set("view", defaultViewId);
    if (searchQuery) sp.set("q", searchQuery);
    redirect(`/dashboard/m/${moduleSlug}?${sp.toString()}`);
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

  const afterView = applyViewToEntities(
    entities as { id: string; data: unknown; createdAt?: Date }[],
    viewConfig
  );
  const deadlineSortSpecs = getModuleDeadlineFieldSortSpecs(module_.fields);
  const tenantTz = getTenantTimeZone(tenant?.settings);
  const filteredEntities = sortEntitiesWithOverdueDeadlineFirst(
    filterEntitiesByKeyword(afterView, searchQuery),
    deadlineSortSpecs,
    tenantTz
  );
  const totalCount = filteredEntities.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const paginatedEntities = filteredEntities.slice(start, start + PAGE_SIZE);

  const viewType =
    viewRow?.viewType === "board" || viewRow?.viewType === "calendar" ? viewRow.viewType : "list";

  const needsTenantUsers = module_.fields.some((f) => f.fieldType === "tenant-user");
  const [relationLabels, relationOptionsMap, inverseBacklinksByEntityId, tenantUsers] = await Promise.all([
    buildRelationLabelMaps(tenantId, module_.fields, paginatedEntities),
    getRelationOptions(tenantId, module_.fields),
    !isDeletedView && viewType === "list"
      ? getInverseBacklinksByTargetEntityIds(
          tenantId,
          moduleSlug,
          paginatedEntities.map((e) => e.id)
        )
      : Promise.resolve({} as Awaited<ReturnType<typeof getInverseBacklinksByTargetEntityIds>>),
    needsTenantUsers
      ? prisma.user.findMany({
          where: { tenantId, isActive: true },
          select: { id: true, name: true, email: true },
          orderBy: { email: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string | null; email: string }[]),
  ]);
  const tenantUserLabels: Record<string, string> = Object.fromEntries(
    tenantUsers.map((u) => [u.id, formatTenantUserOptionLabel(u)])
  );
  const tenantUserOptionsForMeta = tenantUsers.map((u) => ({
    id: u.id,
    label: formatTenantUserOptionLabel(u),
  }));

  const fieldSlugs = module_.fields.map((f) => f.slug);
  const listColumnFieldSlugs = fieldSlugsShownInEntityList(module_.fields);
  const columnSlugs = getColumnOrder(viewConfig, listColumnFieldSlugs, APP_CONFIG.entityListMaxColumns);
  const activityFieldsInListColumns = module_.fields.filter(
    (f) => f.fieldType === "activity" && columnSlugs.includes(f.slug)
  );
  let activityCellSummaries: Record<string, Record<string, string>> = {};
  if (
    !isDeletedView &&
    viewType === "list" &&
    activityFieldsInListColumns.length > 0 &&
    paginatedEntities.length > 0
  ) {
    const activityMap = await loadActivitySummariesForEntities(
      tenantId,
      paginatedEntities.map((e) => e.id),
      activityFieldsInListColumns.map((f) => ({ slug: f.slug, settings: f.settings }))
    );
    activityCellSummaries = Object.fromEntries(activityMap);
  }
  const selectFieldSlugs = module_.fields.filter((f) => f.fieldType === "select").map((f) => f.slug);
  const tenantUserFieldSlugs = module_.fields.filter((f) => f.fieldType === "tenant-user").map((f) => f.slug);
  const tenantUserFieldsMeta = tenantUserFieldSlugs.map((slug) => {
    const f = module_.fields.find((x) => x.slug === slug)!;
    return { slug, name: f.name, options: tenantUserOptionsForMeta };
  });
  const relationFieldSlugs = module_.fields.filter((f) => f.fieldType === "relation").map((f) => f.slug);
  const relationFieldsMeta = relationFieldSlugs.map((slug) => {
    const f = module_.fields.find((x) => x.slug === slug)!;
    return {
      slug,
      name: f.name,
      options: (relationOptionsMap[slug] ?? []).map((o) => ({ id: o.id, label: o.label })),
    };
  });
  const selectFieldsMeta = module_.fields
    .filter((f) => f.fieldType === "select")
    .map((f) => {
      const st = (f.settings as Record<string, unknown>) ?? {};
      const opts = Array.isArray(st.options)
        ? (st.options as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
      return { slug: f.slug, name: f.name, options: opts };
    });
  const dateFieldSlugs = module_.fields.filter((f) => f.fieldType === "date").map((f) => f.slug);
  const viewSettings = (viewRow?.settings as {
    boardColumnField?: string;
    dateField?: string;
    boardLaneSource?: string;
    boardLaneValues?: unknown;
  }) ?? {};
  let boardColumnField =
    viewType === "board"
      ? (viewSettings.boardColumnField ??
          selectFieldSlugs[0] ??
          tenantUserFieldSlugs[0] ??
          relationFieldSlugs[0] ??
          null)
      : null;
  if (viewType === "board" && boardColumnField) {
    const bf = module_.fields.find((f) => f.slug === boardColumnField);
    const ok = bf && (bf.fieldType === "select" || bf.fieldType === "relation" || bf.fieldType === "tenant-user");
    if (!ok)
      boardColumnField = selectFieldSlugs[0] ?? tenantUserFieldSlugs[0] ?? relationFieldSlugs[0] ?? null;
  }
  const boardFieldDef =
    viewType === "board" && boardColumnField
      ? module_.fields.find((f) => f.slug === boardColumnField)
      : null;
  const boardOrderedDefinedValues: string[] =
    boardFieldDef?.fieldType === "relation"
      ? (relationOptionsMap[boardColumnField!] ?? []).map((o) => o.id)
      : boardFieldDef?.fieldType === "tenant-user"
        ? (tenantUserFieldsMeta.find((m) => m.slug === boardColumnField)?.options.map((o) => o.id) ?? [])
        : boardFieldDef?.fieldType === "select"
          ? (() => {
              const st = (boardFieldDef.settings as Record<string, unknown>) ?? {};
              return Array.isArray(st.options)
                ? (st.options as unknown[]).filter((x): x is string => typeof x === "string")
                : [];
            })()
          : [];
  let boardColumnLabels: Record<string, string> | undefined;
  if (boardFieldDef?.fieldType === "relation" && boardColumnField) {
    boardColumnLabels = {};
    for (const o of relationOptionsMap[boardColumnField] ?? []) {
      boardColumnLabels[o.id] = o.label;
    }
    const extra = relationLabels[boardColumnField];
    if (extra) {
      for (const [id, label] of Object.entries(extra)) {
        if (!boardColumnLabels[id]) boardColumnLabels[id] = label;
      }
    }
  } else if (boardFieldDef?.fieldType === "tenant-user" && boardColumnField) {
    boardColumnLabels = { ...tenantUserLabels };
  }
  const boardLaneSource: BoardLaneSource =
    viewSettings.boardLaneSource === "all_options" || viewSettings.boardLaneSource === "custom"
      ? viewSettings.boardLaneSource
      : "data";
  const boardLaneValues =
    boardLaneSource === "custom" && Array.isArray(viewSettings.boardLaneValues)
      ? (viewSettings.boardLaneValues as unknown[]).filter((x): x is string => typeof x === "string")
      : undefined;
  const dateField = viewType === "calendar" ? (viewSettings.dateField ?? dateFieldSlugs[0] ?? null) : null;

  function buildPageUrl(nextPage: number) {
    const params = new URLSearchParams();
    if (viewId) params.set("view", viewId);
    if (showDeleted === "1") params.set("deleted", "1");
    if (searchQuery) params.set("q", searchQuery);
    if (nextPage > 1) params.set("page", String(nextPage));
    const q = params.toString();
    return q ? `/dashboard/m/${moduleSlug}?${q}` : `/dashboard/m/${moduleSlug}`;
  }
  const exportParams = new URLSearchParams();
  if (viewId) exportParams.set("view", viewId);
  if (showDeleted === "1") exportParams.set("deleted", "1");
  if (searchQuery) exportParams.set("q", searchQuery);
  const exportCsvUrl =
    `/dashboard/m/${moduleSlug}/export` + (exportParams.toString() ? `?${exportParams.toString()}` : "");

  const entityListProps = {
    moduleSlug,
    module: module_,
    fields: module_.fields.map((f) => ({ ...f, settings: (f.settings ?? {}) as Record<string, unknown> })),
    entities: paginatedEntities as { id: string; data: Record<string, unknown> | unknown; metadata?: unknown; orderLines?: { quantity: number }[] }[],
    columnSlugs: columnSlugs.length ? columnSlugs : undefined,
    allowRefund: isFeatureEnabled(tenant?.settings ?? null, "refunds"),
    relationLabels,
    inverseBacklinksByEntityId:
      !isDeletedView && viewType === "list" ? inverseBacklinksByEntityId : undefined,
    tenantLocale: getTenantLocale(tenant?.settings ?? null),
    tenantTimeZone: tenantTz,
    ...(needsTenantUsers ? { tenantUserLabels } : {}),
    ...(activityFieldsInListColumns.length > 0 ? { activityCellSummaries } : {}),
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
          settings: v.settings as {
            boardColumnField?: string;
            dateField?: string;
            boardLaneSource?: string;
            boardLaneValues?: unknown;
          } | null,
          filter: (Array.isArray(v.filter) ? v.filter : []) as unknown[],
          sort: (Array.isArray(v.sort) ? v.sort : []) as unknown[],
        }))}
        currentViewId={viewId ?? null}
        defaultViewId={defaultViewId ?? null}
        setDefaultViewAction={setModuleDefaultView}
        fieldSlugs={listColumnFieldSlugs}
        selectFieldSlugs={selectFieldSlugs}
        selectFieldsMeta={selectFieldsMeta}
        relationFieldSlugs={relationFieldSlugs}
        relationFieldsMeta={relationFieldsMeta}
        tenantUserFieldSlugs={tenantUserFieldSlugs}
        tenantUserFieldsMeta={tenantUserFieldsMeta}
        dateFieldSlugs={dateFieldSlugs}
        updateViewAction={updateView}
        deleteViewAction={deleteViewFormAction}
        createViewCtx={{
          tenantId,
          moduleId: module_.id,
          moduleSlug,
          moduleName: module_.name,
          fieldSlugs: listColumnFieldSlugs,
        }}
      />
        <ModuleListSearchBar
          moduleSlug={moduleSlug}
          initialQuery={searchQuery}
          viewId={viewId ?? null}
          showDeleted={isDeletedView}
        />
      </div>
      {viewType === "board" && boardColumnField && !isDeletedView ? (
        <EntityBoard
          moduleSlug={moduleSlug}
          entities={entityListProps.entities}
          fields={entityListProps.fields}
          boardColumnField={boardColumnField}
          boardLaneSource={boardLaneSource}
          boardLaneValues={boardLaneValues}
          boardOrderedDefinedValues={boardOrderedDefinedValues}
          boardColumnLabels={boardColumnLabels}
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
                      <RestoreEntityButton
                        entityId={entity.id}
                        moduleSlug={moduleSlug}
                        platformAdmin={userIsPlatformAdmin}
                      />
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
            {searchQuery ? " matching search" : ""}
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
