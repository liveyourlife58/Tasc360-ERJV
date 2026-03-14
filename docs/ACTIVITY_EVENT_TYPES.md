# Activity / audit event types

The **Activity** log (Dashboard → Activity) and audit exports show records from the `events` table. Each record has an **eventType** and optional **data** and **createdBy**. Use these values to filter or build reports.

| eventType | When it's recorded | data (typical) | createdBy |
|-----------|--------------------|----------------|-----------|
| **auth_login** | User signs in (dashboard) | `{ email }` | User who logged in |
| **auth_password_reset_requested** | Someone requests a password reset (forgot-password form) | `{ email }` | null |
| **auth_password_reset_completed** | User completes password reset (reset-password form) | `{ userId }` | User who reset |
| **user_invited** | Admin invites a user by email (Subscription → Add user, invite only) | `{ invitedUserId, email }` | Inviter |
| **user_updated** | Admin changes a user's role or active status (Subscription) | `{ userId, ... }` | Admin |
| **order_refunded** | Admin refunds an order (ticket/order details → Refund) | `{ orderId }` | Admin |
| **api_key_created** | Someone creates an API key (Settings → API access) | `{ apiKeyId, name }` | Creator |
| **api_key_revoked** | Someone revokes an API key | `{ apiKeyId, name }` | Revoker |
| **entity_created** | Entity created (dashboard or **API**) | Dashboard: entity metadata. API: `{ source: "api", moduleSlug?, apiKeyPrefix? }` | Dashboard user, or null for API |
| **entity_updated** | Entity updated (dashboard or **API**). Bulk API updates: one event with `updatedCount` and `entityIds`. | Dashboard: entity metadata. API single: `{ source: "api", moduleSlug?, apiKeyPrefix? }`. API bulk: `{ source: "api", apiKeyPrefix?, moduleSlug?, updatedCount, entityIds }` | Dashboard user, or null for API |
| **entity_deleted** | Entity soft-deleted (dashboard or **API**) | Dashboard: entity metadata. API: `{ source: "api", moduleSlug?, apiKeyPrefix? }` | Dashboard user, or null for API |
| **stripe_webhook_processed** | Stripe webhook (platform or Connect) processed successfully | `{ stripeEventId, type }` (Stripe event id and type) | null (system) |
| **integration_connected** | Tenant connects an integration (e.g. QuickBooks Online) | `{ provider }` (e.g. qbo) | User who connected |
| **integration_disconnected** | Tenant disconnects an integration | `{ provider }` | User who disconnected |
| **integration_sync_completed** | Sync job to/from an integration finished successfully | `{ provider, direction?, entityCount? }` | null (system) or user if manual |
| **integration_sync_failed** | Sync job failed (e.g. API error) | `{ provider, error?, direction? }` | null (system) |
| **journal_entry_created** | User creates a journal entry (Finance) | `{ journalEntryId, entryDate, lineCount }` | User who created |
| **fiscal_period_closed** | User closes a fiscal period (Finance) | `{ fiscalPeriodId, periodStart, periodEnd }` | User who closed |
| **developer_setup_enabled** | Platform admin enables “Developer setup” for the tenant (API keys, webhooks, Integrations visible) | `{ enabled: true }` | Platform admin |
| **developer_setup_disabled** | Platform admin disables “Developer setup” for the tenant | `{ enabled: false }` | Platform admin |

## Filtering

- In the Activity UI you can filter by **Event** (eventType), **User** (createdBy), **Module** (via entity), and date range.
- CSV export uses the same filters; the export includes columns: Time, Event, User, Module, Entity ID.

## Source

- **Dashboard** actions set **createdBy** to the acting user and often put entity or action details in **data**.
- **API** mutations set **createdBy** to null and **data** includes `source: "api"` and optionally **apiKeyPrefix** (first 12 chars of the key) and **moduleSlug** for entity events.

## Retention

Events are stored **indefinitely** in the database. For high-volume tenants, consider a retention policy or archival (e.g. periodic job to delete or move events older than 90 days) to control storage and keep the Activity UI fast.
