"use client";

import Link from "next/link";
import { useSiteCart } from "./SiteCartProvider";

export function CartLink({ tenantSlug }: { tenantSlug: string }) {
  const { count } = useSiteCart();
  return (
    <Link href={`/s/${tenantSlug}/cart`} className="site-nav-cart">
      Cart{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
