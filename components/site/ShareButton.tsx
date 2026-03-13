"use client";

import { useState } from "react";

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title,
          url,
          text: title,
        });
        return;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      input.setAttribute("readonly", "");
      input.style.position = "absolute";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="btn btn-secondary site-share-btn"
      aria-label={copied ? "Link copied" : "Share or copy link"}
    >
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
