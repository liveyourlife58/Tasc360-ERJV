"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Table row that navigates to the entity edit page. Ignores clicks on links, buttons, and form controls.
 */
export function EntityListClickableRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    if (e.defaultPrevented) return;
    const el = e.target as HTMLElement;
    if (el.closest("a, button, input, select, textarea, label")) return;
    if (e.metaKey || e.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  }

  function onAuxClick(e: MouseEvent<HTMLTableRowElement>) {
    if (e.button === 1) {
      e.preventDefault();
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    router.push(href);
  }

  return (
    <tr
      className="entity-table-row-clickable"
      tabIndex={0}
      role="link"
      aria-label="Open record"
      title="Open record"
      onClick={onClick}
      onAuxClick={onAuxClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </tr>
  );
}
