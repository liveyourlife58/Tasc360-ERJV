/**
 * Finance settings helpers (read from tenant.settings). Not server actions.
 */

/** Resolve account module slug from tenant settings or default "account". */
export function getAccountModuleSlug(settings: Record<string, unknown> | null): string {
  const finance = (settings?.finance as Record<string, unknown>) ?? {};
  return ((finance.accountModuleSlug as string) || "account").trim() || "account";
}

/** Resolve ledger module slug from tenant settings or default "ledger". */
export function getLedgerModuleSlug(settings: Record<string, unknown> | null): string {
  const finance = (settings?.finance as Record<string, unknown>) ?? {};
  return ((finance.ledgerModuleSlug as string) || "ledger").trim() || "ledger";
}

/** Default ledger entity id from tenant.settings.finance.defaultLedgerEntityId. */
export function getDefaultLedgerEntityId(settings: Record<string, unknown> | null): string | null {
  const finance = (settings?.finance as Record<string, unknown>) ?? {};
  const id = finance.defaultLedgerEntityId as string | undefined;
  return id && typeof id === "string" ? id : null;
}
