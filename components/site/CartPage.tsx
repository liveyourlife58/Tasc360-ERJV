"use client";

import Link from "next/link";
import { useSiteCart } from "./SiteCartProvider";
import type { SiteCartItem } from "@/lib/site-cart";

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function CartPage({ tenantSlug }: { tenantSlug: string }) {
  const { items, removeItem, updateQuantity } = useSiteCart();

  if (items.length === 0) {
    return (
      <div className="site-page site-cart">
        <h1>Cart</h1>
        <p className="site-empty">Your cart is empty.</p>
        <p>
          <Link href={`/s/${tenantSlug}`} className="btn btn-secondary">
            ← Back to home
          </Link>
        </p>
      </div>
    );
  }

  const totalCents = items.reduce((sum, i) => sum + i.amountCents * i.quantity, 0);

  return (
    <div className="site-page site-cart">
      <h1>Cart</h1>
      <ul className="site-cart-list" style={{ listStyle: "none", padding: 0, margin: "1rem 0" }}>
        {items.map((item) => (
          <CartLineItem
            key={item.entityId}
            tenantSlug={tenantSlug}
            item={item}
            onRemove={() => removeItem(item.entityId)}
            onQuantityChange={(q) => updateQuantity(item.entityId, q)}
          />
        ))}
      </ul>
      <p className="site-cart-total" style={{ fontWeight: 600, marginTop: "1rem" }}>
        Total: {formatAmount(totalCents)}
      </p>
      <p style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href={`/s/${tenantSlug}/cart/checkout`} className="btn btn-primary">
          Proceed to checkout
        </Link>
        <Link href={`/s/${tenantSlug}`} className="btn btn-secondary">
          ← Continue browsing
        </Link>
      </p>
    </div>
  );
}

function CartLineItem({
  tenantSlug,
  item,
  onRemove,
  onQuantityChange,
}: {
  tenantSlug: string;
  item: SiteCartItem;
  onRemove: () => void;
  onQuantityChange: (q: number) => void;
}) {
  const lineTotal = item.amountCents * item.quantity;

  return (
    <li
      className="site-cart-item"
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
        padding: "0.75rem 1rem",
        marginBottom: "0.5rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <Link href={`/s/${tenantSlug}/${item.segment}/${item.entityId}`} style={{ fontWeight: 600 }}>
            {item.title}
          </Link>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
            {item.type === "donation" ? "Suggested: " : ""}
            {formatAmount(item.amountCents)}
            {item.quantity > 1 ? ` × ${item.quantity}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label htmlFor={`qty-${item.entityId}`} className="sr-only">
            Quantity
          </label>
          <input
            id={`qty-${item.entityId}`}
            type="number"
            min={1}
            value={item.quantity}
            onChange={(e) => onQuantityChange(parseInt(e.target.value, 10) || 1)}
            style={{ width: "4ch", padding: "0.25rem" }}
          />
          <span>{formatAmount(lineTotal)}</span>
          <button
            type="button"
            onClick={onRemove}
            className="btn btn-secondary"
            style={{ padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
