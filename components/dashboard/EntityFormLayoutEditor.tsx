"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { EntityFormLayout, EntityFormPlacement } from "@/lib/entity-form-layout";
import {
  entityLayoutV1toV2,
  normalizeEntityFormLayoutV2,
} from "@/lib/entity-form-layout";

export type EntityFormLayoutEditorField = {
  id: string;
  slug: string;
  name: string;
  fieldType: string;
  sortOrder: number;
};

type Placement = EntityFormPlacement & { rowSpan: number; colSpan: number };

function resolveP(p: EntityFormPlacement): Placement {
  return {
    slug: p.slug,
    row: p.row,
    col: p.col,
    rowSpan: p.rowSpan ?? 1,
    colSpan: p.colSpan ?? 1,
  };
}

function covers(p: Placement, r: number, c: number): boolean {
  return r >= p.row && r < p.row + p.rowSpan && c >= p.col && c < p.col + p.colSpan;
}

function canPlaceRect(
  placements: Placement[],
  rows: number,
  cols: number,
  row: number,
  col: number,
  rs: number,
  cs: number,
  ignoreSlug: string | null
): boolean {
  if (row < 0 || col < 0 || row + rs > rows || col + cs > cols) return false;
  for (let dr = 0; dr < rs; dr++) {
    for (let dc = 0; dc < cs; dc++) {
      const rr = row + dr;
      const cc = col + dc;
      for (const p of placements) {
        if (p.slug === ignoreSlug) continue;
        if (covers(p, rr, cc)) return false;
      }
    }
  }
  return true;
}

function initialEditorState(
  fields: EntityFormLayoutEditorField[],
  initial: EntityFormLayout | null
): { gridRows: number; gridCols: number; placements: Placement[] } {
  if (!initial) {
    const cols = 3;
    const order = [...fields].sort((a, b) => a.sortOrder - b.sortOrder).map((f) => f.slug);
    const rows = Math.max(4, Math.ceil(order.length / cols));
    const placements: Placement[] = order.map((slug, i) => ({
      slug,
      row: Math.floor(i / cols),
      col: i % cols,
      rowSpan: 1,
      colSpan: 1,
    }));
    return { gridRows: rows, gridCols: cols, placements };
  }
  if (initial.version === 2) {
    const norm = normalizeEntityFormLayoutV2(fields, initial);
    return {
      gridRows: norm.rows,
      gridCols: norm.cols,
      placements: norm.placements.map(resolveP),
    };
  }
  const v2 = entityLayoutV1toV2(fields, initial);
  const norm = normalizeEntityFormLayoutV2(fields, v2);
  return {
    gridRows: norm.rows,
    gridCols: norm.cols,
    placements: norm.placements.map(resolveP),
  };
}

function maxSpanInDirection(
  placements: Placement[],
  rows: number,
  cols: number,
  slug: string,
  axis: "col" | "row"
): number {
  const p = placements.find((x) => x.slug === slug);
  if (!p) return 1;
  if (axis === "col") {
    let cs = p.colSpan;
    for (let tryCs = p.colSpan + 1; tryCs <= cols - p.col; tryCs++) {
      if (!canPlaceRect(placements, rows, cols, p.row, p.col, p.rowSpan, tryCs, slug)) break;
      cs = tryCs;
    }
    return cs;
  }
  let rs = p.rowSpan;
  for (let tryRs = p.rowSpan + 1; tryRs <= rows - p.row; tryRs++) {
    if (!canPlaceRect(placements, rows, cols, p.row, p.col, tryRs, p.colSpan, slug)) break;
    rs = tryRs;
  }
  return rs;
}

export function EntityFormLayoutEditor({
  moduleSlug,
  fields,
  initialLayout,
  saveAction,
  extraHiddenFields,
}: {
  moduleSlug: string;
  fields: EntityFormLayoutEditorField[];
  initialLayout: EntityFormLayout | null;
  saveAction: (formData: FormData) => Promise<void>;
  extraHiddenFields?: { name: string; value: string }[];
}) {
  const start = useMemo(() => initialEditorState(fields, initialLayout), [fields, initialLayout]);
  const [mode, setMode] = useState<"default" | "custom">(initialLayout ? "custom" : "default");
  const [gridRows, setGridRows] = useState(start.gridRows);
  const [gridCols, setGridCols] = useState(start.gridCols);
  const [placements, setPlacements] = useState<Placement[]>(start.placements);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [dragSlug, setDragSlug] = useState<string | null>(null);

  const fieldBySlug = useMemo(() => new Map(fields.map((f) => [f.slug, f])), [fields]);

  const applyNormalize = useCallback(
    (rows: number, cols: number, pl: Placement[]) => {
      const norm = normalizeEntityFormLayoutV2(fields, {
        version: 2,
        rows,
        cols,
        placements: pl.map((p) => {
          const o: EntityFormPlacement = { slug: p.slug, row: p.row, col: p.col };
          if (p.rowSpan !== 1) o.rowSpan = p.rowSpan;
          if (p.colSpan !== 1) o.colSpan = p.colSpan;
          return o;
        }),
      });
      setGridRows(norm.rows);
      setGridCols(norm.cols);
      setPlacements(norm.placements.map(resolveP));
    },
    [fields]
  );

  const layoutJsonPayload = useMemo(() => {
    if (mode !== "custom") return "";
    const norm = normalizeEntityFormLayoutV2(fields, {
      version: 2,
      rows: gridRows,
      cols: gridCols,
      placements: placements.map((p) => {
        const o: EntityFormPlacement = { slug: p.slug, row: p.row, col: p.col };
        if (p.rowSpan !== 1) o.rowSpan = p.rowSpan;
        if (p.colSpan !== 1) o.colSpan = p.colSpan;
        return o;
      }),
    });
    return JSON.stringify(norm);
  }, [mode, fields, gridRows, gridCols, placements]);

  const unplacedSlugs = useMemo(() => {
    const placed = new Set(placements.map((p) => p.slug));
    return fields.filter((f) => !placed.has(f.slug)).map((f) => f.slug);
  }, [fields, placements]);

  function movePlacementTo(slug: string, row: number, col: number) {
    const current = placements.find((p) => p.slug === slug);
    const rs = current?.rowSpan ?? 1;
    const cs = current?.colSpan ?? 1;
    const without = placements.filter((p) => p.slug !== slug);
    if (canPlaceRect(without, gridRows, gridCols, row, col, rs, cs, null)) {
      setPlacements([...without, { slug, row, col, rowSpan: rs, colSpan: cs }]);
      return;
    }
    if (canPlaceRect(without, gridRows, gridCols, row, col, 1, 1, null)) {
      setPlacements([...without, { slug, row, col, rowSpan: 1, colSpan: 1 }]);
    }
  }

  function removeFromGrid(slug: string) {
    setPlacements((prev) => prev.filter((p) => p.slug !== slug));
    if (selectedSlug === slug) setSelectedSlug(null);
  }

  function updateSpan(slug: string, rowSpan: number, colSpan: number) {
    const p = placements.find((x) => x.slug === slug);
    if (!p) return;
    const rs = Math.max(1, Math.min(rowSpan, gridRows - p.row));
    const cs = Math.max(1, Math.min(colSpan, gridCols - p.col));
    const without = placements.filter((x) => x.slug !== slug);
    if (canPlaceRect(without, gridRows, gridCols, p.row, p.col, rs, cs, null)) {
      setPlacements([...without, { slug, row: p.row, col: p.col, rowSpan: rs, colSpan: cs }]);
    }
  }

  const selected = selectedSlug ? placements.find((p) => p.slug === selectedSlug) : null;
  const maxColSpan = selected ? maxSpanInDirection(placements, gridRows, gridCols, selected.slug, "col") : 1;
  const maxRowSpan = selected ? maxSpanInDirection(placements, gridRows, gridCols, selected.slug, "row") : 1;

  const cells: ReactNode[] = [];
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const tl = placements.find((p) => p.row === r && p.col === c);
      const covered = placements.some((p) => covers(p, r, c));
      if (tl) {
        const f = fieldBySlug.get(tl.slug);
        if (!f) {
          cells.push(
            <div
              key={`orphan-${tl.slug}`}
              style={{
                gridRow: `${r + 1} / span ${tl.rowSpan}`,
                gridColumn: `${c + 1} / span ${tl.colSpan}`,
                padding: "0.35rem",
                fontSize: "0.75rem",
                color: "#94a3b8",
                border: "1px dashed #e2e8f0",
                borderRadius: 6,
              }}
            >
              Unknown field: {tl.slug}
            </div>
          );
          continue;
        }
        cells.push(
          <div
            key={`f-${tl.slug}`}
            className={`entity-form-layout-editor-field${selectedSlug === tl.slug ? " entity-form-layout-editor-field--selected" : ""}`}
            draggable
            onDragStart={() => setDragSlug(tl.slug)}
            onDragEnd={() => setDragSlug(null)}
            onClick={() => setSelectedSlug(tl.slug)}
            style={{
              gridRow: `${r + 1} / span ${tl.rowSpan}`,
              gridColumn: `${c + 1} / span ${tl.colSpan}`,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "0.45rem 0.55rem",
              background: selectedSlug === tl.slug ? "#e0f2fe" : "#fff",
              cursor: "grab",
              minHeight: 44,
              fontSize: "0.8125rem",
              color: "#334155",
            }}
          >
            <div style={{ fontWeight: 600 }}>{f.name}</div>
            <div style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
              {f.fieldType} · {tl.rowSpan}×{tl.colSpan}
            </div>
          </div>
        );
      } else if (!covered) {
        cells.push(
          <div
            key={`e-${r}-${c}`}
            className="entity-form-layout-editor-cell--empty"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragSlug) return;
              movePlacementTo(dragSlug, r, c);
              setDragSlug(null);
            }}
            style={{
              gridRow: r + 1,
              gridColumn: c + 1,
              border: "1px dashed #cbd5e1",
              borderRadius: 6,
              minHeight: 44,
              background: "#f8fafc",
            }}
          />
        );
      }
    }
  }

  return (
    <form action={saveAction} className="entity-form-layout-editor">
      {extraHiddenFields?.map(({ name, value }) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="moduleSlug" value={moduleSlug} />
      <input type="hidden" name="layoutMode" value={mode} />
      <input type="hidden" name="layoutJson" value={layoutJsonPayload} />

      <fieldset style={{ border: "none", padding: 0, margin: "0 0 1rem" }}>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#334155" }}>Layout mode</p>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", marginRight: "1.25rem" }}>
          <input
            type="radio"
            name="layoutModeRadio"
            checked={mode === "default"}
            onChange={() => setMode("default")}
          />
          Automatic (field list order from Manage fields)
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <input
            type="radio"
            name="layoutModeRadio"
            checked={mode === "custom"}
            onChange={() => setMode("custom")}
          />
          Custom grid (drag fields into cells)
        </label>
      </fieldset>

      {mode === "custom" && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem", alignItems: "flex-end" }}>
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 120 }}>
              <label htmlFor="entity-form-layout-rows">Rows</label>
              <input
                id="entity-form-layout-rows"
                type="number"
                min={1}
                max={24}
                value={gridRows}
                onChange={(e) => {
                  const v = clampIntInput(e.target.value, 1, 24, gridRows);
                  applyNormalize(v, gridCols, placements);
                }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 120 }}>
              <label htmlFor="entity-form-layout-cols">Columns</label>
              <input
                id="entity-form-layout-cols"
                type="number"
                min={1}
                max={12}
                value={gridCols}
                onChange={(e) => {
                  const v = clampIntInput(e.target.value, 1, 12, gridCols);
                  applyNormalize(gridRows, v, placements);
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const order = [...fields].sort((a, b) => a.sortOrder - b.sortOrder).map((f) => f.slug);
                const cols = gridCols;
                const rows = Math.max(1, Math.ceil(order.length / cols));
                const next: Placement[] = order.map((slug, i) => ({
                  slug,
                  row: Math.floor(i / cols),
                  col: i % cols,
                  rowSpan: 1,
                  colSpan: 1,
                }));
                applyNormalize(rows, cols, next);
              }}
            >
              Reset to row-major fill
            </button>
          </div>

          <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.75rem", maxWidth: 640 }}>
            Drag a field onto a dashed cell to move it. Empty cells stay blank on the form. Use span controls for the
            selected field so one control can cover multiple cells. Drag from the grid to{" "}
            <strong>Unplaced</strong> to remove a field from the grid (it will reappear in the strip). New fields are
            auto-placed when you save if they are missing from the layout.
          </p>

          {unplacedSlugs.length > 0 && (
            <div
              style={{
                marginBottom: "0.75rem",
                padding: "0.6rem 0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                background: "#fffbeb",
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragSlug) removeFromGrid(dragSlug);
                setDragSlug(null);
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#92400e", marginBottom: "0.35rem" }}>
                Unplaced — drop here to remove from grid
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {unplacedSlugs.map((slug) => {
                  const f = fieldBySlug.get(slug);
                  if (!f) return null;
                  return (
                    <button
                      key={slug}
                      type="button"
                      draggable
                      onDragStart={() => setDragSlug(slug)}
                      onDragEnd={() => setDragSlug(null)}
                      style={{
                        padding: "0.25rem 0.5rem",
                        fontSize: "0.8125rem",
                        border: "1px solid #fcd34d",
                        borderRadius: 6,
                        background: "#fff",
                        cursor: "grab",
                      }}
                    >
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selected && (
            <div
              style={{
                marginBottom: "0.75rem",
                padding: "0.6rem 0.75rem",
                border: "1px solid #bae6fd",
                borderRadius: 8,
                background: "#f0f9ff",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                alignItems: "flex-end",
              }}
            >
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0369a1" }}>
                Selected: {fieldBySlug.get(selected.slug)?.name ?? selected.slug}
              </span>
              <div className="form-group" style={{ marginBottom: 0, maxWidth: 100 }}>
                <label htmlFor="span-rows">Row span</label>
                <input
                  id="span-rows"
                  type="number"
                  min={1}
                  max={maxRowSpan}
                  value={selected.rowSpan}
                  onChange={(e) =>
                    updateSpan(selected.slug, clampIntInput(e.target.value, 1, maxRowSpan, selected.rowSpan), selected.colSpan)
                  }
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, maxWidth: 100 }}>
                <label htmlFor="span-cols">Column span</label>
                <input
                  id="span-cols"
                  type="number"
                  min={1}
                  max={maxColSpan}
                  value={selected.colSpan}
                  onChange={(e) =>
                    updateSpan(selected.slug, selected.rowSpan, clampIntInput(e.target.value, 1, maxColSpan, selected.colSpan))
                  }
                />
              </div>
            </div>
          )}

          <div
            className="entity-form-layout-editor-grid"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridRows}, minmax(48px, auto))`,
              gap: "0.5rem",
              maxWidth: 720,
              marginBottom: "1rem",
            }}
          >
            {cells}
          </div>
        </>
      )}

      <button type="submit" className="btn btn-primary">
        Save form layout
      </button>
    </form>
  );
}

function clampIntInput(raw: string, lo: number, hi: number, fallback: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}
