"use client";

import { useActionState, useState, useCallback, useMemo } from "react";
import type { BoardLaneSource } from "@/components/dashboard/EntityBoard";

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

function parseBoardLaneSource(v: string | undefined | null): BoardLaneSource {
  if (v === "all_options" || v === "custom") return v;
  return "data";
}

function orderedLaneValuesForField(
  fieldSlug: string,
  selectMeta: { slug: string; options: string[] }[],
  relationMeta: { slug: string; options: { id: string; label: string }[] }[],
  tenantUserMeta: { slug: string; options: { id: string; label: string }[] }[]
): string[] {
  const rel = relationMeta.find((m) => m.slug === fieldSlug);
  if (rel) return rel.options.map((o) => o.id);
  const tu = tenantUserMeta.find((m) => m.slug === fieldSlug);
  if (tu) return tu.options.map((o) => o.id);
  const sel = selectMeta.find((m) => m.slug === fieldSlug);
  if (sel) return sel.options;
  return [];
}

/** Keep saved custom column order; drop ids no longer in the option catalog. */
function filterPickedToAllowedOrder(picked: string[] | undefined, allowedOrdered: string[]): string[] {
  if (!picked?.length) return [];
  const allowed = new Set(allowedOrdered);
  return picked.filter((v) => allowed.has(v));
}

export function EditViewForm({
  viewId,
  moduleSlug,
  initialName,
  initialColumns,
  initialViewType = "list",
  initialBoardColumnField,
  initialBoardLaneSource,
  initialBoardLaneValues,
  initialDateField,
  initialFilter = [],
  initialSort = [],
  fieldSlugs,
  selectFieldSlugs,
  selectFieldsMeta = [],
  relationFieldSlugs = [],
  relationFieldsMeta = [],
  tenantUserFieldSlugs = [],
  tenantUserFieldsMeta = [],
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
  initialBoardLaneSource?: string | null;
  initialBoardLaneValues?: string[] | null;
  initialDateField?: string | null;
  initialFilter?: unknown[];
  initialSort?: unknown[];
  fieldSlugs: string[];
  selectFieldSlugs: string[];
  /** Select fields with option lists (for board lane configuration). */
  selectFieldsMeta?: { slug: string; name: string; options: string[] }[];
  relationFieldSlugs?: string[];
  /** Single relation fields with loaded target rows (ids + labels). */
  relationFieldsMeta?: { slug: string; name: string; options: { id: string; label: string }[] }[];
  tenantUserFieldSlugs?: string[];
  tenantUserFieldsMeta?: { slug: string; name: string; options: { id: string; label: string }[] }[];
  dateFieldSlugs: string[];
  action: (prev: unknown, formData: FormData) => Promise<unknown>;
  deleteAction: (prev: unknown, formData: FormData) => Promise<unknown>;
}) {
  const [state, formAction] = useActionState(action, null);
  const [, deleteFormAction] = useActionState(deleteAction, null);

  const [filters, setFilters] = useState<FilterRow[]>(() => parseFilter(initialFilter));
  const [sorts, setSorts] = useState<SortRow[]>(() => parseSort(initialSort));

  const [viewTypeSt, setViewTypeSt] = useState<"list" | "board" | "calendar">(
    initialViewType === "board" || initialViewType === "calendar" ? initialViewType : "list"
  );
  const [boardFieldSt, setBoardFieldSt] = useState(initialBoardColumnField ?? "");
  const [laneSourceSt, setLaneSourceSt] = useState<BoardLaneSource>(() =>
    parseBoardLaneSource(initialBoardLaneSource ?? undefined)
  );
  const [customPicked, setCustomPicked] = useState<string[]>(() =>
    filterPickedToAllowedOrder(
      initialBoardLaneValues ?? undefined,
      orderedLaneValuesForField(
        initialBoardColumnField ?? "",
        selectFieldsMeta,
        relationFieldsMeta,
        tenantUserFieldsMeta
      )
    )
  );

  const laneOptions = useMemo((): { value: string; label: string }[] => {
    const rel = relationFieldsMeta.find((m) => m.slug === boardFieldSt);
    if (rel) return rel.options.map((o) => ({ value: o.id, label: o.label }));
    const tu = tenantUserFieldsMeta.find((m) => m.slug === boardFieldSt);
    if (tu) return tu.options.map((o) => ({ value: o.id, label: o.label }));
    const sel = selectFieldsMeta.find((m) => m.slug === boardFieldSt);
    if (sel) return sel.options.map((o) => ({ value: o, label: o }));
    return [];
  }, [selectFieldsMeta, relationFieldsMeta, tenantUserFieldsMeta, boardFieldSt]);

  const boardFieldIsRelation = relationFieldSlugs.includes(boardFieldSt);
  const boardFieldIsTenantUser = tenantUserFieldSlugs.includes(boardFieldSt);

  const moveCustomPicked = useCallback((index: number, dir: -1 | 1) => {
    setCustomPicked((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }, []);

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
          <select
            id="viewType"
            name="viewType"
            value={viewTypeSt}
            onChange={(e) => setViewTypeSt(e.target.value as "list" | "board" | "calendar")}
          >
            <option value="list">List</option>
            <option value="board">Board (Kanban)</option>
            <option value="calendar">Calendar</option>
          </select>
          <span className="form-hint">
            Board groups by a select field, a team user field, or a single relation; calendar shows entities by a date field.
          </span>
        </div>
        {(selectFieldSlugs.length > 0 || relationFieldSlugs.length > 0 || tenantUserFieldSlugs.length > 0) && (
          <div className="form-group">
            <label htmlFor="boardColumnField">Board column field (for Kanban)</label>
            <select
              id="boardColumnField"
              name="boardColumnField"
              value={boardFieldSt}
              onChange={(e) => {
                const v = e.target.value;
                setBoardFieldSt(v);
                setLaneSourceSt("data");
                setCustomPicked([]);
              }}
            >
              <option value="">— None —</option>
              {selectFieldSlugs.length > 0 && (
                <optgroup label="Select fields">
                  {selectFieldSlugs.map((s) => {
                    const name = selectFieldsMeta.find((m) => m.slug === s)?.name ?? s;
                    return (
                      <option key={`sel:${s}`} value={s}>
                        {name} ({s})
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {relationFieldSlugs.length > 0 && (
                <optgroup label="Relation fields (single)">
                  {relationFieldSlugs.map((s) => {
                    const name = relationFieldsMeta.find((m) => m.slug === s)?.name ?? s;
                    return (
                      <option key={`rel:${s}`} value={s}>
                        {name} ({s})
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {tenantUserFieldSlugs.length > 0 && (
                <optgroup label="Team user fields">
                  {tenantUserFieldSlugs.map((s) => {
                    const name = tenantUserFieldsMeta.find((m) => m.slug === s)?.name ?? s;
                    return (
                      <option key={`tu:${s}`} value={s}>
                        {name} ({s})
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </div>
        )}
        {viewTypeSt === "board" && boardFieldSt && (
          <div className="form-group">
            <span className="form-label-text">Board columns</span>
            <span className="form-hint" style={{ display: "block", marginBottom: "0.5rem" }}>
              The unassigned lane (—) still appears only when at least one record has no value for this field.
            </span>
            {laneOptions.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
                {boardFieldIsRelation
                  ? "No related records in the loaded list (up to 200 per target module). Columns follow values that appear on records."
                  : boardFieldIsTenantUser
                    ? "No active team members in this workspace. Columns follow values that appear on records."
                    : "This field has no select options defined. Columns are derived from values that appear on records."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label className="subscription-check-label" style={{ fontWeight: 400 }}>
                  <input
                    type="radio"
                    name="boardLaneSourceUi"
                    checked={laneSourceSt === "data"}
                    onChange={() => setLaneSourceSt("data")}
                  />
                  Only columns that have at least one card (default)
                </label>
                <label className="subscription-check-label" style={{ fontWeight: 400 }}>
                  <input
                    type="radio"
                    name="boardLaneSourceUi"
                    checked={laneSourceSt === "all_options"}
                    onChange={() => setLaneSourceSt("all_options")}
                  />
                  {boardFieldIsRelation
                    ? "Always show every related record in the loaded list (up to 200; empty lanes stay visible)"
                    : boardFieldIsTenantUser
                      ? "Always show every active team member (empty lanes stay visible)"
                      : "Always show every select option (empty lanes stay visible)"}
                </label>
                <label className="subscription-check-label" style={{ fontWeight: 400 }}>
                  <input
                    type="radio"
                    name="boardLaneSourceUi"
                    checked={laneSourceSt === "custom"}
                    onChange={() => {
                      setLaneSourceSt("custom");
                      setCustomPicked((prev) => {
                        if (prev.length > 0) return prev;
                        return laneOptions.map((o) => o.value);
                      });
                    }}
                  />
                  {boardFieldIsRelation
                    ? "Choose which related records appear as columns — order is the list below (reorder with ↑ ↓)"
                    : boardFieldIsTenantUser
                      ? "Choose which team members appear as columns — order is the list below (reorder with ↑ ↓)"
                      : "Choose which options appear as columns — order is the list below (reorder with ↑ ↓)"}
                </label>
                {laneSourceSt === "custom" && (
                  <div
                    style={{
                      marginLeft: "1.5rem",
                      padding: "0.5rem 0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.35rem",
                    }}
                  >
                    <span className="form-hint" style={{ display: "block", marginBottom: "0.25rem" }}>
                      Checked columns appear left to right in this order. New checks are added at the bottom; use ↑ ↓ to change order.
                    </span>
                    {customPicked.map((value, idx) => {
                      const opt = laneOptions.find((o) => o.value === value);
                      const label = opt?.label ?? value;
                      return (
                        <div
                          key={value}
                          style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}
                        >
                          <label className="subscription-check-label" style={{ fontWeight: 400, flex: "1", minWidth: 120 }}>
                            <input
                              type="checkbox"
                              checked
                              onChange={() => {
                                setCustomPicked((prev) => prev.filter((x) => x !== value));
                              }}
                            />
                            {label}
                          </label>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={idx === 0}
                            onClick={() => moveCustomPicked(idx, -1)}
                            aria-label="Move column up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={idx === customPicked.length - 1}
                            onClick={() => moveCustomPicked(idx, 1)}
                            aria-label="Move column down"
                          >
                            ↓
                          </button>
                        </div>
                      );
                    })}
                    {laneOptions
                      .filter((o) => !customPicked.includes(o.value))
                      .map((opt) => (
                        <label key={opt.value} className="subscription-check-label" style={{ fontWeight: 400 }}>
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => {
                              setCustomPicked((prev) => [...prev, opt.value]);
                            }}
                          />
                          {opt.label}
                        </label>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <input
          type="hidden"
          name="boardLaneSource"
          value={viewTypeSt === "board" && boardFieldSt ? laneSourceSt : "data"}
        />
        <input
          type="hidden"
          name="boardLaneValuesJson"
          value={
            viewTypeSt === "board" && boardFieldSt && laneSourceSt === "custom"
              ? JSON.stringify(customPicked)
              : ""
          }
        />
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
