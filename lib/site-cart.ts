/**
 * Customer site cart: types and localStorage key.
 * Cart is stored per tenant (slug) so each site has its own cart.
 */

export type SiteCartItem = {
  entityId: string;
  segment: string;
  moduleSlug: string;
  title: string;
  amountCents: number;
  type: "payment" | "donation";
  quantity: number;
};

export function getCartStorageKey(tenantSlug: string): string {
  return `site-cart-${tenantSlug}`;
}

export function loadCartFromStorage(tenantSlug: string): SiteCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getCartStorageKey(tenantSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is SiteCartItem =>
        x &&
        typeof x === "object" &&
        typeof (x as SiteCartItem).entityId === "string" &&
        typeof (x as SiteCartItem).segment === "string" &&
        typeof (x as SiteCartItem).amountCents === "number" &&
        ((x as SiteCartItem).type === "payment" || (x as SiteCartItem).type === "donation") &&
        typeof (x as SiteCartItem).quantity === "number"
    );
  } catch {
    return [];
  }
}

export function saveCartToStorage(tenantSlug: string, items: SiteCartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getCartStorageKey(tenantSlug), JSON.stringify(items));
  } catch {
    // ignore
  }
}
