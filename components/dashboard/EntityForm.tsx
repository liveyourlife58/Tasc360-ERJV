"use client";

import { useActionState, useState, useRef, useEffect, useCallback } from "react";
import { BlobUploadInput } from "@/components/dashboard/BlobUploadInput";
import { extractYyyyMmDdFromStoredValue, formatDateTime } from "@/lib/format";
import { getActivityPreviewLimit } from "@/lib/activity-field";
import { entityFormFieldCellClassName } from "@/lib/entity-form-field-groups";
import type { EntityFormLayout } from "@/lib/entity-form-layout";
import { getEntityFormRenderPlan } from "@/lib/entity-form-layout";
import { useFieldAutoSave } from "@/components/dashboard/useFieldAutoSave";
import { AutoSaveStatusIcon } from "@/components/dashboard/AutoSaveStatus";

type Field = {
  id: string;
  name: string;
  slug: string;
  fieldType: string;
  isRequired: boolean;
  settings: unknown;
  sortOrder: number;
};

type ActionResult = (prev: unknown, formData: FormData) => Promise<unknown>;

export type RelationOption = { id: string; label: string };

/** Serialized for the entity form; recent audit rows for `activity` fields. */
export type EntityActivityPreviewRow = {
  id: string;
  eventType: string;
  createdAt: string;
  actorLabel: string;
};

function RelationMultiCombobox({
  fieldSlug,
  fieldName,
  options,
  defaultValue,
  onSelectionChange,
}: {
  fieldSlug: string;
  fieldName: string;
  options: RelationOption[];
  defaultValue: string[];
  /** Fired after add/remove with the full selection; used for per-field auto-save. */
  onSelectionChange?: (selectedIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const available = options.filter(
    (opt) =>
      !selectedIds.includes(opt.id) &&
      (query === "" || opt.label.toLowerCase().includes(query.toLowerCase()))
  );

  function add(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      onSelectionChange?.(next);
      return next;
    });
    setQuery("");
  }

  function remove(id: string) {
    setSelectedIds((prev) => {
      const next = prev.filter((x) => x !== id);
      onSelectionChange?.(next);
      return next;
    });
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name={fieldSlug} value={id} />
      ))}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.35rem",
          alignItems: "center",
          minHeight: "2.25rem",
          padding: "0.35rem 0.5rem",
          border: "1px solid #cbd5e1",
          borderRadius: "4px",
          background: "#fff",
        }}
      >
        {selectedIds.map((id) => {
          const opt = options.find((o) => o.id === id);
          return (
            <span
              key={id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.15rem 0.4rem",
                background: "#e2e8f0",
                borderRadius: "4px",
                fontSize: "0.8125rem",
              }}
            >
              {opt?.label ?? id.slice(0, 8)}
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label={`Remove ${opt?.label ?? id}`}
                style={{
                  margin: 0,
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  fontSize: "1rem",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
          }}
          placeholder={options.length === 0 ? "No options" : "Search or select..."}
          style={{
            flex: 1,
            minWidth: 120,
            border: "none",
            outline: "none",
            padding: "0.15rem 0",
            fontSize: "inherit",
          }}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
          aria-label={fieldName}
        />
      </div>
      {open && available.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 50,
            top: "100%",
            left: 0,
            right: 0,
            margin: 0,
            marginTop: "2px",
            padding: "0.25rem 0",
            listStyle: "none",
            maxHeight: "12rem",
            overflowY: "auto",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            background: "#fff",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
          }}
        >
          {available.map((opt) => (
            <li
              key={opt.id}
              role="option"
              tabIndex={-1}
              onClick={() => add(opt.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  add(opt.id);
                }
              }}
              style={{
                padding: "0.4rem 0.75rem",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#f1f5f9";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "";
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
      {open && query !== "" && available.length === 0 && (
        <div
          style={{
            position: "absolute",
            zIndex: 50,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "2px",
            padding: "0.5rem 0.75rem",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            background: "#fff",
            fontSize: "0.8125rem",
            color: "#64748b",
          }}
        >
          No matches
        </div>
      )}
    </div>
  );
}

export function EntityForm({
  moduleSlug,
  moduleName,
  fields,
  initialData,
  entityId,
  relationOptions = {},
  tenantUserOptions = [],
  entityActivityRows = [],
  wideLayout = false,
  activityFieldPresentation = "inline",
  entityFormLayout = null,
  modulePaymentType = null,
  entityPaymentType = null,
  priceCents = null,
  suggestedDonationAmountCents = null,
  capacity = null,
  autoSave = false,
  action,
}: {
  moduleSlug: string;
  moduleName: string;
  fields: Field[];
  initialData: Record<string, unknown>;
  entityId?: string;
  relationOptions?: Record<string, RelationOption[]>;
  /** Options for every `tenant-user` field (workspace team members). */
  tenantUserOptions?: RelationOption[];
  /** Recent events for read-only `activity` fields (edit page only). */
  entityActivityRows?: EntityActivityPreviewRow[];
  /** When true, form stretches to fill the main column (e.g. beside Activity sidebar). */
  wideLayout?: boolean;
  /** `sidebar`: activity field row is hidden (Activity rail shows history); `inline`: compact preview list on the form. */
  activityFieldPresentation?: "inline" | "sidebar";
  /** When set, entity create/edit uses the saved custom layout instead of the default field list order. */
  entityFormLayout?: EntityFormLayout | null;
  /** When set, show "Payment for this record" override (use module default / none / payment / donation). */
  modulePaymentType?: "payment" | "donation" | null;
  entityPaymentType?: "payment" | "donation" | "none" | null;
  /** Price in cents (for payment type). Shown when module has payment/donation. */
  priceCents?: number | null;
  /** Suggested donation amount in cents. Shown when module has payment/donation. */
  suggestedDonationAmountCents?: number | null;
  /** Max capacity (e.g. tickets). Stored in entity.metadata.capacity. Shown when module has payment type. */
  capacity?: number | null;
  /** When true (entity edit page), each field saves individually on change/blur and the primary Save button is hidden for data fields. */
  autoSave?: boolean;
  action: ActionResult;
}) {
  const [state, formAction] = useActionState(action, null);
  const [paymentType, setPaymentType] = useState(entityPaymentType ?? "");
  const effectiveType =
    paymentType === "" ? modulePaymentType : paymentType === "none" ? null : paymentType;
  const priceDefault =
    priceCents != null && priceCents > 0 ? (priceCents / 100).toFixed(2) : "";
  const suggestedDefault =
    suggestedDonationAmountCents != null && suggestedDonationAmountCents > 0
      ? (suggestedDonationAmountCents / 100).toFixed(2)
      : "";
  const capacityDefault = capacity != null && capacity > 0 ? String(capacity) : "";

  const renderPlan = getEntityFormRenderPlan(fields, entityFormLayout ?? null);
  /** Activity rail already shows history; omit read-only activity field rows from the form. */
  const hideActivityFieldInForm = activityFieldPresentation === "sidebar";
  const autoSaveEnabled = !!(autoSave && entityId);

  const renderFieldLabelAndInput = (field: Field) => {
    const common = {
      field,
      defaultValue: initialData[field.slug],
      relationOptions: relationOptions[field.slug],
      tenantUserOptions,
      entityActivityRows,
      entityId,
      activityFieldPresentation,
    } as const;
    if (autoSaveEnabled && field.fieldType !== "activity" && entityId) {
      return (
        <AutoSaveFieldInput
          entityId={entityId}
          moduleSlug={moduleSlug}
          fieldProps={common}
        />
      );
    }
    return (
      <>
        <label htmlFor={field.slug}>
          {field.name}
          {field.isRequired && field.fieldType !== "activity" && " *"}
        </label>
        <FieldInput {...common} />
      </>
    );
  };

  return (
    <form
      action={formAction}
      className={wideLayout ? "entity-form entity-form--wide" : "entity-form"}
      style={wideLayout ? { width: "100%", maxWidth: "100%" } : { maxWidth: 480 }}
    >
      {state && typeof state === "object" && "error" in state ? (
        <p className="view-error" role="alert" style={{ marginBottom: "1rem" }}>
          {(state as { error: string }).error}
        </p>
      ) : null}
      {entityId && <input type="hidden" name="entityId" value={entityId} />}
      <div className="entity-form-field-groups">
        {renderPlan.kind === "custom-placement-grid" ? (
          <section className="entity-form-field-group" aria-labelledby="entity-form-group-custom">
            <h3 className="entity-form-field-group-heading" id="entity-form-group-custom">
              Fields
            </h3>
            <div
              className="entity-form-placement-grid"
              style={{
                gridTemplateColumns: `repeat(${renderPlan.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${renderPlan.rows}, auto)`,
              }}
            >
              {renderPlan.items
                .filter(({ field }) => !(hideActivityFieldInForm && field.fieldType === "activity"))
                .map(({ field, row, col, rowSpan, colSpan }) => (
                  <div
                    key={field.id}
                    className="form-group entity-form-placement-cell"
                    style={{
                      gridRow: `${row + 1} / span ${rowSpan}`,
                      gridColumn: `${col + 1} / span ${colSpan}`,
                    }}
                  >
                    {renderFieldLabelAndInput(field)}
                  </div>
                ))}
            </div>
          </section>
        ) : renderPlan.kind === "custom-grid" ? (
          <section className="entity-form-field-group" aria-labelledby="entity-form-group-custom">
            <h3 className="entity-form-field-group-heading" id="entity-form-group-custom">
              Fields
            </h3>
            <div className="entity-form-custom-layout">
              {renderPlan.rows.map((row, rowIdx) => {
                const visible = row.filter((f) => !(hideActivityFieldInForm && f.fieldType === "activity"));
                if (visible.length === 0) return null;
                return (
                  <div
                    key={rowIdx}
                    className="entity-form-fields-row"
                    style={{ ["--entity-form-columns" as string]: String(renderPlan.columns) }}
                  >
                    {visible.map((field) => (
                      <div key={field.id} className={`form-group ${entityFormFieldCellClassName(field.fieldType)}`}>
                        {renderFieldLabelAndInput(field)}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="entity-form-field-group" aria-labelledby="entity-form-group-default">
            <h3 className="entity-form-field-group-heading" id="entity-form-group-default">
              Fields
            </h3>
            <div className="entity-form-fields-grid">
              {renderPlan.fields
                .filter((field) => !(hideActivityFieldInForm && field.fieldType === "activity"))
                .map((field) => (
                  <div key={field.id} className={`form-group ${entityFormFieldCellClassName(field.fieldType)}`}>
                    {renderFieldLabelAndInput(field)}
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
      {modulePaymentType != null && (
        <div className="entity-form-payment-section">
          <h3 className="entity-form-field-group-heading" id="entity-form-group-payment">
            Payment & capacity
          </h3>
          <div className="entity-form-fields-grid entity-form-fields-grid--payment">
          <div className="form-group">
            <label htmlFor="_paymentType">Payment for this record</label>
            <select
              id="_paymentType"
              name="_paymentType"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
            >
              <option value="">Use module default ({modulePaymentType === "donation" ? "Donation" : "Payment"})</option>
              <option value="none">None</option>
              <option value="payment">Payment</option>
              <option value="donation">Donation</option>
            </select>
          </div>
          {effectiveType === "payment" && (
            <div className="form-group">
              <label htmlFor="_price">Price ($) *</label>
              <input
                type="text"
                id="_price"
                name="_price"
                inputMode="decimal"
                placeholder="e.g. 25.00"
                defaultValue={priceDefault}
              />
            </div>
          )}
          {effectiveType === "donation" && (
            <div className="form-group">
              <label htmlFor="_suggestedDonationAmount">Suggested donation amount ($)</label>
              <input
                type="text"
                id="_suggestedDonationAmount"
                name="_suggestedDonationAmount"
                inputMode="decimal"
                placeholder="e.g. 50.00"
                defaultValue={suggestedDefault}
              />
            </div>
          )}
          {(effectiveType === "payment" || effectiveType === "donation") && (
            <div className="form-group">
              <label htmlFor="_capacity">Capacity (max tickets / spots)</label>
              <input
                type="number"
                id="_capacity"
                name="_capacity"
                min={0}
                placeholder="Leave blank for unlimited"
                defaultValue={capacityDefault}
              />
            </div>
          )}
          </div>
        </div>
      )}
      {!(autoSaveEnabled && modulePaymentType == null) && (
        <div className="entity-form-actions" style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button type="submit" className="btn btn-primary">
            {autoSaveEnabled
              ? "Save payment & capacity"
              : entityId
                ? "Save"
                : `Create ${moduleName.slice(0, -1)}`}
          </button>
        </div>
      )}
    </form>
  );
}

type FieldInputProps = {
  field: Field;
  defaultValue: unknown;
  relationOptions?: RelationOption[];
  tenantUserOptions?: RelationOption[];
  entityActivityRows?: EntityActivityPreviewRow[];
  entityId?: string;
  activityFieldPresentation?: "inline" | "sidebar";
  /** When set, the field commits its value through this callback instead of relying on form submission. */
  onCommitValue?: (value: unknown, immediate?: boolean) => void;
};

/**
 * Wraps a FieldInput with per-field auto-save state (debounced for text-like,
 * immediate for controls that commit on change). Keeps `name` attributes so
 * a bulk form-submit (e.g. for payment/capacity) still captures current values.
 *
 * Renders its own <label> with an inline status icon next to the field name so
 * callers on the edit page don't render a separate label.
 */
function AutoSaveFieldInput({
  entityId,
  moduleSlug,
  fieldProps,
}: {
  entityId: string;
  moduleSlug: string;
  fieldProps: Omit<FieldInputProps, "onCommitValue">;
}) {
  const { field } = fieldProps;
  const { status, error, saveNow, saveDebounced, flushDebounced } = useFieldAutoSave({
    entityId,
    moduleSlug,
    fieldSlug: field.slug,
  });
  const pendingRef = useRef<unknown>(undefined);
  const onCommitValue = useCallback(
    (value: unknown, immediate = false) => {
      pendingRef.current = value;
      if (immediate) {
        flushDebounced(value);
        saveNow(value);
      } else {
        saveDebounced(value);
      }
    },
    [flushDebounced, saveDebounced, saveNow]
  );
  return (
    <>
      <label htmlFor={field.slug} className="entity-form-field-label">
        <span className="entity-form-field-label-text">
          {field.name}
          {field.isRequired && field.fieldType !== "activity" && " *"}
        </span>
        <AutoSaveStatusIcon status={status} error={error} />
      </label>
      <FieldInput {...fieldProps} onCommitValue={onCommitValue} />
    </>
  );
}

function FieldInput({
  field,
  defaultValue,
  relationOptions = [],
  tenantUserOptions = [],
  entityActivityRows = [],
  entityId,
  activityFieldPresentation = "inline",
  onCommitValue,
}: FieldInputProps) {
  const id = field.slug;
  const settings = (field.settings as Record<string, unknown>) ?? {};
  const options = (settings.options as string[]) ?? [];

  const str = defaultValue != null ? String(defaultValue) : "";
  const multiIds = Array.isArray(defaultValue)
    ? (defaultValue as string[]).filter(Boolean)
    : defaultValue != null && String(defaultValue)
      ? [String(defaultValue)]
      : [];

  switch (field.fieldType) {
    case "activity": {
      if (activityFieldPresentation === "sidebar") {
        return null;
      }
      const limit = getActivityPreviewLimit(field.settings);
      const rows = entityActivityRows.slice(0, limit);
      return (
        <div
          id={id}
          className="entity-activity-field-preview"
          style={{
            padding: "0.65rem 0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "6px",
            background: "#f8fafc",
            fontSize: "0.875rem",
          }}
        >
          {!entityId ? (
            <p style={{ margin: 0, color: "#64748b" }}>
              Activity will appear here after you save the new record.
            </p>
          ) : rows.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b" }}>No activity yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", listStyleType: "disc" }}>
              {rows.map((ev) => (
                <li key={ev.id} style={{ marginBottom: "0.35rem" }}>
                  <strong>{ev.eventType.replace(/_/g, " ")}</strong>
                  <span style={{ color: "#64748b" }}> · {ev.actorLabel}</span>
                  <span style={{ color: "#94a3b8", marginLeft: "0.35rem" }}>
                    {formatDateTime(ev.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    case "relation":
      return (
        <select
          id={id}
          name={field.slug}
          defaultValue={str}
          required={field.isRequired}
          onChange={onCommitValue ? (e) => onCommitValue(e.target.value, true) : undefined}
        >
          <option value="">Select...</option>
          {relationOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "relation-multi":
      return (
        <RelationMultiCombobox
          key={`${field.slug}-${entityId ?? "new"}`}
          fieldSlug={field.slug}
          fieldName={field.name}
          options={relationOptions}
          defaultValue={multiIds}
          onSelectionChange={onCommitValue ? (ids) => onCommitValue(ids, true) : undefined}
        />
      );
    case "boolean":
      return (
        <select
          id={id}
          name={field.slug}
          defaultValue={str || "false"}
          onChange={onCommitValue ? (e) => onCommitValue(e.target.value === "true", true) : undefined}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      );
    case "number":
      return (
        <input
          type="number"
          id={id}
          name={field.slug}
          defaultValue={str}
          required={field.isRequired}
          onBlur={onCommitValue ? (e) => onCommitValue(e.target.value, true) : undefined}
        />
      );
    case "date": {
      const dateInputValue = extractYyyyMmDdFromStoredValue(defaultValue);
      return (
        <input
          type="date"
          id={id}
          name={field.slug}
          defaultValue={dateInputValue}
          required={field.isRequired}
          onChange={onCommitValue ? (e) => onCommitValue(e.target.value, true) : undefined}
        />
      );
    }
    case "select":
      return (
        <select
          id={id}
          name={field.slug}
          defaultValue={str}
          required={field.isRequired}
          onChange={onCommitValue ? (e) => onCommitValue(e.target.value, true) : undefined}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "tenant-user":
      return (
        <select
          id={id}
          name={field.slug}
          defaultValue={str}
          required={field.isRequired}
          onChange={onCommitValue ? (e) => onCommitValue(e.target.value, true) : undefined}
        >
          <option value="">Select…</option>
          {tenantUserOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case "json":
      return (
        <textarea
          id={id}
          name={field.slug}
          defaultValue={str}
          required={field.isRequired}
          rows={4}
          onBlur={onCommitValue ? (e) => onCommitValue(e.target.value, true) : undefined}
        />
      );
    case "file":
      return (
        <BlobUploadInput
          name={field.slug}
          id={id}
          defaultValue={str}
          label=""
          placeholder="Paste image URL or upload below"
          required={field.isRequired}
          onValueChange={onCommitValue ? (v) => onCommitValue(v, true) : undefined}
        />
      );
    case "text":
    default:
      return (
        <input
          type="text"
          id={id}
          name={field.slug}
          defaultValue={str}
          required={field.isRequired}
          onBlur={onCommitValue ? (e) => onCommitValue(e.target.value, true) : undefined}
        />
      );
  }
}
