"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Link that highlights when the current route matches `href` (or any of `alsoActivePrefixes`).
 * Lives as a client component so it stays reactive across client-side navigation inside
 * cached server layouts (where a server-rendered `pathname` prop would stay stale).
 */
function matches(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href + "/");
}

export function SidebarActiveLink({
  href,
  baseClassName,
  activeClassName,
  alsoActivePrefixes,
  children,
}: {
  href: string;
  baseClassName: string;
  activeClassName: string;
  /** Extra hrefs that also mark this link active (e.g., "Team & billing" also active for /dashboard/subscription). */
  alsoActivePrefixes?: string[];
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const active = matches(href, pathname) || (alsoActivePrefixes?.some((p) => matches(p, pathname)) ?? false);
  return (
    <Link href={href} className={`${baseClassName} ${active ? activeClassName : ""}`}>
      {children}
    </Link>
  );
}
