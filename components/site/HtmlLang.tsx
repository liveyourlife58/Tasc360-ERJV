"use client";

import { useEffect } from "react";

/**
 * Sets document.documentElement.lang from tenant locale for the customer site.
 * Improves accessibility and SEO when tenant has a locale in settings.
 */
export function HtmlLang({ locale }: { locale?: string | null }) {
  useEffect(() => {
    const lang = locale && locale.trim() ? locale.trim() : "en";
    const root = document.documentElement;
    const previous = root.getAttribute("lang");
    root.setAttribute("lang", lang);
    return () => {
      root.setAttribute("lang", previous ?? "en");
    };
  }, [locale]);
  return null;
}
