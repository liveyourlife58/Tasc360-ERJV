"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

type AccountOption = { id: string; label: string };
type LedgerOption = { id: string; label: string };

const CURRENCIES = ["USD", "EUR", "GBP"];

export function JournalEntryForm({
  createAction,
  accountOptions,
  ledgerOptions,
  defaultLedgerId,
  tenantSlug,
}: {
  createAction: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  accountOptions: AccountOption[];
  ledgerOptions: LedgerOption[];
  defaultLedgerId: string | null;
  tenantSlug: string;
}) {
  const [state, formAction] = useActionState(createAction, null as { error?: string } | null);
  const [lines, setLines] = useState<{ accountEntityId: string; debitCents: string; creditCents: string; currency: string; description: string }[]>([
    { accountEntityId: "", debitCents: "", creditCents: "", currency: "USD", description: "" },
  ]);

  const addLine = () => {
    setLines((prev) => [...prev, { accountEntityId: "", debitCents: "", creditCents: "", currency: "USD", description: "" }]);
  };
  const removeLine = (i: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  };
  const updateLine = (i: number, field: string, value: string) => {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  return (
    <form action={formAction} className="subscription-add-user-form" style={{ maxWidth: "42rem" }}>
      <input type="hidden" name="lines" value={JSON.stringify(lines.map((l) => ({
        accountEntityId: l.accountEntityId,
        debitCents: l.debitCents ? Math.round(Number(l.debitCents)) : 0,
        creditCents: l.creditCents ? Math.round(Number(l.creditCents)) : 0,
        currency: l.currency || "USD",
        description: l.description || undefined,
      })))} />
      <div className="form-group">
        <label htmlFor="je-entryDate">Entry date</label>
        <input id="je-entryDate" name="entryDate" type="date" className="form-control" required />
      </div>
      <div className="form-group">
        <label htmlFor="je-reference">Reference</label>
        <input id="je-reference" name="reference" type="text" className="form-control" placeholder="Optional" />
      </div>
      <div className="form-group">
        <label htmlFor="je-description">Description</label>
        <textarea id="je-description" name="description" className="form-control" rows={2} placeholder="Optional" />
      </div>
      {ledgerOptions.length > 0 && (
        <div className="form-group">
          <label htmlFor="je-ledger">Ledger</label>
          <select id="je-ledger" name="ledgerEntityId" className="form-control" defaultValue={defaultLedgerId ?? ""}>
            <option value="">Default</option>
            {ledgerOptions.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{ marginTop: "1.5rem" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Lines (debits must equal credits)</h3>
        {lines.map((line, i) => (
          <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <select
              required
              value={line.accountEntityId}
              onChange={(e) => updateLine(i, "accountEntityId", e.target.value)}
              className="form-control"
              style={{ minWidth: "10rem" }}
            >
              <option value="">Account</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step={1}
              placeholder="Debit"
              value={line.debitCents}
              onChange={(e) => updateLine(i, "debitCents", e.target.value)}
              className="form-control"
              style={{ width: "6rem" }}
            />
            <input
              type="number"
              min={0}
              step={1}
              placeholder="Credit"
              value={line.creditCents}
              onChange={(e) => updateLine(i, "creditCents", e.target.value)}
              className="form-control"
              style={{ width: "6rem" }}
            />
            <select
              value={line.currency}
              onChange={(e) => updateLine(i, "currency", e.target.value)}
              className="form-control"
              style={{ width: "5rem" }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Line description"
              value={line.description}
              onChange={(e) => updateLine(i, "description", e.target.value)}
              className="form-control"
              style={{ flex: 1, minWidth: "8rem" }}
            />
            <button type="button" onClick={() => removeLine(i)} className="btn btn-secondary" disabled={lines.length <= 1}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={addLine} className="btn btn-secondary">Add line</button>
      </div>
      {state?.error && <p className="view-error" role="alert">{state.error}</p>}
      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
        <button type="submit" className="btn btn-primary">Create journal entry</button>
        <Link href="/dashboard/finance" className="btn btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
