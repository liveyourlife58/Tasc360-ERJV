"use client";

import { useActionState } from "react";

export function EditViewForm({
  viewId,
  moduleSlug,
  initialName,
  initialColumns,
  fieldSlugs,
  action,
  deleteAction,
}: {
  viewId: string;
  moduleSlug: string;
  initialName: string;
  initialColumns: string[];
  fieldSlugs: string[];
  action: (prev: unknown, formData: FormData) => Promise<unknown>;
  deleteAction: (prev: unknown, formData: FormData) => Promise<unknown>;
}) {
  const [state, formAction] = useActionState(action, null);
  const [, deleteFormAction] = useActionState(deleteAction, null);

  return (
    <div className="edit-view-form-wrap">
      <form action={formAction} className="settings-form" style={{ maxWidth: 480 }}>
        <div className="form-group">
          <label htmlFor="name">View name</label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={initialName}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="columns">Table columns</label>
          <input
            id="columns"
            name="columns"
            type="text"
            defaultValue={initialColumns.join(", ")}
            placeholder={fieldSlugs.slice(0, 6).join(", ")}
          />
          <span className="form-hint">
            Which columns to show in the list table for this view, in order (comma-separated). Available: {fieldSlugs.join(", ")}
          </span>
        </div>
        {(() => {
          const err = state && typeof state === "object" && "error" in state ? (state as { error: string }).error : null;
          return err ? <p className="view-error" role="alert">{err}</p> : null;
        })()}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save view
          </button>
        </div>
      </form>
      <form
        action={deleteFormAction}
        className="edit-view-delete-form"
        onSubmit={(e) => {
          if (!confirm("Delete this view? You can’t undo this.")) {
            e.preventDefault();
          }
        }}
      >
        <button type="submit" className="btn btn-danger">
          Delete view
        </button>
      </form>
    </div>
  );
}
