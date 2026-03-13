import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EntityForm } from "@/components/dashboard/EntityForm";
import { updateEntity, duplicateEntityFormAction, getRelatedEntities, getEntityEvents } from "@/app/dashboard/actions";
import { getRelationOptions } from "@/lib/relation-options";
import {
  getModulePaymentType,
  getEntityPaymentOverride,
  getEntityPriceCents,
  getEntitySuggestedDonationCents,
} from "@/lib/module-settings";
import { DeleteEntityButton } from "@/components/dashboard/DeleteEntityButton";
import { RequestApprovalForm } from "@/components/dashboard/RequestApprovalForm";
import { formatDate } from "@/lib/format";
import { requestApproval } from "@/app/dashboard/actions";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

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

  const [module_, entity] = await Promise.all([
    prisma.module.findFirst({
      where: { tenantId, slug: moduleSlug, isActive: true },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.entity.findFirst({
      where: { id: entityId, tenantId, deletedAt: null },
      include: {
        orderLines: {
          include: { order: { select: { purchaserName: true, purchaserEmail: true, createdAt: true } } },
          orderBy: { order: { createdAt: "desc" } },
        },
      },
    }),
  ]);

  if (!module_ || !entity) notFound();
  if (entity.moduleId !== module_.id) notFound();

  const data = (entity.data as Record<string, unknown>) ?? {};
  const metadata = (entity.metadata as Record<string, unknown>) ?? {};
  const relationOptions = await getRelationOptions(tenantId, module_.fields);
  const modulePaymentType = getModulePaymentType(module_);
  const entityPaymentType = getEntityPaymentOverride(entity);
  const priceCents = getEntityPriceCents(entity);
  const suggestedDonationAmountCents = getEntitySuggestedDonationCents(entity);
  const capacity = typeof metadata.capacity === "number" ? metadata.capacity : null;

  const orderLines = entity.orderLines ?? [];
  const totalTicketsSold = orderLines.reduce((sum, line) => sum + line.quantity, 0);
  const totalCheckedIn = orderLines.reduce((sum, line) => sum + (line.checkedInQuantity ?? 0), 0);
  const hasOrders = orderLines.length > 0;

  const { related } = await getRelatedEntities(entity.id);
  const relatedList = related ?? [];
  const { events: activityEvents } = await getEntityEvents(entity.id);
  const activityList = activityEvents ?? [];
  const pendingApprovals = await prisma.approval.findMany({
    where: { entityId, tenantId, status: "pending" },
    select: { approvalType: true },
  });
  const pendingApprovalTypes = pendingApprovals.map((a) => a.approvalType);

  return (
    <div>
      <div className="page-header">
        <h1>Edit {module_.name.slice(0, -1)}</h1>
        <div className="page-header-actions">
          <Link href={`/dashboard/m/${moduleSlug}`} className="btn btn-secondary">
            Back to list
          </Link>
          <form action={duplicateEntityFormAction} className="inline-form">
            <input type="hidden" name="entityId" value={entityId} />
            <input type="hidden" name="moduleSlug" value={moduleSlug} />
            <button type="submit" className="btn btn-secondary">
              Clone
            </button>
          </form>
          <DeleteEntityButton entityId={entityId} moduleSlug={moduleSlug} />
        </div>
      </div>
      <section className="related-records" style={{ marginBottom: "1.5rem" }}>
        <h3>Approvals</h3>
        <RequestApprovalForm
          entityId={entityId}
          moduleSlug={moduleSlug}
          requestAction={requestApproval}
          existingPendingTypes={pendingApprovalTypes}
        />
      </section>
      {activityList.length > 0 && (
        <section className="related-records" style={{ marginBottom: "1.5rem" }}>
          <h3>Activity</h3>
          <ul className="activity-list">
            {activityList.map((ev) => (
              <li key={ev.id}>
                <strong>{ev.eventType.replace(/_/g, " ")}</strong>
                <span style={{ marginLeft: "0.5rem", color: "#94a3b8" }}>
                  {formatDate(ev.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {relatedList.length > 0 && (
        <section className="related-records" style={{ marginBottom: "1.5rem" }}>
          <h3>Related records</h3>
          <ul className="related-records-list">
            {relatedList.map((r) => {
              const title = String(r.data?.name ?? r.data?.title ?? r.id.slice(0, 8));
              return (
                <li key={`${r.direction}-${r.relationType}-${r.id}`}>
                  <Link href={`/dashboard/m/${r.moduleSlug}/${r.id}`}>
                    {r.moduleName}: {title}
                  </Link>
                  <span style={{ marginLeft: "0.5rem", fontSize: "0.8125rem", color: "#64748b" }}>
                    ({r.relationType} {r.direction === "out" ? "→" : "←"})
                  </span>
                </li>
              );
            })}
          </ul>
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
      <EntityForm
        moduleSlug={moduleSlug}
        moduleName={module_.name}
        fields={module_.fields}
        initialData={data}
        entityId={entity.id}
        relationOptions={relationOptions}
        modulePaymentType={modulePaymentType ?? undefined}
        entityPaymentType={entityPaymentType ?? undefined}
        priceCents={priceCents ?? undefined}
        suggestedDonationAmountCents={suggestedDonationAmountCents ?? undefined}
        capacity={capacity ?? undefined}
        action={updateEntity.bind(null, { entityId: entity.id })}
      />
    </div>
  );
}
