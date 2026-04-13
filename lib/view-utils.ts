/**
 * Apply view filter/sort/columns to entities in memory.
 * Prisma JSONB filtering is limited; we fetch then filter/sort in JS.
 */

export type FilterCondition = {
  field: string;
  op: "eq" | "neq" | "contains" | "gt" | "lt" | "gte" | "lte" | "empty";
  value: unknown;
};

export type SortSpec = { field: string; dir: "asc" | "desc" };

export type ViewConfig = {
  filter?: FilterCondition[] | Record<string, unknown>;
  sort?: SortSpec[] | unknown;
  columns?: string[] | unknown;
};

export function getEntitySortValue(
  entity: { id: string; data: unknown; createdAt?: Date },
  field: string
): unknown {
  if (field === "createdAt" && "createdAt" in entity) {
    return entity.createdAt;
  }
  const data = (entity.data as Record<string, unknown>) ?? {};
  return data[field];
}

/** Compare two cell values for list / view sorting (nulls last). */
export function compareSortValues(av: unknown, bv: unknown): number {
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (typeof av === "string" && typeof bv === "string") {
    return av.localeCompare(bv);
  }
  if (typeof av === "number" && typeof bv === "number") {
    return av - bv;
  }
  if (av instanceof Date && bv instanceof Date) {
    return av.getTime() - bv.getTime();
  }
  return String(av).localeCompare(String(bv));
}

function finiteNumberFromUnknown(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function matchesCondition(
  value: unknown,
  op: string,
  condValue: unknown
): boolean {
  if (op === "empty") {
    return value == null || value === "";
  }
  if (typeof value === "string" && typeof condValue === "string") {
    if (op === "contains") return value.toLowerCase().includes(condValue.toLowerCase());
  }
  const nv = finiteNumberFromUnknown(value);
  const cvn = finiteNumberFromUnknown(condValue);
  if (nv !== null && cvn !== null) {
    if (op === "eq") return nv === cvn;
    if (op === "neq") return nv !== cvn;
    if (op === "gt") return nv > cvn;
    if (op === "gte") return nv >= cvn;
    if (op === "lt") return nv < cvn;
    if (op === "lte") return nv <= cvn;
  }
  if (typeof value === "number" && typeof condValue === "number") {
    if (op === "gt") return value > condValue;
    if (op === "gte") return value >= condValue;
    if (op === "lt") return value < condValue;
    if (op === "lte") return value <= condValue;
  }
  if (value instanceof Date && condValue instanceof Date) {
    const t = value.getTime();
    const c = condValue.getTime();
    if (op === "eq") return t === c;
    if (op === "neq") return t !== c;
    if (op === "gt") return t > c;
    if (op === "gte") return t >= c;
    if (op === "lt") return t < c;
    if (op === "lte") return t <= c;
  }
  if (typeof condValue === "string" && value instanceof Date) {
    const c = new Date(condValue).getTime();
    if (!Number.isNaN(c)) {
      const t = value.getTime();
      if (op === "eq") return t === c;
      if (op === "neq") return t !== c;
      if (op === "gt") return t > c;
      if (op === "gte") return t >= c;
      if (op === "lt") return t < c;
      if (op === "lte") return t <= c;
    }
  }
  if (typeof value === "string" && typeof condValue === "string") {
    const tv = Date.parse(value);
    const cv = Date.parse(condValue);
    if (!Number.isNaN(tv) && !Number.isNaN(cv)) {
      if (op === "eq") return tv === cv;
      if (op === "neq") return tv !== cv;
      if (op === "gt") return tv > cv;
      if (op === "gte") return tv >= cv;
      if (op === "lt") return tv < cv;
      if (op === "lte") return tv <= cv;
    }
  }
  if (op === "eq") return value === condValue;
  if (op === "neq") return value !== condValue;
  return false;
}

function parseConditions(filter: ViewConfig["filter"]): FilterCondition[] {
  if (!filter) return [];
  if (Array.isArray(filter)) return filter as FilterCondition[];
  const conditions: FilterCondition[] = [];
  const obj = filter as Record<string, { op?: string; value?: unknown }>;
  for (const [field, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && "op" in v && "value" in v) {
      conditions.push({
        field,
        op: (v.op as FilterCondition["op"]) || "eq",
        value: v.value,
      });
    }
  }
  return conditions;
}

/** Filter entities by conditions (same ops as views: eq, neq, contains, gt, lt, gte, lte, empty). For createdAt use entity.createdAt. */
export function filterEntitiesByConditions<
  T extends { id: string; data: unknown; createdAt?: Date }
>(entities: T[], conditions: { field: string; op: string; value: unknown }[]): T[] {
  if (!conditions.length) return entities;
  const normalized = conditions.map((c) => ({
    field: c.field,
    op: (c.op as FilterCondition["op"]) || "eq",
    value: c.value,
  }));
  return entities.filter((e) => {
    const data = (e.data as Record<string, unknown>) ?? {};
    return normalized.every((c) => {
      const val =
        c.field === "createdAt" && "createdAt" in e ? e.createdAt : data[c.field];
      return matchesCondition(val, c.op, c.value);
    });
  });
}

function parseSort(sort: ViewConfig["sort"]): SortSpec[] {
  if (!sort || !Array.isArray(sort)) return [];
  return sort as SortSpec[];
}

export function applyViewToEntities<T extends { id: string; data: unknown }>(
  entities: T[],
  config: ViewConfig | null
): T[] {
  const conditions = parseConditions(config?.filter);
  const sortSpecs = parseSort(config?.sort);

  let result = entities.filter((e) => {
    const data = (e.data as Record<string, unknown>) ?? {};
    return conditions.every((c) => {
      const val =
        c.field === "createdAt" && "createdAt" in e
          ? e.createdAt
          : data[c.field];
      return matchesCondition(val, c.op, c.value);
    });
  });

  if (sortSpecs.length > 0) {
    result = [...result].sort((a, b) => {
      for (const s of sortSpecs) {
        const av = getEntitySortValue(
          a as { id: string; data: unknown; createdAt?: Date },
          s.field
        );
        const bv = getEntitySortValue(
          b as { id: string; data: unknown; createdAt?: Date },
          s.field
        );
        const cmp = compareSortValues(av, bv);
        if (cmp !== 0) return s.dir === "desc" ? -cmp : cmp;
      }
      return 0;
    });
  }

  return result;
}

export function getColumnOrder(
  config: ViewConfig | null,
  allFieldSlugs: string[],
  maxColumns: number = 6
): string[] {
  const cols = Array.isArray(config?.columns) ? config.columns : [];
  const valid = cols.filter((s) => allFieldSlugs.includes(s));
  if (valid.length > 0) {
    return valid.slice(0, maxColumns);
  }
  return allFieldSlugs.slice(0, maxColumns);
}

function valueMatchesKeyword(val: unknown, q: string): boolean {
  if (val == null) return false;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val).toLowerCase().includes(q);
  }
  if (Array.isArray(val)) {
    return val.some((x) => valueMatchesKeyword(x, q));
  }
  if (typeof val === "object") {
    if (val instanceof Date) return val.toISOString().toLowerCase().includes(q);
    try {
      return JSON.stringify(val).toLowerCase().includes(q);
    } catch {
      return false;
    }
  }
  return false;
}

/** Case-insensitive match on id, createdAt, and all values in entity.data (after view filters). */
export function filterEntitiesByKeyword<T extends { id: string; data: unknown; createdAt?: Date }>(
  entities: T[],
  keyword: string
): T[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return entities;
  return entities.filter((e) => {
    if (e.id.toLowerCase().includes(q)) return true;
    if (e.createdAt instanceof Date && e.createdAt.toISOString().toLowerCase().includes(q)) return true;
    const data = (e.data as Record<string, unknown>) ?? {};
    for (const val of Object.values(data)) {
      if (valueMatchesKeyword(val, q)) return true;
    }
    return false;
  });
}
