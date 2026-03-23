"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 280;

function ModuleListSearchBarClient({
  initialQuery,
}: {
  initialQuery: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paramsSnapshotRef = useRef(searchParams.toString());
  paramsSnapshotRef.current = searchParams.toString();

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(paramsSnapshotRef.current);
      const urlQ = (params.get("q") ?? "").trim();
      const localTrimmed = value.trim();
      if (urlQ === localTrimmed) return;
      if (localTrimmed) params.set("q", localTrimmed);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.replace(href);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, pathname, router]);

  const clearHref = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  const showClear = value.trim() !== "" || (searchParams.get("q") ?? "").trim() !== "";

  return (
    <div className={`module-list-search-bar${isPending ? " module-list-search-bar--pending" : ""}`}>
      <div className="module-list-search-form" role="search">
        <input
          id="module-list-q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search records…"
          className="module-list-search-input"
          autoComplete="off"
          aria-label="Search records"
          aria-busy={isPending}
        />
        {showClear && (
          <Link href={clearHref} className="btn btn-secondary module-list-search-clear" scroll={false}>
            Clear
          </Link>
        )}
      </div>
    </div>
  );
}

function SearchBarFallback() {
  return (
    <div className="module-list-search-bar" aria-hidden>
      <div className="module-list-search-form">
        <div
          className="module-list-search-input"
          style={{ background: "#f8fafc", minHeight: "2.25rem" }}
        />
      </div>
    </div>
  );
}

export function ModuleListSearchBar({
  moduleSlug: _moduleSlug,
  initialQuery,
  viewId: _viewId,
  showDeleted: _showDeleted,
}: {
  moduleSlug: string;
  initialQuery: string;
  viewId: string | null;
  showDeleted: boolean;
}) {
  return (
    <Suspense fallback={<SearchBarFallback />}>
      <ModuleListSearchBarClient initialQuery={initialQuery} />
    </Suspense>
  );
}
