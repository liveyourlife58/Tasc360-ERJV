"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { createSubscriptionCheckout, openBillingPortal } from "./actions";

function PendingSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Please wait…" : label}
    </button>
  );
}

type BillingActionState = { error?: string; redirectUrl?: string } | null;

export function SubscriptionBillingBlock({
  hasSubscription,
  subscriptionActive,
}: {
  hasSubscription: boolean;
  subscriptionActive: boolean;
}) {
  const [checkoutState, checkoutAction] = useActionState(
    async () => createSubscriptionCheckout(),
    null as BillingActionState
  );
  const [portalState, portalAction] = useActionState(
    async () => openBillingPortal(),
    null as BillingActionState
  );
  const err = checkoutState?.error ?? portalState?.error;
  const redirectUrl = checkoutState?.redirectUrl ?? portalState?.redirectUrl;

  useEffect(() => {
    if (redirectUrl) {
      window.location.assign(redirectUrl);
    }
  }, [redirectUrl]);

  return (
    <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
      {!hasSubscription ? (
        <form action={checkoutAction}>
          <PendingSubmitButton label="Subscribe with Stripe" />
        </form>
      ) : (
        <form action={portalAction}>
          <PendingSubmitButton label="Manage billing" />
        </form>
      )}
      {err && <p className="view-error" style={{ margin: 0 }} role="alert">{err}</p>}
    </div>
  );
}
