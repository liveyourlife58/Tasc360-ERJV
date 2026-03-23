"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { InverseRelationBacklinks } from "@/components/dashboard/InverseRelationBacklinks";
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
      <tr>
        {children}
        <td style={{ whiteSpace: "nowrap", verticalAlign: "middle" }}>
          <Link
            href={editHref}
            className="btn btn-secondary"
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
          >
            Edit
          </Link>
          {hasBacklinks && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Hide linked records" : "Show linked records"}
              title="Linked records"
              style={{
                padding: "0.2rem 0.4rem",
                fontSize: "0.7rem",
                lineHeight: 1.2,
                marginLeft: "0.35rem",
                minWidth: "1.75rem",
              }}
            >
              {open ? "▼" : "▶"}
            </button>
          )}
        </td>
      </tr>
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
