"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteNotFound() {
  const pathname = usePathname();
  const slug = pathname?.match(/^\/s\/([^/]+)/)?.[1];
  const homeHref = slug ? `/s/${slug}` : "/";

  return (
    <div className="site-page site-not-found">
      <h1>Page not found</h1>
      <p>The page you’re looking for doesn’t exist or has been moved.</p>
      <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
        <Link href={homeHref} className="btn btn-primary">
          Return to home
        </Link>
      </div>
    </div>
  );
}
