"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { importTenantData } from "@/app/dashboard/actions";

export function ImportDataForm() {
  const router = useRouter();
  const [json, setJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const raw = json.trim();
    if (!raw) {
      setError("Paste JSON or upload a file.");
      return;
    }
    setLoading(true);
    try {
      const result = await importTenantData(raw);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.created) {
        setSuccess(`Created ${result.created.modules} module(s), ${result.created.entities} entity(ies).`);
        setJson("");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setJson(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <form onSubmit={handleSubmit} className="import-data-form">
      <div className="form-group">
        <label htmlFor="import-json">Import from export JSON</label>
        <textarea
          id="import-json"
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder='Paste JSON from "Export data (JSON)" or upload a file.'
          rows={4}
          className="form-control"
          disabled={loading}
        />
        <div className="import-data-actions">
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="import-data-file-input"
            aria-label="Upload JSON file"
          />
          <button
            type="submit"
            className={`btn btn-primary${loading ? " is-loading" : ""}`}
            disabled={loading || !json.trim()}
          >
            {loading ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
      {error && <p className="view-error" role="alert">{error}</p>}
      {success && <p className="banner-success">{success}</p>}
    </form>
  );
}
