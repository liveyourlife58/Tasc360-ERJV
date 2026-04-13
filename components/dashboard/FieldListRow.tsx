"use client";

import { useState, useRef, useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { removeFieldFromModule, reorderFieldInModule } from "@/app/dashboard/actions";
import { getFieldDeadlineListDaysAhead } from "@/lib/deadline-field";
import {
  ACTIVITY_FIELD_DEFAULT_PREVIEW_LIMIT,
  ACTIVITY_FIELD_MAX_PREVIEW_LIMIT,
  getActivityPreviewLimit,
} from "@/lib/activity-field";
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

const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "tenant-user",
  "relation",
  "relation-multi",
  "file",
  "json",
  "activity",
] as const;

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
  clearFieldValuesAction,
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
  /** Platform admin module fields: bulk-clear JSON values so type can change / field can be removed. */
  clearFieldValuesAction?: (prev: unknown, formData: FormData) => Promise<{ error?: string; cleared?: number }>;
  otherModules?: { slug: string; name: string; fields: { slug: string; name: string }[] }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftFieldType, setDraftFieldType] = useState(field.fieldType);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const removeFormRef = useRef<HTMLFormElement>(null);
  const clearFormRef = useRef<HTMLFormElement>(null);
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
  const [clearState, clearFormActionState] = useActionState(
    clearFieldValuesAction ?? (async () => ({ error: "Clear is not available here." })),
    null as { error?: string; cleared?: number } | null
  );
  const removeError = removeState && typeof removeState === "object" && "error" in removeState ? (removeState as { error: string }).error : null;
  const updateError = updateState && typeof updateState === "object" && "error" in updateState ? (updateState as { error: string }).error : null;
  const clearError =
    clearState && typeof clearState === "object" && "error" in clearState ? (clearState as { error: string }).error : null;

  useEffect(() => {
    if (clearState && typeof clearState === "object" && "cleared" in clearState) {
      router.refresh();
    }
  }, [clearState, router]);

  useEffect(() => {
    if (editing) setDraftFieldType(field.fieldType);
  }, [editing, field.fieldType]);

  const platformHidden = extraFormFields ? { ...extraFormFields, moduleSlug, fieldSlug: field.slug } : undefined;
  const canRemove = fieldRecordCount === 0;

  const settings = (field.settings as Record<string, unknown> | null) ?? {};
  const optionsStr = Array.isArray(settings.options) ? (settings.options as string[]).join(", ") : "";
  const targetSlug = (settings.targetModuleSlug as string) ?? "";
  const displayFieldSlugSetting = (settings.displayFieldSlug as string) ?? "";
  const showBacklinksOnTarget = settings.showBacklinksOnTarget === true;
  const showInEntityList = settings.showInEntityList !== false;
  const deadlineDate = field.fieldType === "date" && settings.deadline === true;
  const deadlineListDaysAheadStored = getFieldDeadlineListDaysAhead(settings);
  const [relationTarget, setRelationTarget] = useState(targetSlug);
  useEffect(() => {
    if (editing) setRelationTarget(targetSlug);
  }, [editing, targetSlug]);
  const selectedModuleFields =
    otherModules.find((m) => m.slug === relationTarget)?.fields ?? [];

  const highlightRulesDefault = (() => {
    const hr = settings.highlightRules;
    if (Array.isArray(hr) && hr.length > 0) return JSON.stringify(hr, null, 2);
    return "[]";
  })();

  const settingsStr = (() => {
    if (!settings || typeof settings !== "object") return "—";
    const parts: string[] = [];
    if (field.fieldType === "tenant-user") parts.push("workspace team users");
    else if (field.fieldType === "activity")
      parts.push(`recent activity (up to ${getActivityPreviewLimit(settings)} events)`);
    else if (Array.isArray(settings.options)) parts.push(`options: ${(settings.options as string[]).join(", ")}`);
    if (settings.targetModuleSlug) parts.push(`→ ${settings.targetModuleSlug}`);
    if (settings.displayFieldSlug) parts.push(`show: ${settings.displayFieldSlug}`);
    if (settings.showBacklinksOnTarget === true) parts.push("backlinks on target");
    if (Array.isArray(settings.highlightRules) && settings.highlightRules.length > 0) {
      parts.push(`${settings.highlightRules.length} highlight rule(s)`);
    }
    if (settings.showInEntityList === false) parts.push("hidden from list");
    if (settings.deadline === true) {
      parts.push(
        deadlineListDaysAheadStored === null
          ? "deadline (overdue only)"
          : `deadline (≤ today+${deadlineListDaysAheadStored}d)`
      );
    }
    return parts.length ? parts.join("; ") : "—";
  })();

  if (editing && (updateAction || updateFormAction)) {
    return (
      <tr>
        <td colSpan={7} style={{ padding: "1rem", background: "#f8fafc", verticalAlign: "top" }}>
          <form action={updateFormActionState} className="settings-form" style={{ maxWidth: 640 }}>
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
                <select
                  name="fieldType"
                  className="form-control"
                  value={draftFieldType}
                  onChange={(e) => setDraftFieldType(e.target.value)}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
            {draftFieldType !== "activity" && (
              <div className="form-group">
                <label className="subscription-check-label">
                  <input type="checkbox" name="isRequired" value="1" defaultChecked={field.isRequired} />
                  Required
                </label>
              </div>
            )}
            <div className="form-group">
              <label className="subscription-check-label">
                <input type="checkbox" name="showInEntityList" value="1" defaultChecked={showInEntityList} />
                Show in module record list (table and CSV export)
              </label>
              <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.35rem", marginBottom: 0 }}>
                Uncheck to keep the field on the record form but omit it from the list and export columns.
              </p>
            </div>
            {draftFieldType === "date" && (
              <div className="form-group">
                <label className="subscription-check-label">
                  <input type="checkbox" name="deadline" value="1" defaultChecked={deadlineDate} />
                  Treat as deadline (can push the record up the module list and export)
                </label>
                <div style={{ marginTop: "0.75rem", marginLeft: "0.25rem" }}>
                  <label htmlFor={`deadline-list-days-${field.id}`} style={{ display: "block", marginBottom: "0.35rem" }}>
                    List priority window (days)
                  </label>
                  <input
                    id={`deadline-list-days-${field.id}`}
                    name="deadlineListDaysAhead"
                    type="number"
                    min={0}
                    max={3650}
                    step={1}
                    className="form-control"
                    style={{ maxWidth: "12rem" }}
                    placeholder="Blank = overdue only"
                    defaultValue={
                      deadlineListDaysAheadStored === null ? "" : String(deadlineListDaysAheadStored)
                    }
                  />
                  <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.35rem", marginBottom: 0 }}>
                    Only applies when <strong>Treat as deadline</strong> is checked. Blank = strictly before today;{" "}
                    <code>0</code> = overdue or due today; <code>N</code> = on or before today + N calendar days (tenant time zone).
                    Multiple deadline fields each use their own window; a row rises if <strong>any</strong> qualifies.
                  </p>
                </div>
                <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.75rem", marginBottom: 0 }}>
                  Highlight examples:{" "}
                  <code style={{ fontSize: "0.75rem" }}>{`{ "when": { "op": "deadlinePassed" }, "variant": "red" }`}</code>
                  ,{" "}
                  <code style={{ fontSize: "0.75rem" }}>{`{ "when": { "op": "deadlineDueWithinDays", "days": 7 }, "variant": "amber" }`}</code>{" "}
                  (independent of the list window unless you use the same <code>days</code> here).
                </p>
              </div>
            )}
            {draftFieldType === "select" && (
              <div className="form-group">
                <label>Options (for Select, comma-separated)</label>
                <input name="options" type="text" defaultValue={optionsStr} className="form-control" placeholder="Draft, Active, Done" />
              </div>
            )}
            {draftFieldType === "activity" && (
              <div className="form-group">
                <label htmlFor={`activity-limit-${field.id}`}>Events to show on the record form</label>
                <input
                  id={`activity-limit-${field.id}`}
                  name="activityLimit"
                  type="number"
                  min={1}
                  max={ACTIVITY_FIELD_MAX_PREVIEW_LIMIT}
                  step={1}
                  className="form-control"
                  style={{ maxWidth: "12rem" }}
                  placeholder={`Default ${ACTIVITY_FIELD_DEFAULT_PREVIEW_LIMIT}`}
                  defaultValue={
                    typeof settings.activityLimit === "number" && Number.isFinite(settings.activityLimit)
                      ? String(settings.activityLimit)
                      : ""
                  }
                />
                <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.35rem", marginBottom: 0 }}>
                  Read-only: shows recent audit events for this record. Blank = {ACTIVITY_FIELD_DEFAULT_PREVIEW_LIMIT}{" "}
                  events (max {ACTIVITY_FIELD_MAX_PREVIEW_LIMIT}).
                </p>
              </div>
            )}
            {otherModules.length > 0 && (draftFieldType === "relation" || draftFieldType === "relation-multi") && (
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
              (draftFieldType === "relation" || draftFieldType === "relation-multi") &&
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
              (draftFieldType === "relation" || draftFieldType === "relation-multi") &&
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
            {clearFieldValuesAction && fieldRecordCount > 0 && (
              <div
                className="form-group"
                style={{
                  padding: "0.75rem 1rem",
                  background: "#fffbeb",
                  border: "1px solid #fcd34d",
                  borderRadius: "8px",
                  marginBottom: "0.75rem",
                }}
              >
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "#78350f" }}>
                  <strong>{fieldRecordCount}</strong> record{fieldRecordCount !== 1 ? "s" : ""} still store a value for this field
                  (including booleans you cannot unset on the record form). Clear them here if you need to change the type or remove this field.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ borderColor: "#d97706", color: "#92400e" }}
                  onClick={() => setClearConfirmOpen(true)}
                >
                  Clear all record values…
                </button>
                {clearError && (
                  <p className="view-error" role="alert" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
                    {clearError}
                  </p>
                )}
              </div>
            )}
            <div className="form-group">
              <label htmlFor={`highlightRulesJson-${field.id}`}>Value highlights (JSON)</label>
              <textarea
                id={`highlightRulesJson-${field.id}`}
                name="highlightRulesJson"
                className="form-control"
                rows={10}
                defaultValue={highlightRulesDefault}
                spellCheck={false}
                style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}
              />
              <p style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.35rem", marginBottom: 0 }}>
                Optional list highlights. First matching rule wins (field order, then rule order). Same-field:{" "}
                <code style={{ fontSize: "0.75rem" }}>{`{ "when": { "op": "isTrue" }, "variant": "amber" }`}</code>
                . Predicate on another field: add{" "}
                <code style={{ fontSize: "0.75rem" }}>{`"whenFieldSlug": "business"`}</code>
                (uses that field’s type for operators). Color a different column: add{" "}
                <code style={{ fontSize: "0.75rem" }}>{`"highlightFieldSlugs": ["client_name"]`}</code>
                (omit to highlight this field only). Optional{" "}
                <code style={{ fontSize: "0.75rem" }}>{`"colors": { "background": "#f0fdf4", "accent": "#15803d" }`}</code>{" "}
                (hex <code>#rgb</code>/<code>#rrggbb</code> or <code>transparent</code>) overrides preset CSS; omit <code>variant</code> only if{" "}
                <code>colors</code> includes at least one valid value (otherwise <code>variant</code> is required). Preset tones:{" "}
                <code>blue</code>, <code>green</code>, <code>amber</code>, <code>red</code>, <code>gray</code> (legacy{" "}
                <code>info</code>/<code>success</code>/<code>warning</code>/<code>danger</code>/<code>neutral</code> still work). Operators:
                empty, nonEmpty, equals, oneOf, contains, gt/gte/lt/lte, between, betweenDates, before, after, deadlinePassed,
                deadlineNotPassed, deadlineDueToday, deadlineDueWithinDays (date on/before today+N; requires <code>days</code>), isTrue, isFalse.
              </p>
            </div>
            {updateError && <p className="view-error" role="alert">{updateError}</p>}
            {clearError && <p className="view-error" role="alert">{clearError}</p>}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
          <form ref={clearFormRef} action={clearFormActionState} style={{ display: "none" }} aria-hidden>
            {platformHidden && <FormExtraFields fields={platformHidden} />}
            <button type="submit" tabIndex={-1}>
              Submit
            </button>
          </form>
          <ConfirmModal
            open={clearConfirmOpen}
            title="Clear all record values?"
            message={`This will permanently remove the value for “${field.name}” (${field.slug}) from every record in this module, including soft-deleted records. Search text will be refreshed. You cannot undo this.`}
            confirmLabel="Clear all values"
            variant="danger"
            onConfirm={() => {
              setClearConfirmOpen(false);
              clearFormRef.current?.requestSubmit();
            }}
            onCancel={() => setClearConfirmOpen(false)}
          />
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
        {clearFieldValuesAction && fieldRecordCount > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-touch"
            style={{ marginRight: "0.35rem", fontSize: "0.8125rem", color: "#92400e", borderColor: "#d97706" }}
            onClick={() => setClearConfirmOpen(true)}
            title="Remove this field’s value from every record so you can change type or delete the field"
          >
            Clear values
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
            title={!canRemove ? `Cannot remove: ${fieldRecordCount} record(s) still have a non-empty value for this field.` : undefined}
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
        <form ref={clearFormRef} action={clearFormActionState} style={{ display: "none" }} aria-hidden>
          {platformHidden && <FormExtraFields fields={platformHidden} />}
          <button type="submit" tabIndex={-1}>
            Submit
          </button>
        </form>
        <ConfirmModal
          open={clearConfirmOpen}
          title="Clear all record values?"
          message={`This will permanently remove the value for “${field.name}” (${field.slug}) from every record in this module, including soft-deleted records. Search text will be refreshed. You cannot undo this.`}
          confirmLabel="Clear all values"
          variant="danger"
          onConfirm={() => {
            setClearConfirmOpen(false);
            clearFormRef.current?.requestSubmit();
          }}
          onCancel={() => setClearConfirmOpen(false)}
        />
        {removeError && <p className="view-error" role="alert" style={{ marginTop: "0.25rem", marginBottom: 0 }}>{removeError}</p>}
        {clearError && !editing && (
          <p className="view-error" role="alert" style={{ marginTop: "0.25rem", marginBottom: 0 }}>
            {clearError}
          </p>
        )}
      </td>
    </tr>
  );
}
