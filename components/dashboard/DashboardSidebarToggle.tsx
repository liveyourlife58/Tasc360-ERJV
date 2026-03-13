"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const LAYOUT_ID = "dashboard-layout";

export function DashboardSidebarToggle() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const el = document.getElementById(LAYOUT_ID);
    if (!el) return;
    if (open) el.classList.add("dashboard-sidebar-open");
    else el.classList.remove("dashboard-sidebar-open");
    return () => el.classList.remove("dashboard-sidebar-open");
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="dashboard-sidebar-toggle-btn"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <span aria-hidden>☰</span>
      </button>
      {open && (
        <div
          className="dashboard-sidebar-overlay"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}
    </>
  );
}
