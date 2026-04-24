import { TicketSoldCell } from "./TicketSoldCell";
import { EntityListRowWithBacklinks } from "./EntityListRowWithBacklinks";
import { EntityListHeaderRow } from "./EntityListHeaderRow";
import type { InverseBacklinkSection } from "@/lib/inverse-relation-backlinks";
import {
  getModulePaymentType,
  getEffectivePaymentType,
  getEntityPriceCents,
  getEntitySuggestedDonationCents,
} from "@/lib/module-settings";
import { formatEntityFieldValue } from "@/lib/entity-field-display";
import { APP_CONFIG } from "@/lib/app-config";
import { fieldHighlightClassNameForColumn } from "@/lib/field-highlight";
import { EntityListClickableRow } from "./EntityListClickableRow";

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
  tenantUserLabels,
  inverseBacklinksByEntityId,
  activityCellSummaries,
  tenantLocale,
  tenantTimeZone,
  /** When true, column headers include Asc/Desc sort controls (module list view). */
  sortableHeaders = false,
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
  /** Workspace user id → display label for `tenant-user` columns. */
  tenantUserLabels?: Record<string, string>;
  /** When relation fields opt in, expandable rows show source records linking to each target row. */
  inverseBacklinksByEntityId?: Record<string, InverseBacklinkSection[]>;
  /** For `activity` list columns: entity id → field slug → multi-line summary (first line shown in cell). */
  activityCellSummaries?: Record<string, Record<string, string>>;
  /** Tenant `settings.locale` for date/number display. */
  tenantLocale?: string;
  /** Tenant `settings.timeZone` (IANA) for date display and deadline highlights. */
  tenantTimeZone?: string;
  sortableHeaders?: boolean;
}) {
  const maxCols = APP_CONFIG.entityListMaxColumns;
  const columns = columnSlugs?.length
    ? columnSlugs.map((slug) => fields.find((f) => f.slug === slug)).filter(Boolean) as Field[]
    : fields.slice(0, maxCols);
  const showAmountColumn = module != null && getModulePaymentType(module) != null;
  const dataColumnCount = columns.length + (showAmountColumn ? 1 : 0);
  const wideTable = dataColumnCount >= 6;
  const colSpan = columns.length + (showAmountColumn ? 1 : 0);

  return (
    <div className="entity-table-wrap">
    {wideTable && (
      <p className="entity-list-table-scroll-hint">
        Tip: the first and last columns stay pinned; scroll sideways to see the rest. Click a row to open the record.
      </p>
    )}
    <table className={`entity-table${sortableHeaders ? " entity-table--list-sort" : ""}`}>
      <thead>
        {sortableHeaders ? (
          <EntityListHeaderRow
            columns={columns.map((f) => ({ id: f.id, slug: f.slug, name: f.name }))}
            showAmountColumn={showAmountColumn}
            amountColumnLabel="Price / Donation"
          />
        ) : (
          <tr>
            {columns.map((f) => (
              <th key={f.id}>{f.name}</th>
            ))}
            {showAmountColumn && <th>Price / Donation</th>}
          </tr>
        )}
      </thead>
      <tbody>
        {entities.length === 0 ? (
          <tr>
            <td colSpan={columns.length + (showAmountColumn ? 1 : 0)} className="empty-state empty-state-inline">
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

            const renderedColumnCells = columns.map((f) => {
              const raw = (entity.data as Record<string, unknown>)[f.slug];
              const hl = fieldHighlightClassNameForColumn(f.slug, f.fieldType, raw, f.settings, {
                data: entity.data as Record<string, unknown>,
                fields,
                tenantTimeZone,
              });
              const inner = formatEntityFieldValue(
                raw,
                f,
                entity,
                relationLabels,
                tenantUserLabels,
                tenantLocale,
                tenantTimeZone,
                activityCellSummaries
              );
              const wrapped = hl ? (
                <span className={`entity-table-cell-highlight ${hl.className}`} style={hl.style}>
                  {inner}
                </span>
              ) : (
                inner
              );
              return { key: f.id, wrapped };
            });

            const amountCell = showAmountColumn ? (
              <td key="__amount__">
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
            ) : null;

            if (hasInverse) {
              const firstCellInner = renderedColumnCells[0]?.wrapped ?? null;
              const restCells = (
                <>
                  {renderedColumnCells.slice(1).map((c) => (
                    <td key={c.key}>{c.wrapped}</td>
                  ))}
                  {amountCell}
                </>
              );
              return (
                <EntityListRowWithBacklinks
                  key={entity.id}
                  colSpan={colSpan}
                  inverseSections={inverseSections}
                  editHref={editHref}
                  firstCellInner={firstCellInner}
                  restCells={restCells}
                />
              );
            }

            return (
              <EntityListClickableRow key={entity.id} href={editHref}>
                {renderedColumnCells.map((c) => (
                  <td key={c.key}>{c.wrapped}</td>
                ))}
                {amountCell}
              </EntityListClickableRow>
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
