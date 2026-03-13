"use client";

import { useEffect } from "react";

/**
 * Injects <link rel="alternate" type="application/atom+xml"> into document head
 * so browsers and feed readers can discover the feed.
 */
export function FeedDiscovery({
  feedHref,
  title,
}: {
  feedHref: string;
  title: string;
}) {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.type = "application/atom+xml";
    link.title = title;
    link.href = feedHref;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [feedHref, title]);
  return null;
}
