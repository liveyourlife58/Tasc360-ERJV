"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteSlugError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const slug = pathname?.match(/^\/s\/([^/]+)/)?.[1];

  useEffect(() => {
    console.error("Site error:", error);
  }, [error]);

  const homeHref = slug ? `/s/${slug}` : "/";

  return (
    <div className="site-page site-error-boundary">
      <h1>Something went wrong</h1>
      <p>We couldn’t load this page. You can try again or return to the home page.</p>
      <div className="page-header-actions">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href={homeHref} className="btn btn-secondary">
          Return to home
        </Link>
      </div>
    </div>
  );
}
