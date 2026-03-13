"use client";

import { useActionState } from "react";

type OtherModule = { slug: string; name: string };

export function AddFieldForm({
  moduleSlug,
  action,
  otherModuleSlugs,
}: {
  moduleSlug: string;
  action: (prev: unknown, formData: FormData) => Promise<unknown>;
  otherModuleSlugs: OtherModule[];
}) {
  const [state, formAction] = useActionState(action, null);
  const error = state && typeof state === "object" && "error" in state ? (state as { error: string }).error : null;

  return (
    <form action={formAction} className="settings-form" style={{ maxWidth: 480 }}>
      <div className="form-group">
        <label htmlFor="fieldName">Name</label>
        <input id="fieldName" name="name" type="text" required placeholder="e.g. Status" />
      </div>
      <div className="form-group">
        <label htmlFor="fieldSlug">Slug (optional, auto from name)</label>
        <input id="fieldSlug" name="slug" type="text" placeholder="e.g. status" />
      </div>
      <div className="form-group">
        <label htmlFor="fieldType">Type</label>
        <select id="fieldType" name="fieldType" required>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="boolean">Boolean</option>
          <option value="select">Select (options)</option>
          <option value="relation">Relation (single)</option>
          <option value="relation-multi">Relation (multiple)</option>
          <option value="file">File</option>
          <option value="json">JSON</option>
        </select>
      </div>
      <div className="form-group">
        <label className="subscription-check-label">
          <input type="checkbox" name="isRequired" value="1" />
          Required
        </label>
      </div>
      <div className="form-group" id="options-group">
        <label htmlFor="options">Options (for Select, comma-separated)</label>
        <input id="options" name="options" type="text" placeholder="Draft, Active, Done" />
      </div>
      {otherModuleSlugs.length > 0 && (
        <div className="form-group" id="target-module-group">
          <label htmlFor="targetModuleSlug">Target module (for Relation)</label>
          <select id="targetModuleSlug" name="targetModuleSlug">
            <option value="">— None —</option>
            {otherModuleSlugs.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="view-error" role="alert">{error}</p>}
      <div style={{ marginTop: "1rem" }}>
        <button type="submit" className="btn btn-primary">
          Add field
        </button>
      </div>
    </form>
  );
}
