# QuickBooks Online (QBO) integration readiness

This doc describes what is in place **now** to make a future QuickBooks Online integration easier, and how that integration should use the app.

## 1. Where integration state lives

- **Per-tenant, per-provider:** Use the **`Integration`** table.
  - One row per tenant per provider (e.g. `provider = 'qbo'`).
  - **`config`** (JSON): store non-secret settings, e.g. `realmId` (QB company id), sync preferences, last cursor, etc.
  - **`credentialsEncrypted`** (text): store OAuth refresh/access tokens encrypted at rest. Use your app’s encryption (e.g. env `INTEGRATION_ENCRYPTION_KEY`) or a secrets manager.
  - **`lastSyncedAt`**: optional; useful for incremental sync or UI.

- **Tenant ↔ QB company:** 1:1. One tenant = one QB “realm” (company). Store `realmId` in `Integration.config` when the tenant connects their QB company.

## 2. Mapping our data to QuickBooks

When you build the integration, use this as the mapping plan:

| Our system | QuickBooks Online | Notes |
|------------|-------------------|--------|
| **Entity** (module e.g. “Customer”) | Customer | Use `entity.metadata.externalIds.qbo` to store QB Customer Id. |
| **Entity** (module e.g. “Invoice”) | Invoice | Same; store QB Invoice Id in `entity.metadata.externalIds.qbo`. Line items from entity data or related line-item entities. |
| **Payment** | Payment | We already have `Payment.externalId` (Stripe). For QB, store QB Payment Id in `externalId` or add `metadata` JSON and use `metadata.qboId`. |
| **JournalEntry** + **LedgerLine** | JournalEntry | Map our JE + lines to QB JE. Store QB JournalEntry Id on our side (e.g. `JournalEntry` model: add `externalId` or use a small `journal_entry_sync` table: our id ↔ qbo id). |
| **Account** (entity in Account module) | Account | Store QB Account Id in `entity.metadata.externalIds.qbo` so we can map our accounts to QB’s chart of accounts. |

- **Stable IDs:** Our entities and journal entries use UUIDs; use these as the source of truth. Store QB’s ids in our DB so we can do upserts and avoid duplicates (idempotency).

## 3. External ID convention

- **Entities:** Store QB ids in `entity.metadata.externalIds`:
  - `metadata.externalIds = { qbo: "123" }` for the QB entity id.
  - Use a single key per provider so other integrations (e.g. Xero) can use `xero`, etc.
- **Payments:** Already have `externalId`; can reuse for QB Payment id or add a `metadata` JSON column later if you need both Stripe and QB ids.
- **JournalEntry:** Use `JournalEntry.externalId` (column exists) to store QB JournalEntry id when syncing JEs.

## 4. What to do when building the integration

1. **Connect flow:** OAuth 2.0 with QB; store refresh/access token in `Integration.credentialsEncrypted` (encrypted) and `realmId` in `Integration.config`.
2. **Push/sync:** When creating or updating records in QB, set our UUID (or business key) so we can idempotently update. Store the returned QB id in the right place (`entity.metadata.externalIds.qbo`, `Payment.externalId`, or JournalEntry external id).
3. **Webhooks (optional):** QB can send webhooks; add a route e.g. `POST /api/webhooks/qbo` and verify signature. Use the same idempotency patterns as Stripe (e.g. event id in a processed-events table) to avoid duplicate handling.
4. **Sync direction:** Decide push-only (us → QB), pull-only (QB → us), or both. Document in this file when you implement.

## 5. Prepared now (no code changes required for you to start)

- **Integration table:** Ready for one row per tenant per provider (e.g. QBO) with `config` and `credentialsEncrypted`.
- **Entity.metadata:** JSON already exists; use `metadata.externalIds.qbo` for QB entity ids. Helpers in `lib/external-ids.ts`: `getExternalId`, `setExternalId`, `removeExternalId`.
- **JournalEntry.externalId:** Column and index exist; use for QB JournalEntry id when syncing JEs.
- **Payment.externalId:** Exists; can store QB Payment id there (or extend with metadata if you need both Stripe and QB).
- **Credentials encryption:** `lib/integration-credentials.ts` — `encryptIntegrationCredentials` / `decryptIntegrationCredentials` for OAuth tokens. Set `INTEGRATION_ENCRYPTION_KEY` (32-byte hex, e.g. `openssl rand -hex 32`) in env.
- **Idempotency:** Existing API idempotency patterns can be reused for sync jobs (e.g. “sync invoice X” keyed by our entity id).
- **Audit:** Log connect/disconnect and sync with event types `integration_connected`, `integration_disconnected`, `integration_sync_completed`, `integration_sync_failed` (see `docs/ACTIVITY_EVENT_TYPES.md`).

## 6. Optional later

- **Webhook route:** Add `/api/webhooks/qbo` when you need real-time updates from QB.
- **Dashboard UI:** “Connect to QuickBooks” that writes to `Integration` and triggers initial sync.
