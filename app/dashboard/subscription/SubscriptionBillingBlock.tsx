"use client";

import { useActionState } from "react";
import { createSubscriptionCheckout, openBillingPortal } from "./actions";

export function SubscriptionBillingBlock({
  hasSubscription,
  subscriptionActive,
}: {
  hasSubscription: boolean;
  subscriptionActive: boolean;
}) {
  const [checkoutState, checkoutAction] = useActionState(
    async () => createSubscriptionCheckout(),
    null as { error?: string } | null
  );
  const [portalState, portalAction] = useActionState(
    async () => openBillingPortal(),
    null as { error?: string } | null
  );
  const err = checkoutState?.error ?? portalState?.error;

  return (
    <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      {!hasSubscription ? (
        <form action={checkoutAction}>
          <button type="submit" className="btn btn-primary">
            Subscribe with Stripe
          </button>
        </form>
      ) : (
        <form action={portalAction}>
          <button type="submit" className="btn btn-primary">
            Manage billing
          </button>
        </form>
      )}
      {err && <p className="view-error" style={{ margin: 0 }} role="alert">{err}</p>}
    </div>
  );
}
