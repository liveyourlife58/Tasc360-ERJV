"use client";

import { useState, type ReactNode } from "react";
import { InverseRelationBacklinks } from "@/components/dashboard/InverseRelationBacklinks";
import { EntityListClickableRow } from "@/components/dashboard/EntityListClickableRow";
import type { InverseBacklinkSection } from "@/lib/inverse-relation-backlinks";

export function EntityListRowWithBacklinks({
  colSpan,
  inverseSections,
  editHref,
  children,
}: {
  colSpan: number;
  inverseSections: InverseBacklinkSection[];
  editHref: string;
  /** Data cells and optional amount cell (`<td>`…`</td>` only). */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasBacklinks = inverseSections.length > 0;

  return (
    <>
      <EntityListClickableRow href={editHref}>
        {children}
        <td style={{ whiteSpace: "nowrap", verticalAlign: "middle" }}>
          {hasBacklinks && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              aria-expanded={open}
              aria-label={open ? "Hide linked records" : "Show linked records"}
              title="Linked records"
              style={{
                padding: "0.2rem 0.4rem",
                fontSize: "0.7rem",
                lineHeight: 1.2,
                minWidth: "1.75rem",
              }}
            >
              {open ? "▼" : "▶"}
            </button>
          )}
        </td>
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
