"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LIST_SORT_PRICE_SLUG } from "@/lib/entity-list-sort";

type Column = { id: string; slug: string; name: string };

function ChevronUp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 10 6" width={10} height={6} aria-hidden>
      <path d="M5 0 L10 6 L0 6 Z" fill="currentColor" />
    </svg>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 10 6" width={10} height={6} aria-hidden>
      <path d="M0 0 L10 0 L5 6 Z" fill="currentColor" />
    </svg>
  );
}

function SortHeaderCell({
  fieldSlug,
  label,
  currentField,
  currentDir,
  applySort,
}: {
  fieldSlug: string;
  label: string;
  currentField: string;
  currentDir: "asc" | "desc" | "";
  applySort: (fieldSlug: string, dir: "" | "asc" | "desc") => void;
}) {
  const isThis = currentField === fieldSlug;
  const dirHere: "asc" | "desc" | "" = isThis && (currentDir === "asc" || currentDir === "desc") ? currentDir : "";

  const cycle = () => {
    let next: "" | "asc" | "desc";
    if (!isThis) next = "asc";
    else if (currentDir === "asc") next = "desc";
    else if (currentDir === "desc") next = "";
    else next = "asc";
    applySort(fieldSlug, next);
  };

  const ariaSort =
    dirHere === "asc" ? "ascending" : dirHere === "desc" ? "descending" : undefined;

  return (
    <th className="entity-list-th-sortable" aria-sort={ariaSort}>
      <button
        type="button"
        className="entity-list-sort-chevron-trigger"
        onClick={cycle}
        aria-label={`Sort by ${label}. Cycles ascending, descending, then default.`}
      >
        <span className="entity-list-sort-chevron-label">{label}</span>
        <span className="entity-list-sort-chevron-stack">
          <ChevronUp className={dirHere === "asc" ? "is-active" : undefined} />
          <ChevronDown className={dirHere === "desc" ? "is-active" : undefined} />
        </span>
      </button>
    </th>
  );
}

function EntityListHeaderRowInner({
  columns,
  showAmountColumn,
  amountColumnLabel,
}: {
  columns: Column[];
  showAmountColumn: boolean;
  amountColumnLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const applySort = useCallback(
    (fieldSlug: string, dir: "" | "asc" | "desc") => {
      const p = new URLSearchParams(searchParams.toString());
      p.delete("page");
      if (dir === "") {
        p.delete("sortField");
        p.delete("sortDir");
      } else {
        p.set("sortField", fieldSlug);
        p.set("sortDir", dir);
      }
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      router.refresh();
    },
    [pathname, router, searchParams]
  );

  const currentField = searchParams.get("sortField")?.trim() || "";
  const currentDir = searchParams.get("sortDir") === "desc" ? "desc" : searchParams.get("sortDir") === "asc" ? "asc" : "";

  return (
    <tr>
      {columns.map((f) => (
        <SortHeaderCell
          key={f.id}
          fieldSlug={f.slug}
          label={f.name}
          currentField={currentField}
          currentDir={currentDir}
          applySort={applySort}
        />
      ))}
      {showAmountColumn && (
        <SortHeaderCell
          fieldSlug={LIST_SORT_PRICE_SLUG}
          label={amountColumnLabel}
          currentField={currentField}
          currentDir={currentDir}
          applySort={applySort}
        />
      )}
    </tr>
  );
}

function HeaderRowFallback({ columns, showAmountColumn, amountColumnLabel }: Parameters<typeof EntityListHeaderRowInner>[0]) {
  return (
    <tr>
      {columns.map((f) => (
        <th key={f.id}>{f.name}</th>
      ))}
      {showAmountColumn && <th>{amountColumnLabel}</th>}
    </tr>
  );
}

export function EntityListHeaderRow(props: Parameters<typeof EntityListHeaderRowInner>[0]) {
  return (
    <Suspense fallback={<HeaderRowFallback {...props} />}>
      <EntityListHeaderRowInner {...props} />
    </Suspense>
  );
}
