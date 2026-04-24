"use client";

import { useEffect, useState, type ReactNode } from "react";

const PREVIEW_COUNT = 8;

/**
 * Renders the Activity rail list (first `PREVIEW_COUNT` items) with a
 * "Show all" button that opens a modal containing the full list.
 * Accepts each event already pre-rendered as a `<li>` so rendering logic
 * stays with the server component that builds the audit summary.
 */
export function EntityActivityRailList({ items }: { items: ReactNode[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const total = items.length;
  const preview = items.slice(0, PREVIEW_COUNT);
  const hasOverflow = total > PREVIEW_COUNT;

  return (
    <>
      <ul className="activity-list entity-edit-activity-list">{preview}</ul>
      {hasOverflow && (
        <button
          type="button"
          className="entity-edit-activity-show-more"
          onClick={() => setOpen(true)}
        >
          Show all {total} events
        </button>
      )}
      {open && (
        <div
          className="confirm-modal-overlay"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="entity-activity-modal-title"
        >
          <div
            className="entity-activity-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="entity-activity-modal-header">
              <h2 id="entity-activity-modal-title" className="entity-activity-modal-title">
                Activity
                <span className="entity-activity-modal-count"> · {total} event{total !== 1 ? "s" : ""}</span>
              </h2>
              <button
                type="button"
                aria-label="Close"
                className="entity-activity-modal-close"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            <ul className="activity-list entity-edit-activity-modal-list">{items}</ul>
          </div>
        </div>
      )}
    </>
  );
}
