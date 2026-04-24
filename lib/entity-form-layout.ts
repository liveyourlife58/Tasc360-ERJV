/** Stored under `Module.settings.entityFormLayout`. */

export const ENTITY_FORM_LAYOUT_KEY = "entityFormLayout";

export type EntityFormLayoutV1 = {
  version: 1;
  columns: 2 | 3 | 4;
  /** Field slugs in display order (left-to-right, then next row). */
  order: string[];
};

export type EntityFormPlacement = {
  slug: string;
  /** 0-based top row */
  row: number;
  /** 0-based left column */
  col: number;
  rowSpan?: number;
  colSpan?: number;
};

export type EntityFormLayoutV2 = {
  version: 2;
  rows: number;
  cols: number;
  placements: EntityFormPlacement[];
};

export type EntityFormLayout = EntityFormLayoutV1 | EntityFormLayoutV2;

export type EntityFormLayoutFieldLike = { slug: string; sortOrder: number };

const MAX_GRID_ROWS = 24;
const MAX_GRID_COLS = 12;
const MAX_SPAN = 12;

function clampInt(n: unknown, lo: number, hi: number, fallback: number): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(lo, Math.min(hi, Math.floor(x)));
}

export function parseEntityFormLayoutV1(raw: Record<string, unknown>): EntityFormLayoutV1 | null {
  if (raw.version !== 1) return null;
  const colNum = Number(raw.columns);
  if (![2, 3, 4].includes(colNum)) return null;
  const order = raw.order;
  if (!Array.isArray(order) || !order.every((x) => typeof x === "string")) return null;
  return {
    version: 1,
    columns: colNum as 2 | 3 | 4,
    order: order.map((x) => String(x).trim()).filter((s) => s.length > 0),
  };
}

export function parseEntityFormLayoutV2(raw: Record<string, unknown>): EntityFormLayoutV2 | null {
  if (raw.version !== 2) return null;
  const rows = clampInt(raw.rows, 1, MAX_GRID_ROWS, 4);
  const cols = clampInt(raw.cols, 1, MAX_GRID_COLS, 3);
  const pl = raw.placements;
  if (!Array.isArray(pl)) return null;
  const placements: EntityFormPlacement[] = [];
  for (const item of pl) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.slug !== "string") continue;
    const slug = o.slug.trim();
    if (!slug) continue;
    placements.push({
      slug,
      row: clampInt(o.row, 0, MAX_GRID_ROWS - 1, 0),
      col: clampInt(o.col, 0, MAX_GRID_COLS - 1, 0),
      rowSpan: o.rowSpan != null ? clampInt(o.rowSpan, 1, MAX_SPAN, 1) : undefined,
      colSpan: o.colSpan != null ? clampInt(o.colSpan, 1, MAX_SPAN, 1) : undefined,
    });
  }
  return { version: 2, rows, cols, placements };
}

/** Reads `settings.entityFormLayout`: prefers v2, then v1. */
export function parseEntityFormLayout(settings: unknown): EntityFormLayout | null {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const raw = (settings as Record<string, unknown>)[ENTITY_FORM_LAYOUT_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const v2 = parseEntityFormLayoutV2(o);
  if (v2) return v2;
  return parseEntityFormLayoutV1(o);
}

/** Stable slug order: layout order (valid slugs only), then any missing fields by `sortOrder`. */
export function normalizeEntityFormLayoutOrder<T extends EntityFormLayoutFieldLike>(
  fields: T[],
  order: string[]
): string[] {
  const slugSet = new Set(fields.map((f) => f.slug));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of order) {
    if (!slugSet.has(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  const rest = [...fields]
    .filter((f) => !seen.has(f.slug))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => f.slug);
  return [...out, ...rest];
}

export function layoutOrderToFieldRows<T extends EntityFormLayoutFieldLike>(
  fields: T[],
  layout: EntityFormLayoutV1
): T[][] {
  const bySlug = new Map(fields.map((f) => [f.slug, f]));
  const orderedSlugs = normalizeEntityFormLayoutOrder(fields, layout.order);
  const ordered = orderedSlugs.map((s) => bySlug.get(s)).filter((f): f is T => f != null);
  const rows: T[][] = [];
  const n = layout.columns;
  for (let i = 0; i < ordered.length; i += n) {
    rows.push(ordered.slice(i, i + n));
  }
  return rows;
}

/** Migrate v1 row-major layout to a v2 placement grid. */
export function entityLayoutV1toV2<T extends EntityFormLayoutFieldLike>(fields: T[], v1: EntityFormLayoutV1): EntityFormLayoutV2 {
  const order = normalizeEntityFormLayoutOrder(fields, v1.order);
  const cols = v1.columns;
  const rows = Math.max(1, Math.ceil(order.length / cols));
  const placements: EntityFormPlacement[] = order.map((slug, i) => ({
    slug,
    row: Math.floor(i / cols),
    col: i % cols,
    rowSpan: 1,
    colSpan: 1,
  }));
  return { version: 2, rows, cols, placements };
}

type PlacementResolved = EntityFormPlacement & { rowSpan: number; colSpan: number };

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

/**
 * Resolves overlaps (first placement in array wins; later ones shrink or skip),
 * ensures every field has a cell, expands `rows` if needed to fit orphans.
 */
export function normalizeEntityFormLayoutV2<T extends EntityFormLayoutFieldLike>(
  fields: T[],
  raw: EntityFormLayoutV2
): EntityFormLayoutV2 {
  const slugSet = new Set(fields.map((f) => f.slug));
  let rows = clampInt(raw.rows, 1, MAX_GRID_ROWS, 4);
  let cols = clampInt(raw.cols, 1, MAX_GRID_COLS, 3);

  const occupied = new Set<string>();

  function isFree(r: number, c: number, rs: number, cs: number): boolean {
    for (let dr = 0; dr < rs; dr++) {
      for (let dc = 0; dc < cs; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= rows || cc >= cols) return false;
        if (occupied.has(cellKey(rr, cc))) return false;
      }
    }
    return true;
  }

  function mark(r: number, c: number, rs: number, cs: number, on: boolean) {
    for (let dr = 0; dr < rs; dr++) {
      for (let dc = 0; dc < cs; dc++) {
        const k = cellKey(r + dr, c + dc);
        if (on) occupied.add(k);
        else occupied.delete(k);
      }
    }
  }

  const out: PlacementResolved[] = [];
  const seen = new Set<string>();

  const candidates = (raw.placements ?? []).filter((p) => slugSet.has(p.slug));
  for (const p of candidates) {
    if (seen.has(p.slug)) continue;
    let rs = clampInt(p.rowSpan ?? 1, 1, MAX_SPAN, 1);
    let cs = clampInt(p.colSpan ?? 1, 1, MAX_SPAN, 1);
    let r = clampInt(p.row, 0, rows - 1, 0);
    let c = clampInt(p.col, 0, cols - 1, 0);
    rs = Math.min(rs, rows - r);
    cs = Math.min(cs, cols - c);
    if (rs < 1 || cs < 1) continue;

    while (!isFree(r, c, rs, cs) && (rs > 1 || cs > 1)) {
      if (cs > 1) cs--;
      else if (rs > 1) rs--;
    }
    if (!isFree(r, c, rs, cs)) {
      rs = 1;
      cs = 1;
      if (!isFree(r, c, 1, 1)) continue;
    }
    mark(r, c, rs, cs, true);
    seen.add(p.slug);
    out.push({ slug: p.slug, row: r, col: c, rowSpan: rs, colSpan: cs });
  }

  const missingFields = [...fields].filter((f) => !seen.has(f.slug)).sort((a, b) => a.sortOrder - b.sortOrder);

  for (const f of missingFields) {
    let placed = false;
    let attempts = 0;
    outer: while (!placed && attempts++ < 64) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (isFree(r, c, 1, 1)) {
            mark(r, c, 1, 1, true);
            out.push({ slug: f.slug, row: r, col: c, rowSpan: 1, colSpan: 1 });
            seen.add(f.slug);
            placed = true;
            break outer;
          }
        }
      }
      if (!placed) {
        if (rows >= MAX_GRID_ROWS) break outer;
        rows++;
      }
    }
  }

  const bottom = out.reduce((m, p) => Math.max(m, p.row + p.rowSpan), 0);
  rows = Math.min(MAX_GRID_ROWS, Math.max(rows, bottom, clampInt(raw.rows, 1, MAX_GRID_ROWS, 1)));

  const placements: EntityFormPlacement[] = out.map((p) => {
    const base: EntityFormPlacement = { slug: p.slug, row: p.row, col: p.col };
    if (p.rowSpan !== 1) base.rowSpan = p.rowSpan;
    if (p.colSpan !== 1) base.colSpan = p.colSpan;
    return base;
  });

  return { version: 2, rows, cols, placements };
}

export function mergeEntityFormLayoutIntoModuleSettings(
  prev: Record<string, unknown> | null,
  layout: EntityFormLayout | null
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {}) };
  if (layout == null) {
    delete next[ENTITY_FORM_LAYOUT_KEY];
    return next;
  }
  next[ENTITY_FORM_LAYOUT_KEY] = layout;
  return next;
}

export type EntityFormRenderPlan<T extends EntityFormLayoutFieldLike = EntityFormLayoutFieldLike> =
  | { kind: "sort-order"; fields: T[] }
  | { kind: "custom-grid"; columns: 2 | 3 | 4; rows: T[][] }
  | {
      kind: "custom-placement-grid";
      rows: number;
      cols: number;
      items: { field: T; row: number; col: number; rowSpan: number; colSpan: number }[];
    };

export function getEntityFormRenderPlan<T extends EntityFormLayoutFieldLike>(
  fields: T[],
  layout: EntityFormLayout | null
): EntityFormRenderPlan<T> {
  if (!layout) {
    const ordered = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);
    return { kind: "sort-order", fields: ordered };
  }
  if (layout.version === 2) {
    const norm = normalizeEntityFormLayoutV2(fields, layout);
    const bySlug = new Map(fields.map((f) => [f.slug, f]));
    const items = norm.placements
      .map((p) => {
        const field = bySlug.get(p.slug);
        if (!field) return null;
        const rowSpan = p.rowSpan ?? 1;
        const colSpan = p.colSpan ?? 1;
        return { field, row: p.row, col: p.col, rowSpan, colSpan };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    return { kind: "custom-placement-grid", rows: norm.rows, cols: norm.cols, items };
  }
  return {
    kind: "custom-grid",
    columns: layout.columns,
    rows: layoutOrderToFieldRows(fields, layout),
  };
}

/** Parse `layoutJson` body from the layout editor (v2 only). */
export function parseLayoutJsonFromForm(layoutJson: string): EntityFormLayoutV2 | null {
  const trimmed = layoutJson?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parseEntityFormLayoutV2(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}
