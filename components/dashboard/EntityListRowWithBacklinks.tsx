"use client";

import { useState, type ReactNode } from "react";
import { InverseRelationBacklinks } from "@/components/dashboard/InverseRelationBacklinks";
import { EntityListClickableRow } from "@/components/dashboard/EntityListClickableRow";
import type { InverseBacklinkSection } from "@/lib/inverse-relation-backlinks";

/** Row for expandable backlinks: chevron is inlined at the start of the first cell (not a trailing column). */
export function EntityListRowWithBacklinks({
  colSpan,
  inverseSections,
  editHref,
  firstCellInner,
  restCells,
}: {
  /** Data columns including amount column (no extra chevron column). */
  colSpan: number;
  inverseSections: InverseBacklinkSection[];
  editHref: string;
  /** Inner content for the first data cell (wrapped here in `<td>` alongside the chevron). */
  firstCellInner: ReactNode;
  /** Remaining `<td>` cells as a fragment. */
  restCells: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasBacklinks = inverseSections.length > 0;

  return (
    <>
      <EntityListClickableRow href={editHref}>
        <td>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
            {hasBacklinks ? (
              <button
                type="button"
                className="entity-list-backlink-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((v) => !v);
                }}
                aria-expanded={open}
                aria-label={open ? "Hide linked records" : "Show linked records"}
                title="Linked records"
              >
                {open ? "▼" : "▶"}
              </button>
            ) : null}
            <span className="entity-list-backlink-first-cell-content" style={{ minWidth: 0 }}>
              {firstCellInner}
            </span>
          </span>
        </td>
        {restCells}
      </EntityListClickableRow>
      {hasBacklinks && open && (
        <tr className="entity-list-inverse-backlinks-row">
          <td
            colSpan={colSpan}
            style={{
              paddingTop: 0,
              paddingBottom: "0.65rem",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <div style={{ paddingLeft: "0.25rem", maxWidth: "min(52rem, 100%)" }}>
              <InverseRelationBacklinks sections={inverseSections} variant="list" />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
