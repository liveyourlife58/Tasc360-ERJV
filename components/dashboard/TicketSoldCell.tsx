"use client";

import { useState } from "react";
import { getEntityTicketDetails, updateOrderLineCheckIn } from "@/app/dashboard/actions";

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

type OrderLineRow = {
  id: string;
  quantity: number;
  amountCents: number;
  lineType: string;
  checkedInQuantity: number;
  order: { purchaserName: string; purchaserEmail: string; createdAt: Date };
};

export function TicketSoldCell({
  entityId,
  entityTitle,
  ticketsSold,
}: {
  entityId: string;
  entityTitle: string;
  ticketsSold: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderLines, setOrderLines] = useState<OrderLineRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function openModal() {
    if (ticketsSold <= 0) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    setOrderLines(null);
    try {
      const result = await getEntityTicketDetails(entityId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOrderLines(
        (result.orderLines ?? []).map((line) => ({
          ...line,
          checkedInQuantity: line.checkedInQuantity ?? 0,
          order: {
            ...line.order,
            createdAt: new Date(line.order.createdAt),
          },
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckInChange(line: OrderLineRow, newValue: number) {
    const value = Math.max(0, Math.min(line.quantity, Math.floor(newValue)));
    setUpdatingId(line.id);
    try {
      const result = await updateOrderLineCheckIn(line.id, value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setOrderLines((prev) =>
        prev ? prev.map((l) => (l.id === line.id ? { ...l, checkedInQuantity: value } : l)) : null
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (ticketsSold <= 0) return null;

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
          marginLeft: "0.35rem",
        }}
      >
        {ticketsSold} sold
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ticket details – ${entityTitle}`}
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
              <h2 style={{ margin: 0, fontSize: "1.125rem" }}>Tickets sold – {entityTitle}</h2>
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
              {!loading && !error && orderLines && orderLines.length > 0 && (
                <table
                  className="entity-table"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.8125rem" }}>Purchaser</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.8125rem" }}>Email</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.8125rem" }}>Qty</th>
                      <th style={{ textAlign: "center", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.8125rem" }}>Checked in</th>
                      <th style={{ textAlign: "right", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.8125rem" }}>Amount</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.8125rem" }}>Type</th>
                      <th style={{ textAlign: "left", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e2e8f0", fontWeight: 600, fontSize: "0.8125rem" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderLines.map((line) => (
                      <tr key={line.id}>
                        <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem" }}>{line.order.purchaserName}</td>
                        <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem" }}>{line.order.purchaserEmail}</td>
                        <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem", textAlign: "right" }}>{line.quantity}</td>
                        <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem", textAlign: "center" }}>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={line.checkedInQuantity}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              const n = raw === "" ? 0 : parseInt(raw, 10);
                              if (raw === "" || !Number.isNaN(n))
                                setOrderLines((prev) =>
                                  prev ? prev.map((l) => (l.id === line.id ? { ...l, checkedInQuantity: raw === "" ? 0 : Math.max(0, Math.min(line.quantity, n)) } : l)) : null
                                );
                            }}
                            onBlur={(e) => {
                              const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
                              const clamped = Math.max(0, Math.min(line.quantity, Number.isNaN(n) ? 0 : n));
                              setOrderLines((prev) =>
                                prev ? prev.map((l) => (l.id === line.id ? { ...l, checkedInQuantity: clamped } : l)) : null
                              );
                              handleCheckInChange(line, clamped);
                            }}
                            disabled={updatingId === line.id}
                            style={{ width: "3.5ch", padding: "0.2rem 0.25rem", textAlign: "right" }}
                            aria-label={`Checked in for ${line.order.purchaserName}`}
                          />
                          <span style={{ marginLeft: "0.25rem", color: "#64748b" }}>/ {line.quantity}</span>
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem", textAlign: "right" }}>{formatAmount(line.amountCents * line.quantity)}</td>
                        <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem" }}>{line.lineType === "donation" ? "Donation" : "Payment"}</td>
                        <td style={{ padding: "0.5rem 0.75rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.875rem", color: "#64748b" }}>{line.order.createdAt.toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!loading && !error && orderLines && orderLines.length === 0 && (
                <p style={{ margin: 0, color: "#64748b" }}>No ticket sales yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
