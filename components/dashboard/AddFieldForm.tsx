"use client";

import { useActionState, useMemo, useState } from "react";

export type OtherModuleForFields = {
  slug: string;
  name: string;
  fields: { slug: string; name: string }[];
};

export function AddFieldForm({
  action,
  extraFormFields,
  otherModules,
}: {
  action: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  otherModules: OtherModuleForFields[];
}) {
  const [state, formAction] = useActionState(action, null);
  const [fieldType, setFieldType] = useState("");
  const [targetSlug, setTargetSlug] = useState("");
  const error = state && typeof state === "object" && "error" in state ? (state as { error: string }).error : null;

  const selectedModule = useMemo(
    () => otherModules.find((m) => m.slug === targetSlug),
    [otherModules, targetSlug]
  );
  const showRelationSettings =
    otherModules.length > 0 && (fieldType === "relation" || fieldType === "relation-multi");

  return (
    <form action={formAction} className="settings-form" style={{ maxWidth: 480 }}>
      {extraFormFields && Object.entries(extraFormFields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
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
        <select
          id="fieldType"
          name="fieldType"
          required
          onChange={(e) => {
            setFieldType(e.target.value);
            if (e.target.value !== "relation" && e.target.value !== "relation-multi") {
              setTargetSlug("");
            }
          }}
        >
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
      {showRelationSettings && (
        <>
          <div className="form-group" id="target-module-group">
            <label htmlFor="targetModuleSlug">Target module</label>
            <select
              id="targetModuleSlug"
              name="targetModuleSlug"
              value={targetSlug}
              onChange={(e) => setTargetSlug(e.target.value)}
            >
              <option value="">— None —</option>
              {otherModules.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          {targetSlug && selectedModule && selectedModule.fields.length > 0 && (
            <div className="form-group">
              <label htmlFor="displayFieldSlug">Show in lists / pickers (field from related record)</label>
              <select id="displayFieldSlug" name="displayFieldSlug" defaultValue="">
                <option value="">Default (name, or first field)</option>
                {selectedModule.fields.map((f) => (
                  <option key={f.slug} value={f.slug}>
                    {f.name} ({f.slug})
                  </option>
                ))}
              </select>
            </div>
          )}
          {targetSlug && (
            <div className="form-group">
              <label className="subscription-check-label">
                <input type="checkbox" name="showBacklinksOnTarget" value="1" />
                On the target record’s page, list records from this module that link here (expanded)
              </label>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.35rem", marginBottom: 0 }}>
                Optional. Only applies to relation fields pointing at the selected module.
              </p>
            </div>
          )}
        </>
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
