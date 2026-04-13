"use client";

import { useActionState, useState, useCallback, useMemo, useEffect } from "react";
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

function buildBoardCardOptions(
  moduleFieldsMeta: { slug: string; name: string }[] | undefined,
  fieldSlugs: string[]
): { slug: string; name: string }[] {
  if (moduleFieldsMeta && moduleFieldsMeta.length > 0) return moduleFieldsMeta;
  return fieldSlugs.map((slug) => ({ slug, name: slug }));
}

function buildInitialBoardCardLabelSlugs(
  initialLabelSlugs: string[] | undefined,
  legacyShowAll: boolean,
  cardSlugs: string[],
  allowed: string[]
): string[] {
  const allowedSet = new Set(allowed);
  if (initialLabelSlugs && initialLabelSlugs.length > 0) {
    return initialLabelSlugs.filter(
      (s) => allowedSet.has(s) && (cardSlugs.length === 0 || cardSlugs.includes(s))
    );
  }
  if (legacyShowAll && cardSlugs.length > 0) {
    return cardSlugs.filter((s) => allowedSet.has(s));
  }
  return [];
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
  initialBoardCardFieldSlugs = [],
  initialBoardCardLabelFieldSlugs,
  initialBoardCardShowLabels = false,
  initialDateField,
  initialFilter = [],
  initialSort = [],
  fieldSlugs,
  moduleFieldsMeta,
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
  /** Field slugs to show on each Kanban card (in order); empty = first field in module order only. */
  initialBoardCardFieldSlugs?: string[];
  /** Which of those slugs show a “Field name:” prefix (saved on the view). */
  initialBoardCardLabelFieldSlugs?: string[];
  /** Legacy: when no per-field list, all card lines showed names. Used only for initial state. */
  initialBoardCardShowLabels?: boolean;
  initialDateField?: string | null;
  initialFilter?: unknown[];
  initialSort?: unknown[];
  fieldSlugs: string[];
  /** Full module fields for Kanban card picker (order matches Manage fields). Falls back to slugs only. */
  moduleFieldsMeta?: { slug: string; name: string }[];
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

  const boardCardOptions = useMemo(
    () => buildBoardCardOptions(moduleFieldsMeta, fieldSlugs),
    [moduleFieldsMeta, fieldSlugs]
  );
  const [boardCardPicked, setBoardCardPicked] = useState<string[]>(() =>
    filterPickedToAllowedOrder(
      initialBoardCardFieldSlugs,
      buildBoardCardOptions(moduleFieldsMeta, fieldSlugs).map((o) => o.slug)
    )
  );

  const [boardCardLabelSlugs, setBoardCardLabelSlugs] = useState<string[]>(() =>
    buildInitialBoardCardLabelSlugs(
      initialBoardCardLabelFieldSlugs,
      initialBoardCardShowLabels,
      filterPickedToAllowedOrder(
        initialBoardCardFieldSlugs,
        buildBoardCardOptions(moduleFieldsMeta, fieldSlugs).map((o) => o.slug)
      ),
      buildBoardCardOptions(moduleFieldsMeta, fieldSlugs).map((o) => o.slug)
    )
  );

  const [defaultTitleShowLabel, setDefaultTitleShowLabel] = useState(
    () => initialBoardCardFieldSlugs.length === 0 && initialBoardCardShowLabels === true
  );

  useEffect(() => {
    if (boardCardPicked.length > 0) setDefaultTitleShowLabel(false);
  }, [boardCardPicked.length]);

  const boardCardLabelHidden = useMemo(() => {
    if (boardCardPicked.length > 0) {
      return boardCardLabelSlugs.filter((s) => boardCardPicked.includes(s)).join(", ");
    }
    const first = boardCardOptions[0]?.slug;
    if (defaultTitleShowLabel && first) return first;
    return "";
  }, [boardCardPicked, boardCardLabelSlugs, defaultTitleShowLabel, boardCardOptions]);

  const toggleBoardCardSlug = useCallback((slug: string) => {
    setBoardCardPicked((prev) => {
      if (prev.includes(slug)) {
        setBoardCardLabelSlugs((ls) => ls.filter((s) => s !== slug));
        return prev.filter((s) => s !== slug);
      }
      return [...prev, slug];
    });
  }, []);

  const toggleBoardCardLabelSlug = useCallback((slug: string) => {
    setBoardCardLabelSlugs((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      return [...prev, slug];
    });
  }, []);

  const moveBoardCardSlug = useCallback((slug: string, dir: -1 | 1) => {
    setBoardCardPicked((prev) => {
      const i = prev.indexOf(slug);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
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
      <form action={formAction} className="settings-form edit-view-form" onSubmit={handleSubmit}>
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
          <fieldset className="board-columns-fieldset">
            <legend className="board-columns-legend">Board columns</legend>
            <p className="form-hint board-columns-intro">
              The board reads values from the field above. The <strong>—</strong> (unassigned) lane appears only when at least one record has no value for that field.
            </p>
            {laneOptions.length === 0 ? (
              <p className="board-columns-empty">
                {boardFieldIsRelation
                  ? "No related records in the loaded list (up to 200 per target module). Columns follow values that appear on records."
                  : boardFieldIsTenantUser
                    ? "No active team members in this workspace. Columns follow values that appear on records."
                    : "This field has no select options defined. Columns are derived from values that appear on records."}
              </p>
            ) : (
              <div className="board-lane-mode-list">
                <label className="board-lane-mode-option">
                  <input
                    type="radio"
                    name="boardLaneSourceUi"
                    checked={laneSourceSt === "data"}
                    onChange={() => setLaneSourceSt("data")}
                  />
                  <span className="board-lane-mode-body">
                    <span className="board-lane-mode-title">Cards only (default)</span>
                    <span className="board-lane-mode-desc">Show a lane only when at least one card uses that value.</span>
                  </span>
                </label>
                <label className="board-lane-mode-option">
                  <input
                    type="radio"
                    name="boardLaneSourceUi"
                    checked={laneSourceSt === "all_options"}
                    onChange={() => setLaneSourceSt("all_options")}
                  />
                  <span className="board-lane-mode-body">
                    <span className="board-lane-mode-title">All values</span>
                    <span className="board-lane-mode-desc">
                      {boardFieldIsRelation
                        ? "Show every related record from the loaded list (up to 200). Empty lanes stay visible."
                        : boardFieldIsTenantUser
                          ? "Show every active team member as a lane. Empty lanes stay visible."
                          : "Show every select option as a lane. Empty lanes stay visible."}
                    </span>
                  </span>
                </label>
                <label className="board-lane-mode-option">
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
                  <span className="board-lane-mode-body">
                    <span className="board-lane-mode-title">Custom</span>
                    <span className="board-lane-mode-desc">
                      Pick which values appear as lanes and set left-to-right order below.
                    </span>
                  </span>
                </label>
                {laneSourceSt === "custom" && (
                  <div className="board-lane-custom">
                    <div className="board-lane-custom-columns">
                      <div className="board-lane-custom-heading">Lanes on the board (left → right)</div>
                      {customPicked.length === 0 && (
                        <p className="form-hint board-lane-empty-msg">
                          No lanes yet. Add values from <strong>Not on the board</strong> below.
                        </p>
                      )}
                      <ul className="board-lane-ordered-list" aria-label="Column order">
                        {customPicked.map((value, idx) => {
                          const opt = laneOptions.find((o) => o.value === value);
                          const label = opt?.label ?? value;
                          return (
                            <li key={value} className="board-lane-ordered-row">
                              <span className="board-lane-order-badge" aria-hidden>
                                {idx + 1}
                              </span>
                              <span className="board-lane-order-label">{label}</span>
                              <span className="board-lane-order-actions">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled={idx === 0}
                                  onClick={() => moveCustomPicked(idx, -1)}
                                  aria-label="Move lane left"
                                >
                                  ←
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled={idx === customPicked.length - 1}
                                  onClick={() => moveCustomPicked(idx, 1)}
                                  aria-label="Move lane right"
                                >
                                  →
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm board-lane-remove-btn"
                                  onClick={() => {
                                    setCustomPicked((prev) => prev.filter((x) => x !== value));
                                  }}
                                  aria-label={`Remove ${label} from board`}
                                >
                                  Remove
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    {laneOptions.some((o) => !customPicked.includes(o.value)) && (
                      <div className="board-lane-custom-available">
                        <div className="board-lane-custom-heading">Not on the board</div>
                        <p className="form-hint board-lane-available-hint">Turn on a value to add it at the end of the row; use Move or Remove to adjust.</p>
                        <ul className="board-lane-available-list">
                          {laneOptions
                            .filter((o) => !customPicked.includes(o.value))
                            .map((opt) => (
                              <li key={opt.value}>
                                <label className="board-lane-available-item">
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    onChange={() => {
                                      setCustomPicked((prev) => [...prev, opt.value]);
                                    }}
                                  />
                                  <span>{opt.label}</span>
                                </label>
                              </li>
                            ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </fieldset>
        )}
        {viewTypeSt === "board" && (
          <fieldset className="board-card-fields-fieldset">
            <legend className="board-card-fields-legend">Kanban cards</legend>
            <input type="hidden" name="boardCardFields" value={boardCardPicked.join(", ")} />
            <input type="hidden" name="boardCardLabelFields" value={boardCardLabelHidden} />
            <p className="form-hint board-card-fields-intro">
              Tap fields to put them on each card. <strong>Selected</strong> fields are highlighted; the number is line order (top = title link). Use ↑ ↓ to reorder.
              For selected fields, turn <strong>Label</strong> on to show “Field name:” before the value. Leave none selected to use only the{" "}
              <strong>first field</strong> from <strong>Manage fields</strong>.
            </p>
            {boardCardOptions.length > 0 && boardCardPicked.length === 0 && (
              <label className="board-card-default-title-label">
                <input
                  type="checkbox"
                  checked={defaultTitleShowLabel}
                  onChange={(e) => setDefaultTitleShowLabel(e.target.checked)}
                />
                <span>
                  Show field name on the default card title ({boardCardOptions[0]?.name})
                </span>
              </label>
            )}
            {boardCardOptions.length > 0 ? (
              <div
                className="board-card-field-grid"
                role="group"
                aria-label="Fields shown on Kanban cards"
              >
                {boardCardOptions.map((o) => {
                  const selected = boardCardPicked.includes(o.slug);
                  const order = selected ? boardCardPicked.indexOf(o.slug) + 1 : 0;
                  const pos = selected ? boardCardPicked.indexOf(o.slug) : -1;
                  const showLabel = boardCardLabelSlugs.includes(o.slug);
                  return (
                    <div key={o.slug} className="board-card-field-chip-wrap">
                      <button
                        type="button"
                        className={`board-card-field-chip${selected ? " board-card-field-chip--selected" : ""}`}
                        onClick={() => toggleBoardCardSlug(o.slug)}
                        aria-pressed={selected}
                      >
                        {selected && (
                          <span className="board-card-field-chip-order" aria-hidden>
                            {order}
                          </span>
                        )}
                        <span className="board-card-field-chip-body">
                          <span className="board-card-field-chip-name">{o.name}</span>
                          <code className="board-card-field-chip-slug">{o.slug}</code>
                        </span>
                      </button>
                      {selected && (
                        <div className="board-card-field-chip-side">
                          <div className="board-card-field-chip-reorder">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm board-card-field-reorder-btn"
                              disabled={pos <= 0}
                              onClick={() => moveBoardCardSlug(o.slug, -1)}
                              aria-label={`Move ${o.name} up`}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm board-card-field-reorder-btn"
                              disabled={pos < 0 || pos >= boardCardPicked.length - 1}
                              onClick={() => moveBoardCardSlug(o.slug, 1)}
                              aria-label={`Move ${o.name} down`}
                            >
                              ↓
                            </button>
                          </div>
                          <label className="board-card-field-label-toggle">
                            <input
                              type="checkbox"
                              checked={showLabel}
                              onChange={() => toggleBoardCardLabelSlug(o.slug)}
                            />
                            <span>Label</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="form-hint board-card-fields-empty">No fields in this module.</p>
            )}
          </fieldset>
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
