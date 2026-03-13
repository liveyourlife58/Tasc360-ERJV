"use client";

import { useState } from "react";
import { getTenantExportData } from "@/app/dashboard/actions";

export function ExportDataButton() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const result = await getTenantExportData();
      if (result.error) {
        alert(result.error);
        return;
      }
      if (!result.data) return;
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `tasc360-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={`btn btn-secondary${loading ? " is-loading" : ""}`}
      onClick={handleExport}
      disabled={loading}
    >
      <span className="btn-loading-text">{loading ? "Preparing…" : "Export data (JSON)"}</span>
    </button>
  );
}
