"use client";

import { useState, useRef, useEffect } from "react";
import { useActionState } from "react";
import { removeFieldFromModule, reorderFieldInModule } from "@/app/dashboard/actions";
import { ConfirmModal } from "@/components/dashboard/ConfirmModal";

type Field = {
  id: string;
  name: string;
  slug: string;
  fieldType: string;
  isRequired: boolean;
  settings: unknown;
  sortOrder: number;
};

const FIELD_TYPES = ["text", "number", "date", "boolean", "select", "relation", "relation-multi", "file", "json"] as const;

type FormAction = (prev: unknown, formData: FormData) => Promise<unknown>;

function FormExtraFields({ fields }: { fields?: Record<string, string> }) {
  if (!fields || Object.keys(fields).length === 0) return null;
  return (
    <>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

export function FieldListRow({
  moduleSlug,
  field,
  isFirst,
  isLast,
  removeAction,
  reorderAction,
  updateAction,
  removeFormAction,
  reorderFormAction,
  updateFormAction,
  extraFormFields,
  fieldRecordCount = 0,
  otherModules = [],
}: {
  moduleSlug: string;
  field: Field;
  isFirst: boolean;
  isLast: boolean;
  removeAction?: (moduleSlug: string, fieldSlug: string) => Promise<{ error?: string }>;
  reorderAction?: (moduleSlug: string, fieldSlug: string, direction: "up" | "down") => Promise<unknown>;
  updateAction?: (moduleSlug: string, fieldSlug: string, prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  removeFormAction?: FormAction;
  reorderFormAction?: FormAction;
  updateFormAction?: FormAction;
  extraFormFields?: Record<string, string>;
  /** When set (e.g. platform admin), Remove is disabled if > 0 and tooltip explains. */
  fieldRecordCount?: number;
  otherModules?: { slug: string; name: string; fields: { slug: string; name: string }[] }[];
}) {
  const [editing, setEditing] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const removeFormRef = useRef<HTMLFormElement>(null);
  const usePlatformRemove = !!removeFormAction;
  const usePlatformReorder = !!reorderFormAction;
  const usePlatformUpdate = !!updateFormAction;

  const [removeState, removeFormActionState] = useActionState(
    usePlatformRemove
      ? (removeFormAction as FormAction)
      : async (_prev: unknown) => (removeAction ? removeAction(moduleSlug, field.slug) : { error: "Not configured" }),
    null
  );
  const [updateState, updateFormActionState] = useActionState(
    usePlatformUpdate ? (updateFormAction as FormAction) : (_prev: unknown, formData: FormData) => (updateAction ? updateAction(moduleSlug, field.slug, null, formData) : Promise.resolve({})),
    null
  );
  const removeError = removeState && typeof removeState === "object" && "error" in removeState ? (removeState as { error: string }).error : null;
  const updateError = updateState && typeof updateState === "object" && "error" in updateState ? (updateState as { error: string }).error : null;

  const platformHidden = extraFormFields ? { ...extraFormFields, moduleSlug, fieldSlug: field.slug } : undefined;
  const canRemove = fieldRecordCount === 0;

  const settings = (field.settings as Record<string, unknown> | null) ?? {};
  const optionsStr = Array.isArray(settings.options) ? (settings.options as string[]).join(", ") : "";
  const targetSlug = (settings.targetModuleSlug as string) ?? "";
  const displayFieldSlugSetting = (settings.displayFieldSlug as string) ?? "";
  const showBacklinksOnTarget = settings.showBacklinksOnTarget === true;
  const [relationTarget, setRelationTarget] = useState(targetSlug);
  useEffect(() => {
    if (editing) setRelationTarget(targetSlug);
  }, [editing, targetSlug]);
  const selectedModuleFields =
    otherModules.find((m) => m.slug === relationTarget)?.fields ?? [];

  const settingsStr = (() => {
    if (!settings || typeof settings !== "object") return "—";
    const parts: string[] = [];
    if (Array.isArray(settings.options)) parts.push(`options: ${(settings.options as string[]).join(", ")}`);
    if (settings.targetModuleSlug) parts.push(`→ ${settings.targetModuleSlug}`);
    if (settings.displayFieldSlug) parts.push(`show: ${settings.displayFieldSlug}`);
    if (settings.showBacklinksOnTarget === true) parts.push("backlinks on target");
    return parts.length ? parts.join("; ") : "—";
  })();

  if (editing && (updateAction || updateFormAction)) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: "1rem", background: "#f8fafc", verticalAlign: "top" }}>
          <form action={updateFormActionState} className="settings-form" style={{ maxWidth: 420 }}>
            {platformHidden && <FormExtraFields fields={platformHidden} />}
            <div className="form-group">
              <label>Name</label>
              <input name="name" type="text" defaultValue={field.name} className="form-control" required />
            </div>
            <p style={{ fontSize: "0.8125rem", color: "#64748b" }}>Slug: <code>{field.slug}</code> (cannot be changed)</p>
            <div className="form-group">
              <label>Type</label>
              {!canRemove ? (
                <>
                  <input type="hidden" name="fieldType" value={field.fieldType} />
                  <p className="form-control" style={{ marginBottom: 0, background: "#f1f5f9", color: "#64748b" }}>
                    {field.fieldType}
                  </p>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
                    Type cannot be changed while records have values for this field.
                  </p>
                </>
              ) : (
                <select name="fieldType" className="form-control" defaultValue={field.fieldType}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="form-group">
              <label className="subscription-check-label">
                <input type="checkbox" name="isRequired" value="1" defaultChecked={field.isRequired} />
                Required
              </label>
            </div>
            <div className="form-group">
              <label>Options (for Select, comma-separated)</label>
              <input name="options" type="text" defaultValue={optionsStr} className="form-control" placeholder="Draft, Active, Done" />
            </div>
            {otherModules.length > 0 && (
              <div className="form-group">
                <label>Target module (for Relation)</label>
                <select
                  name="targetModuleSlug"
                  className="form-control"
                  value={relationTarget}
                  onChange={(e) => setRelationTarget(e.target.value)}
                >
                  <option value="">— None —</option>
                  {otherModules.map((m) => (
                    <option key={m.slug} value={m.slug}>{m.name}</option>
                  ))}
                </select>
              </div>
            )}
            {otherModules.length > 0 &&
              (field.fieldType === "relation" || field.fieldType === "relation-multi") &&
              relationTarget &&
              selectedModuleFields.length > 0 && (
                <div className="form-group">
                  <label>Show in lists / pickers</label>
                  <select
                    key={relationTarget}
                    name="displayFieldSlug"
                    className="form-control"
                    defaultValue={relationTarget === targetSlug ? displayFieldSlugSetting : ""}
                  >
                    <option value="">Default (name, or first field)</option>
                    {selectedModuleFields.map((f) => (
                      <option key={f.slug} value={f.slug}>
                        {f.name} ({f.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            {otherModules.length > 0 &&
              (field.fieldType === "relation" || field.fieldType === "relation-multi") &&
              relationTarget && (
                <div className="form-group">
                  <label className="subscription-check-label">
                    <input
                      type="checkbox"
                      name="showBacklinksOnTarget"
                      value="1"
                      defaultChecked={showBacklinksOnTarget}
                    />
                    On the target record’s page, list records from this module that link here (expanded)
                  </label>
                  <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.35rem", marginBottom: 0 }}>
                    Uses the relationship index; re-save linked records if backlinks look out of date.
                  </p>
                </div>
              )}
            {updateError && <p className="view-error" role="alert">{updateError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  const reorderUpAction: ((formData: FormData) => void | Promise<void>) | undefined = usePlatformReorder
    ? undefined
    : reorderAction
      ? async (_formData: FormData) => {
          await reorderAction(moduleSlug, field.slug, "up");
        }
      : undefined;
  const reorderDownAction: ((formData: FormData) => void | Promise<void>) | undefined = usePlatformReorder
    ? undefined
    : reorderAction
      ? async (_formData: FormData) => {
          await reorderAction(moduleSlug, field.slug, "down");
        }
      : undefined;

  return (
    <tr>
      <td>
        <div className="field-list-row-actions">
          {usePlatformReorder ? (
            <>
              <form action={reorderFormAction as (formData: FormData) => void | Promise<void>} style={{ display: "inline" }}>
                <FormExtraFields fields={platformHidden} />
                <input type="hidden" name="direction" value="up" />
                <button type="submit" className="btn btn-secondary btn-touch" disabled={isFirst} title="Move up" aria-label="Move field up">
                  ↑
                </button>
              </form>
              <form action={reorderFormAction as (formData: FormData) => void | Promise<void>} style={{ display: "inline" }}>
                <FormExtraFields fields={platformHidden} />
                <input type="hidden" name="direction" value="down" />
                <button type="submit" className="btn btn-secondary btn-touch" disabled={isLast} title="Move down" aria-label="Move field down">
                  ↓
                </button>
              </form>
            </>
          ) : (
            <>
              <form action={reorderUpAction} style={{ display: "inline" }}>
                <button type="submit" className="btn btn-secondary btn-touch" disabled={isFirst} title="Move up" aria-label="Move field up">
                  ↑
                </button>
              </form>
              <form action={reorderDownAction} style={{ display: "inline" }}>
                <button type="submit" className="btn btn-secondary btn-touch" disabled={isLast} title="Move down" aria-label="Move field down">
                  ↓
                </button>
              </form>
            </>
          )}
        </div>
      </td>
      <td>{field.name}</td>
      <td><code style={{ fontSize: "0.8125rem" }}>{field.slug}</code></td>
      <td>{field.fieldType}</td>
      <td>{field.isRequired ? "Yes" : "—"}</td>
      <td style={{ fontSize: "0.8125rem", color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{settingsStr}</td>
      <td>
        {(updateAction || updateFormAction) && (
          <button type="button" className="btn btn-secondary btn-touch" style={{ marginRight: "0.35rem" }} onClick={() => setEditing(true)} aria-label="Edit field">
            Edit
          </button>
        )}
        <form ref={removeFormRef} id={`remove-field-${field.id}`} action={removeFormActionState} style={{ display: "inline" }}>
          {platformHidden && <FormExtraFields fields={platformHidden} />}
          <button type="submit" style={{ display: "none" }} aria-hidden />
          <button
            type="button"
            className="btn btn-danger"
            style={{ fontSize: "0.8125rem", padding: "0.35rem 0.65rem" }}
            disabled={!canRemove}
            title={!canRemove ? `Cannot remove: ${fieldRecordCount} record(s) have a value for this field. Clear data first.` : undefined}
            onClick={() => canRemove && setRemoveConfirmOpen(true)}
          >
            Remove
          </button>
        </form>
      <ConfirmModal
        open={removeConfirmOpen}
        title="Remove field"
        message={`Remove field "${field.name}"? You cannot undo this.`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => { setRemoveConfirmOpen(false); removeFormRef.current?.requestSubmit(); }}
        onCancel={() => setRemoveConfirmOpen(false)}
      />
        {removeError && <p className="view-error" role="alert" style={{ marginTop: "0.25rem", marginBottom: 0 }}>{removeError}</p>}
      </td>
    </tr>
  );
}
