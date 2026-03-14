"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  saved: "Saved.",
  created: "Created.",
  deleted: "Deleted.",
  updated: "Updated.",
  exported: "Export downloaded.",
  restored: "Restored.",
  "developer-setup": "Developer setup updated.",
};

function buildPathWithoutSuccess(pathname: string, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  next.delete("success");
  const q = next.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function SuccessBanner({ successKey }: { successKey?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(!!successKey);

  useEffect(() => {
    if (!successKey) return;
    setVisible(true);
    const t = setTimeout(() => {
      setVisible(false);
      router.replace(buildPathWithoutSuccess(pathname, searchParams));
    }, 4000);
    return () => clearTimeout(t);
  }, [successKey, pathname, router, searchParams]);

  if (!visible || !successKey) return null;

  const message = MESSAGES[successKey] ?? successKey;

  return (
    <div className="banner-success" role="status" aria-live="polite">
      <span>{message}</span>
      <button
        type="button"
        className="banner-success-dismiss"
        onClick={() => {
          setVisible(false);
          router.replace(buildPathWithoutSuccess(pathname, searchParams));
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
