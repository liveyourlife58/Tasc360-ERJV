"use client";

import { Suspense, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterCondition } from "@/lib/view-utils";
import {
  LIST_DATA_FILTERS_QUERY_KEY,
  MAX_LIST_DATA_FILTERS,
  opsForListDataFieldType,
  parseListDataFiltersParam,
  stringifyListDataFilters,
  type ListDataFilterFieldMeta,
} from "@/lib/list-data-filters";

const OP_LABELS: Record<FilterCondition["op"], string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  empty: "is empty",
};

function chipLabel(metaBySlug: Map<string, ListDataFilterFieldMeta>, c: FilterCondition): string {
  const m = metaBySlug.get(c.field);
  const name = m?.name ?? c.field;
  if (c.op === "empty") return `${name}: empty`;
  const opL = OP_LABELS[c.op] ?? c.op;
  let val = "";
  if (c.value === true) val = "Yes";
  else if (c.value === false) val = "No";
  else val = String(c.value ?? "");
  if (val.length > 32) val = val.slice(0, 29) + "…";
  return `${name} ${opL} ${val}`;
}

function ModuleListDataFiltersInner({
  fieldsForParse,
  filterableFieldsMeta,
}: {
  fieldsForParse: { slug: string; fieldType: string }[];
  filterableFieldsMeta: ListDataFilterFieldMeta[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const dfRaw = searchParams.get(LIST_DATA_FILTERS_QUERY_KEY);
  const conditions = useMemo(
    () => parseListDataFiltersParam(dfRaw ?? undefined, fieldsForParse),
    [dfRaw, fieldsForParse]
  );

  const metaBySlug = useMemo(
    () => new Map(filterableFieldsMeta.map((m) => [m.slug, m])),
    [filterableFieldsMeta]
  );

  const firstSlug = filterableFieldsMeta[0]?.slug ?? "";
  const [draftField, setDraftField] = useState(firstSlug);
  const draftMeta = metaBySlug.get(draftField);
  const draftOps = draftMeta ? opsForListDataFieldType(draftMeta.fieldType) : [];
  const [draftOp, setDraftOp] = useState<FilterCondition["op"] | "">("");
  const [draftValue, setDraftValue] = useState("");

  const applyConditions = (next: FilterCondition[]) => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("page");
    if (next.length === 0) p.delete(LIST_DATA_FILTERS_QUERY_KEY);
    else p.set(LIST_DATA_FILTERS_QUERY_KEY, stringifyListDataFilters(next));
    const qs = p.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      router.refresh();
    });
  };

  const removeAt = (idx: number) => {
    const next = conditions.filter((_, i) => i !== idx);
    applyConditions(next);
  };

  const clearAll = () => applyConditions([]);

  const effectiveDraftOp = (draftOp && draftOps.includes(draftOp) ? draftOp : draftOps[0] ?? "") as
    | FilterCondition["op"]
    | "";

  const addFilter = () => {
    if (!draftMeta || !effectiveDraftOp || conditions.length >= MAX_LIST_DATA_FILTERS) return;
    if (effectiveDraftOp !== "empty") {
      if (draftMeta.fieldType === "boolean") {
        if (draftValue !== "true" && draftValue !== "false") return;
      } else if (draftValue.trim() === "") return;
    }
    let value: unknown = draftValue;
    if (effectiveDraftOp === "empty") {
      applyConditions([...conditions, { field: draftField, op: "empty", value: undefined }]);
      return;
    }
    if (draftMeta.fieldType === "number") {
      const n = Number(draftValue.trim());
      if (!Number.isFinite(n)) return;
      value = n;
    }
    if (draftMeta.fieldType === "boolean") {
      value = draftValue === "true";
    }
    applyConditions([...conditions, { field: draftField, op: effectiveDraftOp, value }]);
    setDraftValue("");
  };

  const useOptionPickers =
    draftMeta &&
    (draftMeta.fieldType === "select" ||
      draftMeta.fieldType === "relation" ||
      draftMeta.fieldType === "tenant-user") &&
    (draftMeta.options?.length ?? 0) > 0;

  return (
    <div className={`module-list-data-filters${isPending ? " module-list-data-filters--pending" : ""}`}>
      {conditions.length > 0 && (
        <ul className="module-list-data-filters-chips" aria-label="Active field filters">
          {conditions.map((c, idx) => (
            <li key={`${c.field}-${c.op}-${idx}`} className="module-list-data-filters-chip">
              <span className="module-list-data-filters-chip-text">{chipLabel(metaBySlug, c)}</span>
              <button
                type="button"
                className="module-list-data-filters-chip-remove"
                aria-label={`Remove filter ${chipLabel(metaBySlug, c)}`}
                onClick={() => removeAt(idx)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {conditions.length > 0 && (
        <button type="button" className="btn btn-secondary module-list-data-filters-clear" onClick={clearAll}>
          Clear filters
        </button>
      )}
      {conditions.length < MAX_LIST_DATA_FILTERS && (
        <div className="module-list-data-filters-add" role="group" aria-label="Add field filter">
          <select
            className="module-list-data-filters-select"
            value={draftField}
            aria-label="Field"
            onChange={(e) => {
              const s = e.target.value;
              setDraftField(s);
              const m = metaBySlug.get(s);
              const ops = m ? opsForListDataFieldType(m.fieldType) : [];
              setDraftOp(ops[0] ?? "");
              setDraftValue("");
            }}
          >
            {filterableFieldsMeta.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            className="module-list-data-filters-select"
            value={effectiveDraftOp}
            aria-label="Operator"
            onChange={(e) => setDraftOp(e.target.value as FilterCondition["op"])}
          >
            {draftOps.map((op) => (
              <option key={op} value={op}>
                {OP_LABELS[op]}
              </option>
            ))}
          </select>
          {effectiveDraftOp !== "empty" && draftMeta?.fieldType === "boolean" && (
            <select
              className="module-list-data-filters-select"
              value={draftValue}
              aria-label="Value"
              onChange={(e) => setDraftValue(e.target.value)}
            >
              <option value="">Choose…</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          )}
          {effectiveDraftOp !== "empty" && useOptionPickers && (
            <select
              className="module-list-data-filters-select module-list-data-filters-value-select"
              value={draftValue}
              aria-label="Value"
              onChange={(e) => setDraftValue(e.target.value)}
            >
              <option value="">Choose…</option>
              {(draftMeta!.options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {effectiveDraftOp !== "empty" &&
            draftMeta &&
            !(draftMeta.fieldType === "boolean") &&
            !useOptionPickers && (
              <input
                className="module-list-data-filters-value-input"
                type={
                  draftMeta.fieldType === "number"
                    ? "number"
                    : draftMeta.fieldType === "date"
                      ? "date"
                      : "text"
                }
                value={draftValue}
                onChange={(e) => setDraftValue(e.target.value)}
                placeholder="Value"
                aria-label="Filter value"
              />
            )}
          <button type="button" className="btn btn-secondary" onClick={addFilter}>
            Add filter
          </button>
        </div>
      )}
    </div>
  );
}

function DataFiltersFallback() {
  return <div className="module-list-data-filters module-list-data-filters--fallback" aria-hidden />;
}

export function ModuleListDataFilters({
  fieldsForParse,
  filterableFieldsMeta,
}: {
  fieldsForParse: { slug: string; fieldType: string }[];
  filterableFieldsMeta: ListDataFilterFieldMeta[];
}) {
  if (filterableFieldsMeta.length === 0) return null;
  return (
    <Suspense fallback={<DataFiltersFallback />}>
      <ModuleListDataFiltersInner
        fieldsForParse={fieldsForParse}
        filterableFieldsMeta={filterableFieldsMeta}
      />
    </Suspense>
  );
}
