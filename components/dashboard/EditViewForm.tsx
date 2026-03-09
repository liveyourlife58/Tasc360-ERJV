"use client";

import { useActionState } from "react";

export function EditViewForm({
  viewId,
  moduleSlug,
  initialName,
  initialColumns,
  fieldSlugs,
  action,
}: {
  viewId: string;
  moduleSlug: string;
  initialName: string;
  initialColumns: string[];
  fieldSlugs: string[];
  action: (prev: unknown, formData: FormData) => Promise<unknown>;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
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
        <label htmlFor="columns">Columns (comma-separated field slugs)</label>
        <input
          id="columns"
          name="columns"
          type="text"
          defaultValue={initialColumns.join(", ")}
          placeholder={fieldSlugs.slice(0, 6).join(", ")}
        />
        <span className="form-hint">Available: {fieldSlugs.join(", ")}</span>
      </div>
      {(() => {
        const err = state && typeof state === "object" && "error" in state ? (state as { error: string }).error : null;
        return err ? <p className="view-error" role="alert">{err}</p> : null;
      })()}
      <button type="submit" className="btn btn-primary">
        Save view
      </button>
    </form>
  );
}
