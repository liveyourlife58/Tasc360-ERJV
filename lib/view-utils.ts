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

function getEntitySortValue(
  entity: { id: string; data: unknown; createdAt?: Date },
  field: string
): unknown {
  if (field === "createdAt" && "createdAt" in entity) {
    return entity.createdAt;
  }
  const data = (entity.data as Record<string, unknown>) ?? {};
  return data[field];
}

function matchesCondition(
  value: unknown,
  op: string,
  condValue: unknown
): boolean {
  if (op === "empty") {
    return value == null || value === "";
  }
  if (op === "eq") return value === condValue;
  if (op === "neq") return value !== condValue;
  if (typeof value === "string" && typeof condValue === "string") {
    if (op === "contains") return value.toLowerCase().includes(condValue.toLowerCase());
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
    if (op === "gt") return t > c;
    if (op === "gte") return t >= c;
    if (op === "lt") return t < c;
    if (op === "lte") return t <= c;
  }
  if (typeof condValue === "string" && value instanceof Date) {
    const c = new Date(condValue).getTime();
    if (!Number.isNaN(c)) {
      const t = value.getTime();
      if (op === "gt") return t > c;
      if (op === "gte") return t >= c;
      if (op === "lt") return t < c;
      if (op === "lte") return t <= c;
    }
  }
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
        let cmp = 0;
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = 1;
        else if (bv == null) cmp = -1;
        else if (typeof av === "string" && typeof bv === "string") {
          cmp = av.localeCompare(bv);
        } else if (typeof av === "number" && typeof bv === "number") {
          cmp = av - bv;
        } else if (av instanceof Date && bv instanceof Date) {
          cmp = av.getTime() - bv.getTime();
        } else {
          cmp = String(av).localeCompare(String(bv));
        }
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
  const rest = allFieldSlugs.filter((s) => !valid.includes(s));
  return [...valid, ...rest].slice(0, maxColumns);
}
