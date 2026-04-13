/**
 * Parse `highlightRules` JSON from the Manage fields form.
 * Shape matches tenant API / Frontend `lib/field-highlight.ts`.
 */

import { normalizeHighlightTone, sanitizeHighlightColor } from "@/lib/field-highlight";

const WHEN_OPS = new Set([
  "equals",
  "oneOf",
  "contains",
  "empty",
  "nonEmpty",
  "gt",
  "gte",
  "lt",
  "lte",
  "between",
  "betweenDates",
  "before",
  "after",
  "deadlinePassed",
  "deadlineNotPassed",
  "deadlineDueToday",
  "deadlineDueWithinDays",
  "isTrue",
  "isFalse",
]);

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export type ParsedHighlightRules = { ok: true; rules: Record<string, unknown>[] } | { ok: false; error: string };

export function parseHighlightRulesJsonField(raw: string | null | undefined): ParsedHighlightRules {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return { ok: true, rules: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    return { ok: false, error: "Highlight rules: invalid JSON." };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "Highlight rules: must be a JSON array." };
  }

  const rules: Record<string, unknown>[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (!isRecord(row)) {
      return { ok: false, error: `Highlight rules: item ${i + 1} must be an object.` };
    }
    const when = row.when;
    if (!isRecord(when) || typeof when.op !== "string" || !WHEN_OPS.has(when.op)) {
      return { ok: false, error: `Highlight rules: item ${i + 1} has invalid "when.op".` };
    }
    let colorsOut: Record<string, string> | undefined;
    const rawColors = row.colors;
    if (rawColors && typeof rawColors === "object" && !Array.isArray(rawColors)) {
      const co = rawColors as Record<string, unknown>;
      const bg = sanitizeHighlightColor(co.background);
      const ac = sanitizeHighlightColor(co.accent);
      if (bg || ac) {
        colorsOut = {};
        if (bg) colorsOut.background = bg;
        if (ac) colorsOut.accent = ac;
      }
    }
    const variantRaw = row.variant;
    const toneNorm =
      typeof variantRaw === "string" ? normalizeHighlightTone(variantRaw) : null;
    const variantOk = toneNorm !== null;
    if (!variantOk && !colorsOut) {
      return {
        ok: false,
        error: `Highlight rules: item ${i + 1} needs a valid "variant" (blue, green, amber, red, gray — or legacy info, success, warning, danger, neutral) or a "colors" object with "background" and/or "accent" (hex #rgb / #rrggbb or transparent).`,
      };
    }
    const outRow: Record<string, unknown> = {
      when,
      variant: toneNorm ?? "gray",
      ...(colorsOut ? { colors: colorsOut } : {}),
    };
    if (typeof row.whenFieldSlug === "string" && row.whenFieldSlug.trim() !== "") {
      outRow.whenFieldSlug = row.whenFieldSlug.trim();
    }
    if (Array.isArray(row.highlightFieldSlugs)) {
      const slugs = row.highlightFieldSlugs.filter((x): x is string => typeof x === "string" && x.trim() !== "");
      if (slugs.length > 0) outRow.highlightFieldSlugs = slugs.map((s) => s.trim());
    }
    rules.push(outRow);
  }

  return { ok: true, rules };
}

/** Apply parsed rules to merged field settings (omit key when empty). */
export function assignHighlightRulesToSettings(
  merged: Record<string, unknown>,
  rules: Record<string, unknown>[]
): void {
  if (rules.length === 0) delete merged.highlightRules;
  else merged.highlightRules = rules;
}
