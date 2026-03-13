"use client";

import { useActionState } from "react";

export function FinanceFiscalPeriodsForm({
  addAction,
}: {
  addAction: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [state, formAction] = useActionState(addAction, null as { error?: string } | null);
  return (
    <form action={formAction} className="subscription-add-user-form" style={{ maxWidth: "24rem" }}>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="finance-periodStart">Period start</label>
          <input id="finance-periodStart" name="periodStart" type="date" className="form-control" required />
        </div>
        <div className="form-group">
          <label htmlFor="finance-periodEnd">Period end</label>
          <input id="finance-periodEnd" name="periodEnd" type="date" className="form-control" required />
        </div>
      </div>
      {state?.error && <p className="view-error" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-primary">Add period</button>
    </form>
  );
}
