# Gaps and Improvements: DB Design vs Implementation

This document tracks what is **done** vs **still missing or partial** relative to the database schema and product plan. Use it to prioritize next work.

**Last updated:** Developer setup (per-tenant flag + `settings:developer` permission), platform admin UI (`/dashboard/platform`), provider doc ([PROVIDER.md](PROVIDER.md)), audit for developer_setup toggle, operations doc ([OPERATIONS.md](OPERATIONS.md)) and cron/secrets-rotation notes, tenant isolation E2E test. Earlier: Integration prep, Integrations page, File field sync, Edit View filter/sort, Consent UI, Team page, E2E smoke tests, etc.

---

## 1. Schema vs UI — current state

| Area | Status | Note |
|------|--------|------|
| **Relationships** | **Done** | Relation fields sync to `relationships` on save. Entity detail shows “Related records”; `GET .../entities/:id/related` in API. |
| **Roles & permissions** | **Done** | `requireDashboardPermission` in dashboard actions. Users with no role get full access. |
| **Events / audit** | **Done** | Entity create/update/delete write to `events`. Dashboard: entity “Activity” and tenant-wide Activity page. |
| **Soft delete & restore** | **Done** | Delete = soft delete. “Show deleted” view and Restore button. |
| **Tenant billing** | **Done** | Stripe platform billing, Subscription page, gating with grace period. |
| **Views (list/board/calendar)** | **Done** | List, board (Kanban), calendar views; edit view name, columns, view type, board/date field. |
| **Field config** | **Done** | Manage fields: add, edit (inline), reorder, remove (blocked if entity data exists). |
| **Webhooks** | **Done** | `lib/webhooks` + Settings → Webhooks (URL, secret). Fired on entity create/update/delete. |
| **Export / import** | **Done** | Export data (JSON) from dashboard; Import from same JSON (modules + entities). |
| **Clone entity** | **Done** | “Clone” on entity edit creates a copy (same module, data, relationships). |
| **Entity metadata** | Partial | Used for payment/capacity etc.; not exposed as generic key/value in forms. |
| **Files** | **Done** | File-type fields use BlobUploadInput; on entity create/update, URLs are synced to `files` table (one row per field, `metadata.fieldSlug`). |
| **Users & roles (admin)** | **Done** | **Team** page: list users, invite, edit user (role, active), create/edit roles and permissions. |
| **Consent** | **Done** | Settings → Consent types (comma-separated). **Consent** page: list consents (filter by user/type), revoke, grant (record consent). |
| **Integrations** | Prep done | Integration table, JE externalId, credentials encryption, external-ids helpers, audit event types. **Integrations** page lists connections; connect flows (e.g. QuickBooks) to be added. |
| **Developer setup / Platform admin** | **Done** | Per-tenant `allowDeveloperSetup`; `settings:developer` permission; API keys, Webhooks, Integrations gated. Platform admins (`PLATFORM_ADMIN_EMAILS`) can toggle via Settings or **Platform admin** page. See [PROVIDER.md](PROVIDER.md). |
| **Other domain tables** | As needed | Approval (UI done), TimeEntry, JournalEntry (UI done), recurring, etc. — add UI as needed. |

---

## 2. Plan vs implementation

| Plan item | Status | Note |
|-----------|--------|------|
| Board / calendar views | **Done** | EntityBoard (Kanban), EntityCalendar; view type and settings in Edit View. |
| Edit view (filter, sort, columns) | **Done** | Name, columns, view type, board/date field, **filters** (field, op, value), and **sort** (field, dir) in Edit View form; applied in list/export. |
| API: GET/POST/PATCH/DELETE, bulk PATCH | **Done** | See [TENANT_API.md](TENANT_API.md). |
| Webhooks | **Done** | Library + Settings UI + delivery logging. |
| Vertical templates | **Done** | Template picker; apply creates modules, fields, default views. |
| Error boundaries | **Done** | Dashboard and customer site (`/s`) have error boundaries. |
| Pagination | **Done** | Dashboard entity list (in-memory slice + page links); API cursor pagination. |
| Seed / first tenant | **Done** | `npm run db:seed` creates demo tenant + admin user (`prisma/seed.js`). |
| Explain / summarize AI | **Done** | “Ask about your data” (FTS/hybrid + RAG). |
| Custom domain | **Done** | `tenant.settings.site.customDomain`; root redirects to `/s/[slug]`. |
| CORS for tenant API | **Done** | Middleware adds CORS for `/api/v1/*`; `CORS_ORIGIN` env. |
| Onboarding (no modules) | **Done** | “What’s your business?” with templates + “Describe a custom module” (AI). |
| Feature flags in dashboard settings | **Done** | Settings → Feature flags (e.g. myOrders, refunds) in `tenant.settings.features`. |
| Full filter/sort UI in Edit View | **Done** | Edit View form includes filter conditions (field, op, value) and sort (field, dir). |
| Users & roles dashboard | **Done** | **Team** page: list users, add user, invite by email, edit user (role, active, password). **Roles** section: list roles, create role, edit role (name, description, permissions). Sidebar: Team + Subscription & billing. |
| Developer setup (per tenant) | **Done** | API keys, Webhooks, Integrations hidden by default; `allowDeveloperSetup` + `settings:developer`; platform admin toggle; [PROVIDER.md](PROVIDER.md). |
| Platform admin UI | **Done** | `/dashboard/platform` lists all tenants and toggles “Allow developer setup”; sidebar link for `PLATFORM_ADMIN_EMAILS` users. |
| Cron / scheduled jobs | **Done** | Webhook retries: `GET /api/cron/webhook-retries` with `CRON_SECRET`; documented in README and [OPERATIONS.md](OPERATIONS.md). |
| Tenant isolation check | **Done** | E2E test (optional): `E2E_TENANT_ISOLATION_A_KEY` + `E2E_TENANT_ISOLATION_B_SLUG` assert 401 when key for A is used for B. |
| Secrets rotation | **Done** | [OPERATIONS.md](OPERATIONS.md) documents rotating CRON_SECRET and INTEGRATION_ENCRYPTION_KEY. |

---

## 3. Security (vs SECURITY.md)

| Item | Status | Note |
|------|--------|------|
| Login lockout | **Done** | Failed attempts → lockout; reset on success. |
| Authorization | **Done** | `requireDashboardPermission` in dashboard actions. |
| Tenant from session/path/API key | **Done** | No tenant from client for privilege escalation. |
| API key storage | Plaintext | Stored in `tenant.settings.apiKey`. Optional: hash and compare. |
| Read permission | **Done** | Dashboard enforces `entities:read` on entity list and entity detail pages; users without it get 404. |
| RLS | Optional | Not enabled; optional defense-in-depth. |

---

## 4. UX and robustness

| Area | Status |
|------|--------|
| Pagination (dashboard list) | **Done** |
| View edit/delete | **Done** (with confirm for delete) |
| Entity delete (soft) | **Done**; Restore **done** |
| Module/field reorder | **Done** (fields); modules use sortOrder (reorder in settings or DB) |
| Dashboard Settings | **Done** (API key, webhook URL, branding, etc.) |
| Error boundaries | **Done** (dashboard + customer site) |
| Loading states | **Done** (skeletons, loading buttons where needed) |
| Success feedback | **Done** (success banners, URL params) |
| Public form rate limit / captcha | **Done** (in-memory rate limit by tenant + IP on form submit); captcha optional. |

---

## 5. Bootstrap and ops

| Area | Status |
|------|--------|
| Seed / first tenant | **Done** — `npm run db:seed` |
| Env validation | **Done** — `instrumentation.ts` + `lib/env.ts` (requires `DATABASE_URL`) |
| App config | **Done** — `lib/app-config.ts` for layout/UI constants |
| Backup/export | **Done** — Export JSON from dashboard; Import from same format |

---

## 6. Summary

| Category | Remaining gaps (high level) |
|----------|-----------------------------|
| **UI** | Entity metadata as generic key/value in forms (optional) |
| **Security** | API key hashing (optional), RLS (optional) |
| **UX** | Public form rate limit / captcha (optional) |
| **Product** | Recurring job runner for recurring_schedules (optional) |

**Suggested next steps (if continuing)**  
1. **API key hashing** and optional read-permission enforcement if you need stricter security or read-only roles.  
2. **Entity metadata:** Expose generic metadata key/value in entity forms for power users.  
3. **Recurring:** Cron or job to create entities from recurring_schedules (e.g. monthly invoices).
