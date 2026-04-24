import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EntityForm } from "@/components/dashboard/EntityForm";
import { updateEntity, duplicateEntityFormAction, getRelatedEntities, getEntityEvents } from "@/app/dashboard/actions";
import {
  fetchRelationDisplayLabelsForAuditEvents,
  getRelationOptions,
  mergeRelationOptionsWithAuditLabels,
} from "@/lib/relation-options";
import {
  getModulePaymentType,
  getEntityPaymentOverride,
  getEntityPriceCents,
  getEntitySuggestedDonationCents,
} from "@/lib/module-settings";
import { DeleteEntityButton } from "@/components/dashboard/DeleteEntityButton";
import { RequestApprovalForm } from "@/components/dashboard/RequestApprovalForm";
import { formatDate, getTenantLocale } from "@/lib/format";
import { getActivityDisplayTimeZone } from "@/lib/tenant-timezone";
import { requestApproval } from "@/app/dashboard/actions";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { isPlatformAdmin } from "@/lib/developer-setup";
import { PlatformHardDeleteEntityButton } from "@/components/dashboard/PlatformHardDeleteEntityButton";
import { RestoreEntityButton } from "@/components/dashboard/RestoreEntityButton";
import { InverseRelationBacklinks } from "@/components/dashboard/InverseRelationBacklinks";
import { getInverseRelationBacklinkSections } from "@/lib/inverse-relation-backlinks";
import { formatEntityEventActorLabel } from "@/lib/entity-event-actor";
import type { ActivityAuditFormatContext } from "@/lib/activity-field";
import { summarizeActivityEventForListCell } from "@/lib/activity-field";
import { ActivityEventSummaryDisplay } from "@/lib/entity-field-display";
import { EntityActivityRailList } from "@/components/dashboard/EntityActivityRailList";
import { isDashboardFeatureEnabled } from "@/lib/dashboard-features";
import { formatTenantUserOptionLabel } from "@/lib/tenant-user-field";
import { parseEntityFormLayout } from "@/lib/entity-form-layout";

export default async function EditEntityPage({
  params,
}: {
  params: Promise<{ moduleSlug: string; entityId: string }>;
}) {
  const { moduleSlug, entityId } = await params;
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

  const entity = await prisma.entity.findFirst({
    where: {
      id: entityId,
      tenantId,
      moduleId: module_.id,
      ...(!userIsPlatformAdmin ? { deletedAt: null } : {}),
    },
    include: {
      orderLines: {
        include: { order: { select: { purchaserName: true, purchaserEmail: true, createdAt: true } } },
        orderBy: { order: { createdAt: "desc" } },
      },
    },
  });

  if (!entity) notFound();

  const data = (entity.data as Record<string, unknown>) ?? {};
  const metadata = (entity.metadata as Record<string, unknown>) ?? {};
  const modulePaymentType = getModulePaymentType(module_);
  const entityPaymentType = getEntityPaymentOverride(entity);
  const priceCents = getEntityPriceCents(entity);
  const suggestedDonationAmountCents = getEntitySuggestedDonationCents(entity);
  const capacity = typeof metadata.capacity === "number" ? metadata.capacity : null;

  const orderLines = entity.orderLines ?? [];
  const totalTicketsSold = orderLines.reduce((sum, line) => sum + line.quantity, 0);
  const totalCheckedIn = orderLines.reduce((sum, line) => sum + (line.checkedInQuantity ?? 0), 0);
  const hasOrders = orderLines.length > 0;

  const activityEventFetchLimit = module_.fields.some((f) => f.fieldType === "activity") ? 50 : 20;

  const [{ related }, { events: activityEvents }, relationOptions, tenantRow, tenantUsers] = await Promise.all([
    getRelatedEntities(entity.id, { sourceModuleFields: module_.fields }),
    getEntityEvents(entity.id, activityEventFetchLimit),
    getRelationOptions(tenantId, module_.fields),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    }),
    module_.fields.some((f) => f.fieldType === "tenant-user")
      ? prisma.user.findMany({
          where: { tenantId, isActive: true },
          select: { id: true, name: true, email: true },
          orderBy: { email: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string | null; email: string }[]),
  ]);
  const tenantUserOptions = tenantUsers.map((u) => ({
    id: u.id,
    label: formatTenantUserOptionLabel(u),
  }));
  const tenantUserLabelsForAudit = Object.fromEntries(
    tenantUsers.map((u) => [u.id, formatTenantUserOptionLabel(u)])
  );
  const relatedList = related ?? [];
  const activityList = activityEvents ?? [];
  const auditRelationLabels = await fetchRelationDisplayLabelsForAuditEvents(
    tenantId,
    module_.fields,
    activityList.map((e) => e.data)
  );
  const relationOptionsForActivity = mergeRelationOptionsWithAuditLabels(
    relationOptions,
    auditRelationLabels,
    module_.fields
  );
  const approvalsEnabled = isDashboardFeatureEnabled(tenantRow?.settings ?? null, "approvals");
  const pendingApprovals = approvalsEnabled
    ? await prisma.approval.findMany({
        where: { entityId, tenantId, status: "pending" },
        select: { approvalType: true },
      })
    : [];
  const pendingApprovalTypes = pendingApprovals.map((a) => a.approvalType);
  const isSoftDeleted = entity.deletedAt != null;

  const tenantLocaleForPage = getTenantLocale(tenantRow?.settings ?? null);
  const activityDisplayTz = getActivityDisplayTimeZone(tenantRow?.settings ?? null, h);

  const inverseBacklinkSections =
    !isSoftDeleted
      ? await getInverseRelationBacklinkSections(tenantId, moduleSlug, entityId, {
          locale: tenantLocaleForPage,
          timeZone: activityDisplayTz,
        })
      : [];

  const fieldTypeBySlug = Object.fromEntries(module_.fields.map((f) => [f.slug, f.fieldType]));

  const activityActorLabel = (ev: (typeof activityList)[number]) =>
    formatEntityEventActorLabel(ev.data as Record<string, unknown> | null, ev.createdByUser);

  const entityActivityRows = activityList.map((ev) => ({
    id: ev.id,
    eventType: ev.eventType,
    createdAt: ev.createdAt.toISOString(),
    actorLabel: activityActorLabel(ev),
  }));

  const hasActivityHistory = activityList.length > 0;
  const hasActivityField = module_.fields.some((f) => f.fieldType === "activity");

  const entityFormEl = (
    <EntityForm
      moduleSlug={moduleSlug}
      moduleName={module_.name}
      fields={module_.fields}
      initialData={data}
      entityId={entity.id}
      relationOptions={relationOptions}
      tenantUserOptions={tenantUserOptions}
      entityActivityRows={entityActivityRows}
      modulePaymentType={modulePaymentType ?? undefined}
      entityPaymentType={entityPaymentType ?? undefined}
      priceCents={priceCents ?? undefined}
      suggestedDonationAmountCents={suggestedDonationAmountCents ?? undefined}
      capacity={capacity ?? undefined}
      entityFormLayout={parseEntityFormLayout(module_.settings)}
      action={updateEntity.bind(null, { entityId: entity.id })}
      autoSave
      wideLayout
      activityFieldPresentation={hasActivityField ? "sidebar" : "inline"}
    />
  );

  const activityAuditCtx: ActivityAuditFormatContext = {
    fieldTypeBySlug,
    relationOptionsBySlug: relationOptionsForActivity,
    tenantUserLabels: tenantUserLabelsForAudit,
  };

  const activityEventListItems = activityList.map((ev) => (
    <li key={ev.id}>
      <ActivityEventSummaryDisplay
        text={summarizeActivityEventForListCell(ev, activityAuditCtx, {
          locale: tenantLocaleForPage,
          timeZone: activityDisplayTz,
        })}
      />
    </li>
  ));

  const activityAsideEl = (
    <aside
      className="entity-edit-activity-column dashboard-activity-rail"
      aria-labelledby="entity-activity-heading"
    >
      <h2 id="entity-activity-heading" className="entity-edit-activity-heading">
        <span className="entity-edit-activity-rail-brand">Activity</span>
        <span className="activity-details-count entity-edit-activity-rail-meta">
          {" "}
          · {activityList.length} event{activityList.length !== 1 ? "s" : ""}
        </span>
      </h2>
      <span className="entity-edit-activity-rail-section-label">This record</span>
      {hasActivityHistory ? (
        <EntityActivityRailList items={activityEventListItems} />
      ) : (
        <p className="entity-edit-activity-empty">No activity yet.</p>
      )}
    </aside>
  );

  return (
    <div>
      <div className="page-header">
        <h1>Edit {module_.name.slice(0, -1)}</h1>
        <div className="page-header-actions">
          <Link href={`/dashboard/m/${moduleSlug}`} className="btn btn-secondary">
            Back to list
          </Link>
          {!isSoftDeleted && (
            <form action={duplicateEntityFormAction} className="inline-form">
              <input type="hidden" name="entityId" value={entityId} />
              <input type="hidden" name="moduleSlug" value={moduleSlug} />
              <button type="submit" className="btn btn-secondary">
                Clone
              </button>
            </form>
          )}
          {!isSoftDeleted && <DeleteEntityButton entityId={entityId} moduleSlug={moduleSlug} />}
          {userIsPlatformAdmin && (
            <>
              {isSoftDeleted && (
                <RestoreEntityButton
                  entityId={entityId}
                  moduleSlug={moduleSlug}
                  platformAdmin
                />
              )}
              <PlatformHardDeleteEntityButton entityId={entityId} moduleSlug={moduleSlug} />
            </>
          )}
        </div>
      </div>
      {isSoftDeleted && (
        <p
          className="banner-warning"
          style={{
            marginBottom: "1rem",
            padding: "0.75rem 1rem",
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "8px",
            color: "#92400e",
          }}
        >
          This record is <strong>soft-deleted</strong>. Platform tools: restore to the live list, or permanently delete to remove the row (subject to order/payment/ledger checks).
        </p>
      )}
      {approvalsEnabled && !isSoftDeleted && (
        <section className="related-records" style={{ marginBottom: "1.5rem" }}>
          <h3>Approvals</h3>
          <RequestApprovalForm
            entityId={entityId}
            moduleSlug={moduleSlug}
            requestAction={requestApproval}
            existingPendingTypes={pendingApprovalTypes}
          />
        </section>
      )}
      {hasOrders && (
        <section style={{ marginBottom: "1.5rem", padding: "1rem", background: "#f8fafc", borderRadius: "8px" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Tickets / orders</h2>
          <p style={{ marginBottom: "0.75rem", fontSize: "0.875rem" }}>
            <strong>{totalTicketsSold}</strong> ticket{totalTicketsSold !== 1 ? "s" : ""} sold, <strong>{totalCheckedIn}</strong> checked in — from {orderLines.length} order{orderLines.length !== 1 ? "s" : ""}.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.875rem" }}>
            {orderLines.map((line) => (
              <li key={line.id} style={{ padding: "0.35rem 0", borderBottom: "1px solid #e2e8f0" }}>
                <strong>{line.order.purchaserName}</strong> ({line.order.purchaserEmail}) — {line.quantity} × ${(line.amountCents / 100).toFixed(2)} ({line.lineType})
                <span style={{ color: "#64748b", marginLeft: "0.5rem" }}>
                  {formatDate(line.order.createdAt)}
                </span>
                <span style={{ marginLeft: "0.5rem" }}>
                  — {line.checkedInQuantity ?? 0}/{line.quantity} checked in
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!isSoftDeleted ? (
        <div className="entity-edit-layout">
          <div className="entity-edit-main-column">{entityFormEl}</div>
          {activityAsideEl}
        </div>
      ) : (
        <section className="settings-hint" style={{ marginTop: "0.5rem" }}>
          <p style={{ marginBottom: "0.5rem" }}>Editing is disabled while the record is deleted. Restore it to edit fields.</p>
          <pre
            style={{
              fontSize: "0.8125rem",
              padding: "1rem",
              background: "#f8fafc",
              borderRadius: "8px",
              overflow: "auto",
              maxHeight: "20rem",
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        </section>
      )}
      {isSoftDeleted && hasActivityHistory && (
        <section className="related-records" style={{ marginBottom: "1.5rem" }}>
          <h3>Activity</h3>
          <ul className="activity-list">{activityEventListItems}</ul>
        </section>
      )}
      {(() => {
        const inverseBacklinkKeys = new Set<string>();
        for (const sec of inverseBacklinkSections) {
          for (const ent of sec.entities) {
            inverseBacklinkKeys.add(`${sec.sourceModuleSlug}|${sec.fieldSlug}|${ent.id}`);
          }
        }
        const compactRelated = relatedList.filter((r) => {
          if (r.direction !== "in") return true;
          return !inverseBacklinkKeys.has(`${r.moduleSlug}|${r.relationType}|${r.id}`);
        });
        const hasBacklinks = !isSoftDeleted && inverseBacklinkSections.length > 0;
        const hasCompact = compactRelated.length > 0;
        if (!hasBacklinks && !hasCompact) return null;
        return (
          <section className="related-records" style={{ marginBottom: "1.5rem" }}>
            <h3>Related records</h3>
            {hasCompact && (
              <ul
                className="related-records-list"
                style={{ marginBottom: hasBacklinks ? "1rem" : undefined }}
              >
                {compactRelated.map((r) => (
                  <li key={`${r.direction}-${r.relationType}-${r.id}`}>
                    <Link href={`/dashboard/m/${r.moduleSlug}/${r.id}`}>
                      {r.moduleName}: {r.displayTitle}
                    </Link>
                    <span style={{ marginLeft: "0.5rem", fontSize: "0.8125rem", color: "#64748b" }}>
                      ({r.relationFieldLabel} {r.direction === "out" ? "→" : "←"})
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {hasBacklinks && (
              <InverseRelationBacklinks sections={inverseBacklinkSections} variant="page-inline" />
            )}
          </section>
        );
      })()}
    </div>
  );
}
