# Operations

Short notes for running and maintaining the platform.

## Secrets rotation

### CRON_SECRET

Used to protect `/api/cron/webhook-retries`. To rotate:

1. Generate a new value (e.g. `openssl rand -hex 32`).
2. Set the new value in your environment and deploy.
3. Update whatever calls the cron endpoint (Vercel Cron, scheduler, script) to use `Authorization: Bearer <new_value>`.

No data in the database depends on this secret; existing webhook retries keep working.

### INTEGRATION_ENCRYPTION_KEY

Used by `lib/integration-credentials.ts` to encrypt integration credentials (e.g. OAuth tokens) stored in the `integrations` table. To rotate:

1. **Option A (preserve existing connections):** Generate a new 32-byte hex key. Run a one-off script that reads each `Integration` row, decrypts `credentialsEncrypted` with the old key, re-encrypts with the new key, and saves. Then set the new key in env and deploy. Retire the old key.
2. **Option B (simplest):** Set a new key in env and deploy. Existing encrypted credentials will no longer decrypt. Tenants must re-connect their integrations (e.g. QuickBooks) from the dashboard.

Do not commit old or new keys to the repo.

### Session cookie

Dashboard sessions are stored in a cookie as base64url-encoded JSON (no signing key). To invalidate all sessions, change the cookie name in `lib/auth.ts` (e.g. `tasc_session` → `tasc_session_v2`) and deploy; everyone will need to log in again.

## Scheduled jobs

See README **Scheduled jobs (cron)** and [LAUNCH_SETUP.md](LAUNCH_SETUP.md). The only required job is webhook retries: call `GET /api/cron/webhook-retries` with `Authorization: Bearer <CRON_SECRET>` every 5 minutes (or similar).

## Backups

Use your database provider’s backup and point-in-time recovery. The app also supports **Export data (JSON)** per tenant from the dashboard (modules, entities, finance data); use for tenant-level backup or migration.
