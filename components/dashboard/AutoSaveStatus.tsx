"use client";

import type { AutoSaveStatus } from "@/components/dashboard/useFieldAutoSave";

/**
 * Compact status icon rendered inline next to a field label during auto-save.
 * Idle = invisible placeholder (preserves layout); saving = spinner; saved = check;
 * error = red "!" with tooltip for the detail message.
 */
export function AutoSaveStatusIcon({
  status,
  error,
}: {
  status: AutoSaveStatus;
  error: string | null;
}) {
  if (status === "saving") {
    return (
      <span
        className="field-autosave-icon field-autosave-icon--saving"
        role="status"
        aria-label="Saving"
        title="Saving…"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-6.22-8.56" />
        </svg>
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span
        className="field-autosave-icon field-autosave-icon--saved"
        role="status"
        aria-label="Saved"
        title="Saved"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="field-autosave-icon field-autosave-icon--error"
        role="alert"
        aria-label={error ?? "Couldn’t save"}
        title={error ?? "Couldn’t save"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5" />
          <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
        </svg>
      </span>
    );
  }
  return <span className="field-autosave-icon field-autosave-icon--idle" aria-hidden="true" />;
}
