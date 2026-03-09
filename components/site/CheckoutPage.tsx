"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSiteCart } from "./SiteCartProvider";
import { submitCheckout } from "@/app/s/[slug]/cart/actions";

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function CheckoutPage({ tenantSlug }: { tenantSlug: string }) {
  const { items, clearCart } = useSiteCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  if (items.length === 0) {
    return (
      <div className="site-page site-checkout">
        <h1>Checkout</h1>
        <p className="site-empty">Your cart is empty.</p>
        <p>
          <Link href={`/s/${tenantSlug}/cart`} className="btn btn-secondary">
            ← Back to cart
          </Link>
        </p>
      </div>
    );
  }

  const totalCents = items.reduce((sum, i) => sum + i.amountCents * i.quantity, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await submitCheckout(tenantSlug, items, { name, email });
      if ("error" in result && result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      clearCart();
      router.push(`/s/${tenantSlug}/cart/thank-you`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="site-page site-checkout">
      <h1>Checkout</h1>
      <p style={{ color: "#64748b", marginBottom: "1rem" }}>
        Prototype: no payment required. In the future, required prices will use Stripe; suggested donations will be optional.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="site-checkout-summary" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", marginBottom: "0.75rem" }}>Order summary</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {items.map((item) => (
              <li
                key={item.entityId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <span>
                  <Link href={`/s/${tenantSlug}/${item.segment}/${item.entityId}`} style={{ fontWeight: 500 }}>
                    {item.title}
                  </Link>
                  {item.quantity > 1 && ` × ${item.quantity}`}
                  {item.type === "donation" && (
                    <span style={{ fontSize: "0.875rem", color: "#64748b", marginLeft: "0.25rem" }}>(suggested donation)</span>
                  )}
                </span>
                <span>{formatAmount(item.amountCents * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p style={{ fontWeight: 600, marginTop: "0.75rem" }}>Total: {formatAmount(totalCents)}</p>
        </div>
        <div className="site-checkout-purchaser" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", marginBottom: "0.75rem" }}>Your information</h2>
          <p style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="checkout-name" style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
              Name
            </label>
            <input
              id="checkout-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              style={{ width: "100%", maxWidth: "20rem", padding: "0.5rem" }}
            />
          </p>
          <p style={{ marginBottom: "0" }}>
            <label htmlFor="checkout-email" style={{ display: "block", marginBottom: "0.25rem", fontWeight: 500 }}>
              Email
            </label>
            <input
              id="checkout-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: "100%", maxWidth: "20rem", padding: "0.5rem" }}
            />
          </p>
        </div>
        {error && (
          <p role="alert" style={{ color: "#dc2626", marginBottom: "1rem" }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? "Placing order…" : "Place order"}
          </button>
          <Link href={`/s/${tenantSlug}/cart`} className="btn btn-secondary">
            ← Back to cart
          </Link>
        </div>
      </form>
    </div>
  );
}
