"use client";

import { useState } from "react";
import { getRelationEntityData } from "@/app/dashboard/actions";
import { formatDate } from "@/lib/format";

type Field = { slug: string; name: string; fieldType: string; settings?: unknown };

export function RelationMultiCell({
  entityIds,
  targetModuleSlug,
  fieldName,
  labelById,
}: {
  entityIds: string[];
  targetModuleSlug: string;
  fieldName: string;
  /** When set (e.g. from list page), show resolved labels instead of only "N selected". */
  labelById?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    entities: { id: string; data: Record<string, unknown> }[];
    fields: Field[];
    activityByEntityId?: Record<string, Record<string, string>>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openModal() {
    if (entityIds.length === 0) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await getRelationEntityData(targetModuleSlug, entityIds);
      if (result.error) {
        setError(result.error);
        return;
      }
      setData({
        entities: result.entities ?? [],
        fields: result.fields ?? [],
        activityByEntityId: (result as { activityByEntityId?: Record<string, Record<string, string>> })
          .activityByEntityId,
      });
    } finally {
      setLoading(false);
    }
  }

  const count = entityIds.length;
  const resolved =
    labelById && count > 0
      ? entityIds.map((id) => labelById[id] ?? id.slice(0, 8)).join(", ")
      : null;
  const truncated =
    resolved && resolved.length > 72 ? `${resolved.slice(0, 69)}…` : resolved;
  const label =
    truncated ?? (count === 1 ? "1 selected" : `${count} selected`);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "var(--color-link, #2563eb)",
          textDecoration: "underline",
          fontSize: "inherit",
          textAlign: "left",
        }}
        title={resolved && truncated !== resolved ? resolved : undefined}
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${fieldName} – ${label}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
          }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "8px",
              boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
              maxWidth: "90vw",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.125rem" }}>{fieldName}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  margin: 0,
                  padding: "0.25rem 0.5rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: "4px",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Close
              </button>
            </div>
            <div style={{ padding: "1rem 1.25rem", overflow: "auto", flex: 1 }}>
              {loading && <p style={{ margin: 0, color: "#64748b" }}>Loading…</p>}
              {error && (
                <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p>
              )}
              {!loading && !error && data && (
                <table
                  className="entity-table"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr>
                      {data.fields.map((f) => (
                        <th
                          key={f.slug}
                          style={{
                            textAlign: "left",
                            padding: "0.5rem 0.75rem",
                            borderBottom: "1px solid #e2e8f0",
                            fontWeight: 600,
                            fontSize: "0.8125rem",
                          }}
                        >
                          {f.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.entities.map((entity) => (
                      <tr key={entity.id}>
                        {data.fields.map((f) => (
                          <td
                            key={f.slug}
                            style={{
                              padding: "0.5rem 0.75rem",
                              borderBottom: "1px solid #f1f5f9",
                              fontSize: "0.875rem",
                              whiteSpace: f.fieldType === "activity" ? "pre-wrap" : undefined,
                            }}
                          >
                            {f.fieldType === "activity"
                              ? (data.activityByEntityId?.[entity.id]?.[f.slug] ?? "—")
                              : formatCell(entity.data[f.slug])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!loading && !error && data && data.entities.length === 0 && (
                <p style={{ margin: 0, color: "#64748b" }}>No records found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatCell(value: unknown): React.ReactNode {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? `${value.length} items` : "—";
  if (typeof value === "object" && "toISOString" in (value as object)) {
    return formatDate(value as Date);
  }
  return String(value);
}
