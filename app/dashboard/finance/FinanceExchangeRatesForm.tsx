"use client";

import { useActionState } from "react";

export function FinanceExchangeRatesForm({
  addAction,
}: {
  addAction: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [state, formAction] = useActionState(addAction, null as { error?: string } | null);
  return (
    <form action={formAction} className="subscription-add-user-form" style={{ maxWidth: "24rem" }}>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="finance-fromCurrency">From currency (e.g. GBP)</label>
          <input id="finance-fromCurrency" name="fromCurrency" type="text" maxLength={3} placeholder="GBP" className="form-control" required />
        </div>
        <div className="form-group">
          <label htmlFor="finance-toCurrency">To currency (e.g. USD)</label>
          <input id="finance-toCurrency" name="toCurrency" type="text" maxLength={3} placeholder="USD" className="form-control" required />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="finance-rate">Rate</label>
          <input id="finance-rate" name="rate" type="number" step="any" min="0.00000001" placeholder="1.27" className="form-control" required />
        </div>
        <div className="form-group">
          <label htmlFor="finance-effectiveDate">Effective date</label>
          <input id="finance-effectiveDate" name="effectiveDate" type="date" className="form-control" required />
        </div>
      </div>
      {state?.error && <p className="view-error" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-primary">Add rate</button>
    </form>
  );
}
