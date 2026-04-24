"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEntityFieldValue } from "@/app/dashboard/actions";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Tracks per-field save state. Use `saveNow` for controls that commit on change
 * (select, checkbox, date) and `saveDebounced` for text-like inputs.
 *
 * On success the router is refreshed so the server-rendered activity sidebar
 * (and any revalidated list views) pick up the new event immediately.
 */
export function useFieldAutoSave({
  entityId,
  moduleSlug,
  fieldSlug,
  debounceMs = 700,
  savedIndicatorMs = 1400,
}: {
  entityId: string;
  moduleSlug: string;
  fieldSlug: string;
  debounceMs?: number;
  savedIndicatorMs?: number;
}) {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<unknown>(undefined);
  const inFlightRef = useRef<Promise<void> | null>(null);
  /** Value associated with the currently pending debounce timer, so we can flush on unmount. */
  const pendingValueRef = useRef<unknown>(undefined);
  const hasPendingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
        if (hasPendingRef.current) {
          // Fire-and-forget: push the last typed value so rapid unmounts (tab close,
          // client-side navigation) don't lose unsaved characters.
          void saveEntityFieldValue(entityId, moduleSlug, fieldSlug, pendingValueRef.current);
          hasPendingRef.current = false;
        }
      }
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, [entityId, moduleSlug, fieldSlug]);

  const performSave = useCallback(
    async (value: unknown) => {
      setStatus("saving");
      setError(null);
      const res = await saveEntityFieldValue(entityId, moduleSlug, fieldSlug, value);
      if (!res.ok) {
        setStatus("error");
        setError(res.error);
        return;
      }
      lastSavedRef.current = res.value;
      setStatus("saved");
      startTransition(() => {
        router.refresh();
      });
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => {
        setStatus((s) => (s === "saved" ? "idle" : s));
      }, savedIndicatorMs);
    },
    [entityId, moduleSlug, fieldSlug, router, savedIndicatorMs]
  );

  const saveNow = useCallback(
    (value: unknown) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      hasPendingRef.current = false;
      pendingValueRef.current = undefined;
      inFlightRef.current = performSave(value);
    },
    [performSave]
  );

  const saveDebounced = useCallback(
    (value: unknown) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      setStatus("saving");
      setError(null);
      pendingValueRef.current = value;
      hasPendingRef.current = true;
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        hasPendingRef.current = false;
        pendingValueRef.current = undefined;
        inFlightRef.current = performSave(value);
      }, debounceMs);
    },
    [debounceMs, performSave]
  );

  const flushDebounced = useCallback(
    (value: unknown) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
        hasPendingRef.current = false;
        pendingValueRef.current = undefined;
        inFlightRef.current = performSave(value);
      }
    },
    [performSave]
  );

  return { status, error, saveNow, saveDebounced, flushDebounced };
}
