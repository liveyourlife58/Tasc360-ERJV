"use client";

import { useSiteCart } from "./SiteCartProvider";

type AddToCartButtonProps = {
  tenantSlug: string;
  segment: string;
  moduleSlug: string;
  entityId: string;
  title: string;
  amountCents: number;
  type: "payment" | "donation";
  quantity?: number;
  label?: string;
  /** When set (e.g. capacity limit), cap quantity at this value. */
  maxQuantity?: number;
};

export function AddToCartButton({
  tenantSlug,
  segment,
  moduleSlug,
  entityId,
  title,
  amountCents,
  type,
  quantity = 1,
  label,
  maxQuantity,
}: AddToCartButtonProps) {
  const { addItem } = useSiteCart();

  function handleAdd() {
    const qty = maxQuantity != null ? Math.min(quantity, maxQuantity) : quantity;
    if (qty < 1) return;
    addItem({
      entityId,
      segment,
      moduleSlug,
      title,
      amountCents,
      type,
      quantity: qty,
    });
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      className="btn btn-primary"
      style={{ fontSize: "0.875rem" }}
    >
      {label ?? (type === "donation" ? "Add to cart" : "Add ticket")}
    </button>
  );
}
