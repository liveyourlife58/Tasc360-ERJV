"use client";

import { useActionState, useState, useRef, useEffect } from "react";

type Field = {
  id: string;
  name: string;
  slug: string;
  fieldType: string;
  isRequired: boolean;
  settings: unknown;
};

type ActionResult = (prev: unknown, formData: FormData) => Promise<unknown>;

export type RelationOption = { id: string; label: string };

function RelationMultiCombobox({
  fieldSlug,
  fieldName,
  options,
  defaultValue,
}: {
  fieldSlug: string;
  fieldName: string;
  options: RelationOption[];
  defaultValue: string[];
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
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setQuery("");
  }

  function remove(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
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
  modulePaymentType = null,
  entityPaymentType = null,
  priceCents = null,
  suggestedDonationAmountCents = null,
  action,
}: {
  moduleSlug: string;
  moduleName: string;
  fields: Field[];
  initialData: Record<string, unknown>;
  entityId?: string;
  relationOptions?: Record<string, RelationOption[]>;
  /** When set, show "Payment for this record" override (use module default / none / payment / donation). */
  modulePaymentType?: "payment" | "donation" | null;
  entityPaymentType?: "payment" | "donation" | "none" | null;
  /** Price in cents (for payment type). Shown when module has payment/donation. */
  priceCents?: number | null;
  /** Suggested donation amount in cents. Shown when module has payment/donation. */
  suggestedDonationAmountCents?: number | null;
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

  return (
    <form action={formAction} style={{ maxWidth: 480 }}>
      {state && typeof state === "object" && "error" in state ? (
        <p className="view-error" role="alert" style={{ marginBottom: "1rem" }}>
          {(state as { error: string }).error}
        </p>
      ) : null}
      {entityId && <input type="hidden" name="entityId" value={entityId} />}
      {fields.map((field) => (
        <div key={field.id} className="form-group">
          <label htmlFor={field.slug}>
            {field.name}
            {field.isRequired && " *"}
          </label>
          <FieldInput
            field={field}
            defaultValue={initialData[field.slug]}
            relationOptions={relationOptions[field.slug]}
            entityId={entityId}
          />
        </div>
      ))}
      {modulePaymentType != null && (
        <>
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
        </>
      )}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button type="submit" className="btn btn-primary">
          {entityId ? "Save" : `Create ${moduleName.slice(0, -1)}`}
        </button>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  defaultValue,
  relationOptions = [],
  entityId,
}: {
  field: Field;
  defaultValue: unknown;
  relationOptions?: RelationOption[];
  entityId?: string;
}) {
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
    case "relation":
      return (
        <select id={id} name={field.slug} defaultValue={str} required={field.isRequired}>
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
        />
      );
    case "boolean":
      return (
        <select id={id} name={field.slug} defaultValue={str || "false"}>
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
        />
      );
    case "date":
      return (
        <input
          type="date"
          id={id}
          name={field.slug}
          defaultValue={str}
          required={field.isRequired}
        />
      );
    case "select":
      return (
        <select id={id} name={field.slug} defaultValue={str} required={field.isRequired}>
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
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
        />
      );
  }
}
