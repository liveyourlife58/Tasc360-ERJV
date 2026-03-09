"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createView } from "@/app/dashboard/actions";

type ViewItem = { id: string; name: string };

export function ViewSelector({
  moduleSlug,
  views,
  currentViewId,
  fieldSlugs,
  createViewCtx,
}: {
  moduleSlug: string;
  views: ViewItem[];
  currentViewId: string | null;
  fieldSlugs: string[];
  createViewCtx: { tenantId: string; moduleId: string; moduleSlug: string };
}) {
  const [showNew, setShowNew] = useState(false);
  const [state, formAction] = useActionState(
    createView.bind(null, createViewCtx),
    null
  );

  const baseUrl = `/dashboard/m/${moduleSlug}`;

  return (
    <div className="view-selector">
      <div className="view-tabs">
        <Link
          href={baseUrl}
          className={`view-tab ${currentViewId === null ? "active" : ""}`}
        >
          All
        </Link>
        {views.map((v) => (
          <span key={v.id} className="view-tab-wrap">
            <Link
              href={`${baseUrl}?view=${v.id}`}
              className={`view-tab ${currentViewId === v.id ? "active" : ""}`}
            >
              {v.name}
            </Link>
            <Link
              href={`/dashboard/m/${moduleSlug}/v/${v.id}`}
              className="view-tab-edit"
              title="Edit view"
            >
              Edit
            </Link>
          </span>
        ))}
        {!showNew ? (
          <button
            type="button"
            className="view-tab view-tab-new"
            onClick={() => setShowNew(true)}
          >
            + New view
          </button>
        ) : (
          <form
            action={formAction}
            className="view-new-form"
            onSubmit={() => setShowNew(false)}
          >
            <input
              type="hidden"
              name="columns"
              value={JSON.stringify(fieldSlugs.slice(0, 6))}
            />
            <input
              name="name"
              placeholder="View name"
              required
              autoFocus
              className="view-new-input"
            />
            <button type="submit" className="btn btn-primary view-new-btn">
              Save
            </button>
            <button
              type="button"
              className="btn btn-secondary view-new-btn"
              onClick={() => setShowNew(false)}
            >
              Cancel
            </button>
          </form>
        )}
      </div>
      {state?.error && (
        <p className="view-error" role="alert">
          {state.error}
        </p>
      )}
    </div>
  );
}
