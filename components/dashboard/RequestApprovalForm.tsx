"use client";

import { useActionState } from "react";

const COMMON_TYPES = ["Quote", "PO", "Expense", "Time off", "Contract"];

export function RequestApprovalForm({
  entityId,
  moduleSlug,
  requestAction,
  existingPendingTypes,
}: {
  entityId: string;
  moduleSlug: string;
  requestAction: (entityId: string, moduleSlug: string, prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  existingPendingTypes: string[];
}) {
  const [state, formAction] = useActionState(
    (_prev: unknown, formData: FormData) => requestAction(entityId, moduleSlug, null, formData),
    null as { error?: string } | null
  );
  const alreadyRequested = existingPendingTypes.length > 0;

  if (alreadyRequested) {
    return (
      <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
        Pending approval: {existingPendingTypes.join(", ")}. View on <a href="/dashboard/approvals">Approvals</a>.
      </p>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="req-approval-type" style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
          Approval type
        </label>
        <input
          id="req-approval-type"
          name="approvalType"
          list="approval-types"
          type="text"
          placeholder="e.g. Quote, PO"
          className="form-control"
          style={{ width: "10rem" }}
          required
        />
        <datalist id="approval-types">
          {COMMON_TYPES.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <button type="submit" className="btn btn-primary">
        Submit for approval
      </button>
      {state?.error && <span className="view-error" role="alert" style={{ fontSize: "0.875rem" }}>{state.error}</span>}
    </form>
  );
}
