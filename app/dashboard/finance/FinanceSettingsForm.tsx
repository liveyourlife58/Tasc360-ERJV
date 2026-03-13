"use client";

import { useActionState } from "react";

export function FinanceSettingsForm({
  updateAction,
  accountModuleSlug,
  ledgerModuleSlug,
  defaultLedgerEntityId,
  ledgerOptions,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  accountModuleSlug: string;
  ledgerModuleSlug: string;
  defaultLedgerEntityId: string | null;
  ledgerOptions: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(updateAction, null as { error?: string } | null);
  return (
    <form action={formAction} className="subscription-add-user-form" style={{ maxWidth: "28rem" }}>
      <div className="form-group">
        <label htmlFor="finance-accountSlug">Account module slug</label>
        <input
          id="finance-accountSlug"
          name="accountModuleSlug"
          type="text"
          defaultValue={accountModuleSlug}
          className="form-control"
          placeholder="account"
        />
      </div>
      <div className="form-group">
        <label htmlFor="finance-ledgerSlug">Ledger module slug</label>
        <input
          id="finance-ledgerSlug"
          name="ledgerModuleSlug"
          type="text"
          defaultValue={ledgerModuleSlug}
          className="form-control"
          placeholder="ledger"
        />
      </div>
      {ledgerOptions.length > 0 && (
        <div className="form-group">
          <label htmlFor="finance-defaultLedger">Default ledger</label>
          <select
            id="finance-defaultLedger"
            name="defaultLedgerEntityId"
            className="form-control"
            defaultValue={defaultLedgerEntityId ?? ""}
          >
            <option value="">None</option>
            {ledgerOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
      {state?.error && <p className="view-error" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}
