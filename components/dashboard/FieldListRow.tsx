"use client";

import { useState, useRef } from "react";
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

export function FieldListRow({
  moduleSlug,
  field,
  isFirst,
  isLast,
  removeAction,
  reorderAction,
  updateAction,
  otherModuleSlugs = [],
}: {
  moduleSlug: string;
  field: Field;
  isFirst: boolean;
  isLast: boolean;
  removeAction: (moduleSlug: string, fieldSlug: string) => Promise<{ error?: string }>;
  reorderAction: (moduleSlug: string, fieldSlug: string, direction: "up" | "down") => Promise<unknown>;
  updateAction?: (moduleSlug: string, fieldSlug: string, prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  otherModuleSlugs?: { slug: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const removeFormRef = useRef<HTMLFormElement>(null);
  const [removeState, removeFormAction] = useActionState(
    async (_prev: unknown) => removeAction(moduleSlug, field.slug),
    null
  );
  const [updateState, updateFormAction] = useActionState(
    (_prev: unknown, formData: FormData) => (updateAction ? updateAction(moduleSlug, field.slug, null, formData) : Promise.resolve({})),
    null
  );
  const removeError = removeState && typeof removeState === "object" && "error" in removeState ? (removeState as { error: string }).error : null;
  const updateError = updateState && typeof updateState === "object" && "error" in updateState ? (updateState as { error: string }).error : null;

  const settings = (field.settings as Record<string, unknown> | null) ?? {};
  const optionsStr = Array.isArray(settings.options) ? (settings.options as string[]).join(", ") : "";
  const targetSlug = (settings.targetModuleSlug as string) ?? "";

  const settingsStr = (() => {
    if (!settings || typeof settings !== "object") return "—";
    const parts: string[] = [];
    if (Array.isArray(settings.options)) parts.push(`options: ${(settings.options as string[]).join(", ")}`);
    if (settings.targetModuleSlug) parts.push(`→ ${settings.targetModuleSlug}`);
    return parts.length ? parts.join("; ") : "—";
  })();

  if (editing && updateAction) {
    return (
      <tr>
        <td colSpan={6} style={{ padding: "1rem", background: "#f8fafc", verticalAlign: "top" }}>
          <form action={updateFormAction} className="settings-form" style={{ maxWidth: 420 }}>
            <div className="form-group">
              <label>Name</label>
              <input name="name" type="text" defaultValue={field.name} className="form-control" required />
            </div>
            <p style={{ fontSize: "0.8125rem", color: "#64748b" }}>Slug: <code>{field.slug}</code> (cannot be changed)</p>
            <div className="form-group">
              <label>Type</label>
              <select name="fieldType" className="form-control" defaultValue={field.fieldType}>
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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
            {otherModuleSlugs.length > 0 && (
              <div className="form-group">
                <label>Target module (for Relation)</label>
                <select name="targetModuleSlug" className="form-control" defaultValue={targetSlug}>
                  <option value="">— None —</option>
                  {otherModuleSlugs.map((m) => (
                    <option key={m.slug} value={m.slug}>{m.name}</option>
                  ))}
                </select>
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

  return (
    <tr>
      <td>
        <div className="field-list-row-actions">
          <form action={async (_fd: FormData): Promise<void> => { await reorderAction(moduleSlug, field.slug, "up"); }} style={{ display: "inline" }}>
            <button type="submit" className="btn btn-secondary btn-touch" disabled={isFirst} title="Move up" aria-label="Move field up">
              ↑
            </button>
          </form>
          <form action={async (_fd: FormData): Promise<void> => { await reorderAction(moduleSlug, field.slug, "down"); }} style={{ display: "inline" }}>
            <button type="submit" className="btn btn-secondary btn-touch" disabled={isLast} title="Move down" aria-label="Move field down">
              ↓
            </button>
          </form>
        </div>
      </td>
      <td>{field.name}</td>
      <td><code style={{ fontSize: "0.8125rem" }}>{field.slug}</code></td>
      <td>{field.fieldType}</td>
      <td>{field.isRequired ? "Yes" : "—"}</td>
      <td style={{ fontSize: "0.8125rem", color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>{settingsStr}</td>
      <td>
        {updateAction && (
          <button type="button" className="btn btn-secondary btn-touch" style={{ marginRight: "0.35rem" }} onClick={() => setEditing(true)} aria-label="Edit field">
            Edit
          </button>
        )}
        <form ref={removeFormRef} id={`remove-field-${field.id}`} action={removeFormAction} style={{ display: "inline" }}>
          <button type="submit" style={{ display: "none" }} aria-hidden />
          <button type="button" className="btn btn-danger" style={{ fontSize: "0.8125rem", padding: "0.35rem 0.65rem" }} onClick={() => setRemoveConfirmOpen(true)}>
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
