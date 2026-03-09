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
}: AddToCartButtonProps) {
  const { addItem } = useSiteCart();

  function handleAdd() {
    addItem({
      entityId,
      segment,
      moduleSlug,
      title,
      amountCents,
      type,
      quantity,
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
