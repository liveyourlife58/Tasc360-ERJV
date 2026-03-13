"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "cookieBannerDismissed";

export function CookieBanner({
  show,
  tenantSlug,
  policyUrl,
}: {
  show: boolean;
  tenantSlug: string;
  policyUrl?: string | null;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) return;
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [show]);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="site-cookie-banner"
      role="dialog"
      aria-label="Cookie notice"
    >
      <p className="site-cookie-banner-text">
        We use cookies to improve your experience. By continuing you agree to our use of cookies.
        {policyUrl ? (
          <> <Link href={policyUrl} className="site-cookie-banner-link">Privacy policy</Link></>
        ) : (
          <> <Link href={`/s/${tenantSlug}/contact`} className="site-cookie-banner-link">Contact</Link> us with questions.</>
        )}
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="btn btn-primary btn-sm site-cookie-banner-dismiss"
      >
        Accept
      </button>
    </div>
  );
}
