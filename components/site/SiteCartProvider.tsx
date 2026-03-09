"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  loadCartFromStorage,
  saveCartToStorage,
  type SiteCartItem,
} from "@/lib/site-cart";

type SiteCartContextValue = {
  items: SiteCartItem[];
  count: number;
  addItem: (item: Omit<SiteCartItem, "quantity"> & { quantity?: number }) => void;
  removeItem: (entityId: string) => void;
  updateQuantity: (entityId: string, quantity: number) => void;
  clearCart: () => void;
};

const SiteCartContext = createContext<SiteCartContextValue | null>(null);

export function useSiteCart(): SiteCartContextValue {
  const ctx = useContext(SiteCartContext);
  if (!ctx) throw new Error("useSiteCart must be used within SiteCartProvider");
  return ctx;
}

export function SiteCartProvider({
  tenantSlug,
  children,
}: {
  tenantSlug: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<SiteCartItem[]>([]);

  useEffect(() => {
    setItems(loadCartFromStorage(tenantSlug));
  }, [tenantSlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    saveCartToStorage(tenantSlug, items);
  }, [tenantSlug, items]);

  const addItem = useCallback(
    (item: Omit<SiteCartItem, "quantity"> & { quantity?: number }) => {
      const qty = Math.max(1, item.quantity ?? 1);
      setItems((prev) => {
        const i = prev.findIndex((x) => x.entityId === item.entityId);
        if (i >= 0) {
          const next = [...prev];
          next[i] = { ...next[i], quantity: next[i].quantity + qty };
          return next;
        }
        return [...prev, { ...item, quantity: qty }];
      });
    },
    []
  );

  const removeItem = useCallback((entityId: string) => {
    setItems((prev) => prev.filter((x) => x.entityId !== entityId));
  }, []);

  const updateQuantity = useCallback((entityId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((x) =>
        x.entityId === entityId
          ? { ...x, quantity: Math.max(0, quantity) }
          : x
      ).filter((x) => x.quantity > 0)
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
    }),
    [items, addItem, removeItem, updateQuantity, clearCart]
  );

  return (
    <SiteCartContext.Provider value={value}>
      {children}
    </SiteCartContext.Provider>
  );
}
