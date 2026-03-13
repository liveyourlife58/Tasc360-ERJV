"use client";

import { useActionState, useState, useCallback } from "react";

type FilterRow = { field: string; op: string; value: string };
type SortRow = { field: string; dir: "asc" | "desc" };

const FILTER_OPS = ["eq", "neq", "contains", "gt", "lt", "gte", "lte", "empty"] as const;
const SORT_DIRS = ["asc", "desc"] as const;

function parseFilter(initial: unknown[]): FilterRow[] {
  return initial.map((item) => {
    const o = item as Record<string, unknown>;
    return {
      field: typeof o?.field === "string" ? o.field : "",
      op: typeof o?.op === "string" && FILTER_OPS.includes(o.op as (typeof FILTER_OPS)[number]) ? (o.op as string) : "eq",
      value: typeof o?.value === "string" ? o.value : String(o?.value ?? ""),
    };
  });
}

function parseSort(initial: unknown[]): SortRow[] {
  return initial.map((item) => {
    const o = item as Record<string, unknown>;
    return {
      field: typeof o?.field === "string" ? o.field : "createdAt",
      dir: (o?.dir === "desc" ? "desc" : "asc") as "asc" | "desc",
    };
  });
}

export function EditViewForm({
  viewId,
  moduleSlug,
  initialName,
  initialColumns,
  initialViewType = "list",
  initialBoardColumnField,
  initialDateField,
  initialFilter = [],
  initialSort = [],
  fieldSlugs,
  selectFieldSlugs,
  dateFieldSlugs,
  action,
  deleteAction,
}: {
  viewId: string;
  moduleSlug: string;
  initialName: string;
  initialColumns: string[];
  initialViewType?: "list" | "board" | "calendar";
  initialBoardColumnField?: string | null;
  initialDateField?: string | null;
  initialFilter?: unknown[];
  initialSort?: unknown[];
  fieldSlugs: string[];
  selectFieldSlugs: string[];
  dateFieldSlugs: string[];
  action: (prev: unknown, formData: FormData) => Promise<unknown>;
  deleteAction: (prev: unknown, formData: FormData) => Promise<unknown>;
}) {
  const [state, formAction] = useActionState(action, null);
  const [, deleteFormAction] = useActionState(deleteAction, null);

  const [filters, setFilters] = useState<FilterRow[]>(() => parseFilter(initialFilter));
  const [sorts, setSorts] = useState<SortRow[]>(() => parseSort(initialSort));

  const addFilter = useCallback(() => {
    setFilters((prev) => [...prev, { field: fieldSlugs[0] ?? "createdAt", op: "eq", value: "" }]);
  }, [fieldSlugs]);
  const removeFilter = useCallback((i: number) => {
    setFilters((prev) => prev.filter((_, idx) => idx !== i));
  }, []);
  const updateFilter = useCallback((i: number, patch: Partial<FilterRow>) => {
    setFilters((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }, []);

  const addSort = useCallback(() => {
    setSorts((prev) => [...prev, { field: "createdAt", dir: "desc" as const }]);
  }, []);
  const removeSort = useCallback((i: number) => {
    setSorts((prev) => prev.filter((_, idx) => idx !== i));
  }, []);
  const updateSort = useCallback((i: number, patch: Partial<SortRow>) => {
    setSorts((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      const form = e.currentTarget;
      const filterJsonInput = form.querySelector<HTMLInputElement>('input[name="filterJson"]');
      const sortJsonInput = form.querySelector<HTMLInputElement>('input[name="sortJson"]');
      if (filterJsonInput) {
        filterJsonInput.value = JSON.stringify(
          filters.filter((f) => f.field.trim() !== "").map((f) => ({ field: f.field, op: f.op, value: f.value }))
        );
      }
      if (sortJsonInput) {
        sortJsonInput.value = JSON.stringify(
          sorts.filter((s) => s.field.trim() !== "").map((s) => ({ field: s.field, dir: s.dir }))
        );
      }
    },
    [filters, sorts]
  );

  const sortFields = ["createdAt", ...fieldSlugs];

  return (
    <div className="edit-view-form-wrap">
      <form action={formAction} className="settings-form" style={{ maxWidth: 560 }} onSubmit={handleSubmit}>
        <input type="hidden" name="filterJson" value="" />
        <input type="hidden" name="sortJson" value="" />
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
          <label htmlFor="viewType">View type</label>
          <select id="viewType" name="viewType" defaultValue={initialViewType}>
            <option value="list">List</option>
            <option value="board">Board (Kanban)</option>
            <option value="calendar">Calendar</option>
          </select>
          <span className="form-hint">Board groups by a select field; calendar shows entities by a date field.</span>
        </div>
        {selectFieldSlugs.length > 0 && (
          <div className="form-group">
            <label htmlFor="boardColumnField">Board column field (for Kanban)</label>
            <select id="boardColumnField" name="boardColumnField" defaultValue={initialBoardColumnField ?? ""}>
              <option value="">— None —</option>
              {selectFieldSlugs.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        {dateFieldSlugs.length > 0 && (
          <div className="form-group">
            <label htmlFor="dateField">Calendar date field</label>
            <select id="dateField" name="dateField" defaultValue={initialDateField ?? ""}>
              <option value="">— None —</option>
              {dateFieldSlugs.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}
        <div className="form-group">
          <label>Filters</label>
          <span className="form-hint">Show only records that match these conditions. Leave field empty to skip.</span>
          {filters.map((row, i) => (
            <div key={i} className="edit-view-filter-row" style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem", flexWrap: "wrap" }}>
              <select
                value={row.field}
                onChange={(e) => updateFilter(i, { field: e.target.value })}
                aria-label="Filter field"
              >
                <option value="createdAt">createdAt</option>
                {fieldSlugs.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={row.op}
                onChange={(e) => updateFilter(i, { op: e.target.value })}
                aria-label="Operator"
              >
                {FILTER_OPS.map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              <input
                type="text"
                value={row.value}
                onChange={(e) => updateFilter(i, { value: e.target.value })}
                placeholder="Value (empty for empty)"
                style={{ flex: "1", minWidth: 100 }}
                aria-label="Filter value"
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeFilter(i)} aria-label="Remove filter">Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "0.5rem" }} onClick={addFilter}>
            + Add filter
          </button>
        </div>
        <div className="form-group">
          <label>Sort</label>
          <span className="form-hint">Order records by these fields (first = primary).</span>
          {sorts.map((row, i) => (
            <div key={i} className="edit-view-sort-row" style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem", flexWrap: "wrap" }}>
              <select
                value={row.field}
                onChange={(e) => updateSort(i, { field: e.target.value })}
                aria-label="Sort field"
              >
                {sortFields.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={row.dir}
                onChange={(e) => updateSort(i, { dir: e.target.value as "asc" | "desc" })}
                aria-label="Direction"
              >
                {SORT_DIRS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeSort(i)} aria-label="Remove sort">Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "0.5rem" }} onClick={addSort}>
            + Add sort
          </button>
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
