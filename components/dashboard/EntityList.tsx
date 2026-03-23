import Link from "next/link";
import { RelationMultiCell } from "./RelationMultiCell";
import { TicketSoldCell } from "./TicketSoldCell";
import { EntityListRowWithBacklinks } from "./EntityListRowWithBacklinks";
import type { InverseBacklinkSection } from "@/lib/inverse-relation-backlinks";
import {
  getModulePaymentType,
  getEffectivePaymentType,
  getEntityPriceCents,
  getEntitySuggestedDonationCents,
} from "@/lib/module-settings";
import { formatDateIfApplicable } from "@/lib/format";
import { APP_CONFIG } from "@/lib/app-config";

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
  allowRefund = true,
  relationLabels,
  inverseBacklinksByEntityId,
}: {
  moduleSlug: string;
  /** Module with settings (for payment/donation column). */
  module?: { settings?: unknown } | null;
  fields: Field[];
  entities: Entity[];
  columnSlugs?: string[];
  /** Show Refund button in ticket modal (feature flag). */
  allowRefund?: boolean;
  /** Per field slug, map of related entity id → display label (list/table). */
  relationLabels?: Record<string, Record<string, string>>;
  /** When relation fields opt in, expandable rows show source records linking to each target row. */
  inverseBacklinksByEntityId?: Record<string, InverseBacklinkSection[]>;
}) {
  const maxCols = APP_CONFIG.entityListMaxColumns;
  const columns = columnSlugs?.length
    ? columnSlugs.map((slug) => fields.find((f) => f.slug === slug)).filter(Boolean) as Field[]
    : fields.slice(0, maxCols);
  const showAmountColumn = module != null && getModulePaymentType(module) != null;
  const dataColumnCount = columns.length + (showAmountColumn ? 1 : 0);
  const wideTable = dataColumnCount >= 6;
  const colSpan = columns.length + (showAmountColumn ? 1 : 0) + 1;

  return (
    <div className="entity-table-wrap">
    {wideTable && (
      <p className="entity-list-table-scroll-hint">
        Tip: the first column and <strong>Edit</strong> stay pinned; scroll sideways to see the rest.
      </p>
    )}
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
            <td colSpan={columns.length + (showAmountColumn ? 1 : 0) + 1} className="empty-state empty-state-inline">
              <span className="empty-state-icon" aria-hidden>📋</span>
              <p className="empty-state-message">No records yet. Create one to get started.</p>
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
            const inverseSections = inverseBacklinksByEntityId?.[entity.id];
            const hasInverse = inverseSections && inverseSections.length > 0;
            const editHref = `/dashboard/m/${moduleSlug}/${entity.id}`;

            const dataCells = (
              <>
                {columns.map((f) => (
                  <td key={f.id}>
                    {formatCellValue(
                      (entity.data as Record<string, unknown>)[f.slug],
                      f,
                      entity,
                      relationLabels
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
                        allowRefund={allowRefund}
                      />
                    )}
                  </td>
                )}
              </>
            );

            if (hasInverse) {
              return (
                <EntityListRowWithBacklinks
                  key={entity.id}
                  colSpan={colSpan}
                  inverseSections={inverseSections}
                  editHref={editHref}
                >
                  {dataCells}
                </EntityListRowWithBacklinks>
              );
            }

            return (
              <tr key={entity.id}>
                {dataCells}
                <td>
                  <Link
                    href={editHref}
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
    </div>
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
  _entity: Entity,
  relationLabels?: Record<string, Record<string, string>>
): React.ReactNode {
  if (value == null) return "—";
  if (field.fieldType === "relation" && typeof value === "string" && value.trim() !== "") {
    const map = relationLabels?.[field.slug];
    if (map?.[value]) return map[value];
    return value;
  }
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
            labelById={relationLabels?.[field.slug]}
          />
        );
      }
      return `${value.length} selected`;
    }
    return value.join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const dateStr = formatDateIfApplicable(value, field.fieldType);
  if (dateStr !== null) return dateStr;
  if (field.fieldType === "file" && typeof value === "string" && value.trim() !== "") {
    const url = value.trim();
    if (url.startsWith("http") || url.startsWith("//"))
      return <img src={url} alt="" className="entity-list-cell-image" />;
    return url;
  }
  return String(value);
}
