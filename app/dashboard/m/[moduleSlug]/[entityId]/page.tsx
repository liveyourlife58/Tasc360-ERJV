import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EntityForm } from "@/components/dashboard/EntityForm";
import { updateEntity } from "@/app/dashboard/actions";
import { getRelationOptions } from "@/lib/relation-options";
import {
  getModulePaymentType,
  getEntityPaymentOverride,
  getEntityPriceCents,
  getEntitySuggestedDonationCents,
} from "@/lib/module-settings";
import { DeleteEntityButton } from "@/components/dashboard/DeleteEntityButton";
import { formatDate } from "@/lib/format";

export default async function EditEntityPage({
  params,
}: {
  params: Promise<{ moduleSlug: string; entityId: string }>;
}) {
  const { moduleSlug, entityId } = await params;
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) notFound();

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
  const relationOptions = await getRelationOptions(tenantId, module_.fields);
  const modulePaymentType = getModulePaymentType(module_);
  const entityPaymentType = getEntityPaymentOverride(entity);
  const priceCents = getEntityPriceCents(entity);
  const suggestedDonationAmountCents = getEntitySuggestedDonationCents(entity);

  const orderLines = entity.orderLines ?? [];
  const totalTicketsSold = orderLines.reduce((sum, line) => sum + line.quantity, 0);
  const totalCheckedIn = orderLines.reduce((sum, line) => sum + (line.checkedInQuantity ?? 0), 0);
  const hasOrders = orderLines.length > 0;

  return (
    <div>
      <div className="page-header">
        <h1>Edit {module_.name.slice(0, -1)}</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link href={`/dashboard/m/${moduleSlug}`} className="btn btn-secondary">
            Back to list
          </Link>
          <DeleteEntityButton entityId={entityId} moduleSlug={moduleSlug} />
        </div>
      </div>
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
        action={updateEntity.bind(null, { entityId: entity.id })}
      />
    </div>
  );
}
