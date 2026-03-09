/**
 * Module- and entity-level payment/donation settings.
 * Module: module.settings.paymentType (default for all entities).
 * Entity: entity.metadata.paymentType (override per record: "payment" | "donation" | "none" | omit = use module default).
 */

export type ModulePaymentType = "payment" | "donation" | null;

/** Entity override: "none" = no payment for this record; "payment" | "donation" = require that; omit = use module default. */
export type EntityPaymentType = "payment" | "donation" | "none" | null;

const PAYMENT_TYPE_KEY = "paymentType";
export const ENTITY_PAYMENT_TYPE_KEY = "paymentType";
/** Entity metadata: required when payment type is "payment" (amount in cents). */
export const ENTITY_PRICE_CENTS_KEY = "priceCents";
/** Entity metadata: optional when payment type is "donation" (suggested amount in cents). */
export const ENTITY_SUGGESTED_DONATION_CENTS_KEY = "suggestedDonationAmountCents";

/** Parse decimal string (e.g. "25.99") to cents. Returns null if invalid. */
export function parseDecimalToCents(s: string | null | undefined): number | null {
  if (s == null || typeof s !== "string") return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** Get whether this module's entities require payment, donation, or neither (module default). */
export function getModulePaymentType(module: { settings?: unknown } | null): ModulePaymentType {
  if (!module?.settings || typeof module.settings !== "object") return null;
  const v = (module.settings as Record<string, unknown>)[PAYMENT_TYPE_KEY];
  if (v === "payment" || v === "donation") return v;
  return null;
}

/** Get entity-level payment override from entity.metadata. */
export function getEntityPaymentOverride(entity: { metadata?: unknown } | null): EntityPaymentType {
  if (!entity?.metadata || typeof entity.metadata !== "object") return null;
  const v = (entity.metadata as Record<string, unknown>)[ENTITY_PAYMENT_TYPE_KEY];
  if (v === "payment" || v === "donation" || v === "none") return v;
  return null;
}

/** Effective payment type for this entity: entity override wins, else module default. */
export function getEffectivePaymentType(
  entity: { metadata?: unknown } | null,
  module: { settings?: unknown } | null
): ModulePaymentType {
  const override = getEntityPaymentOverride(entity);
  if (override === "none") return null;
  if (override === "payment" || override === "donation") return override;
  return getModulePaymentType(module);
}

/** Merge paymentType into existing module settings (for updates). */
export function mergeModulePaymentType(
  existingSettings: Record<string, unknown> | null,
  paymentType: ModulePaymentType
): Record<string, unknown> {
  const out = { ...(existingSettings ?? {}) };
  if (paymentType) out[PAYMENT_TYPE_KEY] = paymentType;
  else delete out[PAYMENT_TYPE_KEY];
  return out;
}

/** Get entity price in cents (for payment type). Null if not set. */
export function getEntityPriceCents(entity: { metadata?: unknown } | null): number | null {
  if (!entity?.metadata || typeof entity.metadata !== "object") return null;
  const v = (entity.metadata as Record<string, unknown>)[ENTITY_PRICE_CENTS_KEY];
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return v;
  return null;
}

/** Get entity suggested donation amount in cents (for donation type). Null if not set. */
export function getEntitySuggestedDonationCents(entity: { metadata?: unknown } | null): number | null {
  if (!entity?.metadata || typeof entity.metadata !== "object") return null;
  const v = (entity.metadata as Record<string, unknown>)[ENTITY_SUGGESTED_DONATION_CENTS_KEY];
  if (typeof v === "number" && Number.isInteger(v) && v >= 0) return v;
  return null;
}

/** Merge entity payment override and amount fields into existing entity.metadata (for updates). */
export function mergeEntityPaymentType(
  existingMetadata: Record<string, unknown> | null,
  paymentType: "" | "payment" | "donation" | "none",
  options?: { priceCents?: number | null; suggestedDonationAmountCents?: number | null }
): Record<string, unknown> {
  const out = { ...(existingMetadata ?? {}) };
  if (paymentType === "none" || paymentType === "payment" || paymentType === "donation") {
    out[ENTITY_PAYMENT_TYPE_KEY] = paymentType;
  } else {
    delete out[ENTITY_PAYMENT_TYPE_KEY];
  }
  if (options?.priceCents != null && options.priceCents > 0) {
    out[ENTITY_PRICE_CENTS_KEY] = Math.round(options.priceCents);
  } else {
    delete out[ENTITY_PRICE_CENTS_KEY];
  }
  if (options?.suggestedDonationAmountCents != null && options.suggestedDonationAmountCents > 0) {
    out[ENTITY_SUGGESTED_DONATION_CENTS_KEY] = Math.round(options.suggestedDonationAmountCents);
  } else {
    delete out[ENTITY_SUGGESTED_DONATION_CENTS_KEY];
  }
  return out;
}
