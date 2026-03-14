/**
 * Convention for storing external system ids (e.g. QuickBooks, Xero) on our records.
 * Entities: use entity.metadata.externalIds[provider].
 * See docs/QBO_INTEGRATION_READINESS.md.
 */

export type ExternalIdsMap = Record<string, string>;

const EXTERNAL_IDS_KEY = "externalIds";

export function getExternalId(metadata: Record<string, unknown> | null | undefined, provider: string): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const ids = metadata[EXTERNAL_IDS_KEY];
  if (!ids || typeof ids !== "object") return null;
  const val = (ids as Record<string, unknown>)[provider];
  return typeof val === "string" && val.trim() !== "" ? val.trim() : null;
}

export function setExternalId(metadata: Record<string, unknown>, provider: string, externalId: string): Record<string, unknown> {
  const ids = (metadata[EXTERNAL_IDS_KEY] as Record<string, unknown>) ?? {};
  const next = { ...ids, [provider]: externalId };
  return { ...metadata, [EXTERNAL_IDS_KEY]: next };
}

export function removeExternalId(metadata: Record<string, unknown>, provider: string): Record<string, unknown> {
  const ids = (metadata[EXTERNAL_IDS_KEY] as Record<string, unknown>) ?? {};
  const { [provider]: _, ...rest } = ids;
  if (Object.keys(rest).length === 0) {
    const { [EXTERNAL_IDS_KEY]: __, ...metaRest } = metadata;
    return metaRest;
  }
  return { ...metadata, [EXTERNAL_IDS_KEY]: rest };
}
