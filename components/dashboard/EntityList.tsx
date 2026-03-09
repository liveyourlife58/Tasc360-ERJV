import Link from "next/link";
import { RelationMultiCell } from "./RelationMultiCell";
import { TicketSoldCell } from "./TicketSoldCell";
import {
  getModulePaymentType,
  getEffectivePaymentType,
  getEntityPriceCents,
  getEntitySuggestedDonationCents,
} from "@/lib/module-settings";

type Field = {
  id: string;
  name: string;
  slug: string;
  fieldType: string;
  settings?: Record<string, unknown>;
};

type Entity = {
  id: string;
  data: Record<string, unknown> | unknown;
  metadata?: unknown;
  orderLines?: { quantity: number }[];
};

export function EntityList({
  moduleSlug,
  module,
  fields,
  entities,
  columnSlugs,
}: {
  moduleSlug: string;
  /** Module with settings (for payment/donation column). */
  module?: { settings?: unknown } | null;
  fields: Field[];
  entities: Entity[];
  columnSlugs?: string[];
}) {
  const columns = columnSlugs?.length
    ? columnSlugs.map((slug) => fields.find((f) => f.slug === slug)).filter(Boolean) as Field[]
    : fields.slice(0, 6);
  const showAmountColumn = module != null && getModulePaymentType(module) != null;

  return (
    <table className="entity-table">
      <thead>
        <tr>
          {columns.map((f) => (
            <th key={f.id}>{f.name}</th>
          ))}
          {showAmountColumn && <th>Price / Donation</th>}
          <th style={{ width: 100 }}></th>
        </tr>
      </thead>
      <tbody>
        {entities.length === 0 ? (
          <tr>
            <td colSpan={columns.length + (showAmountColumn ? 1 : 0) + 1} style={{ color: "#6b7280", padding: "2rem" }}>
              No records yet. Create one to get started.
            </td>
          </tr>
        ) : (
          entities.map((entity) => {
            const effectiveType = getEffectivePaymentType(entity, module ?? null);
            const priceCents = getEntityPriceCents(entity);
            const suggestedCents = getEntitySuggestedDonationCents(entity);
            const amountNode =
              effectiveType === "payment" && priceCents != null && priceCents > 0
                ? formatAmount(priceCents)
                : effectiveType === "donation" && suggestedCents != null && suggestedCents > 0
                  ? <>Suggested: {formatAmount(suggestedCents)}</>
                  : "—";
            const ticketsSold = (entity.orderLines ?? []).reduce((sum, l) => sum + l.quantity, 0);
            const entityTitle = String(
              (entity.data as Record<string, unknown>)?.[columns[0]?.slug ?? "name"] ?? "Item"
            );

            return (
              <tr key={entity.id}>
                {columns.map((f) => (
                  <td key={f.id}>
                    {formatCellValue(
                      (entity.data as Record<string, unknown>)[f.slug],
                      f,
                      entity
                    )}
                  </td>
                ))}
                {showAmountColumn && (
                  <td>
                    {amountNode}
                    {ticketsSold > 0 && (
                      <TicketSoldCell
                        entityId={entity.id}
                        entityTitle={entityTitle}
                        ticketsSold={ticketsSold}
                      />
                    )}
                  </td>
                )}
                <td>
                  <Link
                    href={`/dashboard/m/${moduleSlug}/${entity.id}`}
                    className="btn btn-secondary"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatCellValue(
  value: unknown,
  field: Field,
  _entity: Entity
): React.ReactNode {
  if (value == null) return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (field.fieldType === "relation-multi") {
      const targetSlug =
        (field.settings?.targetModuleSlug ?? field.settings?.targetModule) as
          | string
          | undefined;
      if (targetSlug) {
        return (
          <RelationMultiCell
            entityIds={value as string[]}
            targetModuleSlug={targetSlug}
            fieldName={field.name}
          />
        );
      }
      return `${value.length} selected`;
    }
    return value.join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object" && "toISOString" in (value as object)) {
    return new Date((value as Date).toString()).toLocaleDateString();
  }
  return String(value);
}
