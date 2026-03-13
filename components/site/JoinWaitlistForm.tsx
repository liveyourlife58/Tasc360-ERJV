"use client";

import { useActionState } from "react";
import { joinWaitlist } from "@/app/s/actions";

export function JoinWaitlistForm({
  tenantSlug,
  entityId,
}: {
  tenantSlug: string;
  entityId: string;
}) {
  const [state, formAction] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const email = (formData.get("email") as string)?.trim() ?? "";
      const quantity = Math.max(1, parseInt(String(formData.get("quantity") ?? "1"), 10) || 1);
      return joinWaitlist(tenantSlug, entityId, email, quantity);
    },
    null as { error?: string; success?: boolean } | null
  );
  if (state?.success) {
    return (
      <p className="site-waitlist-success" style={{ color: "#059669", fontSize: "0.9375rem", marginTop: "0.5rem" }}>
        You&apos;re on the list. We&apos;ll notify you if a spot opens up.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="site-waitlist-form"
      style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}
    >
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="waitlist-email" style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
          Email
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          style={{ padding: "0.35rem 0.5rem", minWidth: 200 }}
        />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="waitlist-quantity" style={{ display: "block", fontSize: "0.8125rem", marginBottom: "0.25rem" }}>
          Quantity
        </label>
        <input
          id="waitlist-quantity"
          name="quantity"
          type="number"
          min={1}
          defaultValue={1}
          style={{ padding: "0.35rem 0.5rem", width: 70 }}
        />
      </div>
      <button type="submit" className="btn btn-secondary" style={{ padding: "0.35rem 0.75rem" }}>
        Join waitlist
      </button>
      {state?.error && (
        <p className="view-error" style={{ width: "100%", marginTop: "0.25rem", marginBottom: 0 }} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
