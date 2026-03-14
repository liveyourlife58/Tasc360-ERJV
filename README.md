# Tasc360-ERJV

Multi-tenant platform database with **entity + relationship + JSONB** architecture. Designed for flexibility (user-customizable modules/fields), scalability (tenant-first indexing), and future AI search (embeddings + pgvector).

## Stack

- **PostgreSQL** (UUID primary keys, JSONB, optional pgvector)
- **Prisma** for schema, migrations, and CRUD
- **Raw SQL** where appropriate (e.g. JSONB path queries, vector similarity)

**Supported browsers (dashboard and customer site):** Chrome, Firefox, Safari, and Edge (last two versions).

## Database design

### Core tables

| Table | Purpose |
|-------|--------|
| `tenants` | Multi-tenant root; optional `parent_tenant_id` for franchise/white-label; Stripe fields for billing |
| `users` | Tenant-scoped users; optional `roleId` for permissions |
| `roles` | Per-tenant roles and permissions (customizable) |
| `modules` | User-defined “tables” (e.g. Customers, Jobs, Estimates) |
| `fields` | User-defined columns per module (type, options) |
| `entities` | All business records; `moduleId` + `data` (JSONB); optional `search_text`; `deleted_at` for soft delete |
| `relationships` | Links between entities (e.g. customer → job → invoice) |
| `events` | Audit and activity log (event_type, entity_id, data) |
| `files` | Document attachments keyed by entity_id |
| `payments` | Tenant-facing: payments from the tenant’s customers, linked to an entity (invoice/order); provider config in `tenants.settings` |
| `orders` | Customer-site checkout: one row per order; `purchaser_name`, `purchaser_email`, `total_cents`, `status`. Tracks who bought and when. |
| `order_lines` | One row per entity in an order: `order_id`, `entity_id`, `quantity`, `amount_cents`, `line_type` (payment/donation), `checked_in_quantity`. Tickets sold and check-in per purchaser line. |
| `journal_entries` | General ledger: one row per journal entry; optional `ledger_entity_id` for multi-ledger. |
| `ledger_lines` | Ledger lines: account (entity), debit_cents, credit_cents, optional source_entity_id. Enforce balanced entries in app. |
| `time_entries` | Employee hours: user_id, job_entity_id, optional work_order_entity_id, hours, work_date. Enables hours-by-job and by work order. |
| `approvals` | Approval workflow: entity_id, approval_type, requested_by, status, decided_by, decided_at. For quotes, POs, time-off, expenses. |
| `entity_tags` | Tags on any entity (tenant_id, entity_id, tag). Filter across entity types (e.g. “all with tag vip”). |
| `recurring_schedules` | Recurring items: entity_id (template), frequency, next_run_at. For recurring invoices, subscriptions; app generates from template. |
| `payment_allocations` | One payment applied to multiple invoices (payment_id, entity_id, amount_cents). Clean AR “amount applied per invoice”. |
| `views` | Saved views: module_id, view_type (list/board/calendar), filter/sort/columns as JSON. No new schema; same entity queries. |
| `exchange_rates` | Multi-currency: tenant, from/to currency, rate, effective_date. |
| `fiscal_periods` | Period close: tenant, period_start/end, closed_at; app blocks new entries when closed. |
| `consents` | GDPR/marketing: tenant, user, consent_type, granted_at, revoked_at, source. |
| `embeddings` | AI search: content, chunking, model name, source field; vector column via raw SQL |

### Multi-tenancy

- **Every** tenant-scoped table has `tenant_id` (UUID, FK to `tenants`).
- **Composite indexes** start with `tenant_id` (e.g. `(tenant_id, module_id)`) so queries always narrow by tenant first.
- Application layer must **always** filter by `tenant_id` (from session); consider RLS in PostgreSQL for defense-in-depth.

### Customization (modules + fields)

- Tenants create **modules** (e.g. “Customers”, “Jobs”, “Invoices”) with a unique `slug` per tenant.
- Each module has **fields** (name, slug, field_type, settings). Field types: `text`, `number`, `date`, `boolean`, `select`, `relation`, `file`, `json`.
- **Entities** store the actual rows: `module_id` + `data` (JSONB). The shape of `data` is driven by the module’s fields (validated in app logic or a shared schema layer).
- This allows “Notion-style” customization: new modules and fields without DB migrations.

### Domains (inspired by swad-app-emp / fabrication)

The same schema supports:

- **CRM**: entities with `module.slug = 'lead' | 'opportunity' | 'contact'`; relationships (lead → opportunity, opportunity → contact).
- **Jobs / work orders**: entity type e.g. `job`; `data` holds title, status, scheduled_date, etc.; relationship `customer → job`.
- **Estimates**: entity type `estimate`; `data` holds status, total, bill_to, ship_to, line items (or link to entity lines via relationships).
- **Invoices / payments**: entity types `invoice`, `payment`; relationships `job → invoice`, `invoice → payment`.
- **Inventory / products / vendors**: entities for product, vendor, location; relationships product → vendor; for detailed inventory (cost layers, movements), consider **hybrid** relational tables alongside entities.
- **Documents**: `files` table with `entity_id`; attach to any entity (job, estimate, customer).
- **Nonprofit**: donors, donations, designations, campaigns, grants, programs, fund accounting, volunteer hours (as entities or via optional `time_entries` extension). See [docs/NONPROFIT.md](docs/NONPROFIT.md).
- **Fabrication / door config**: store configuration as JSONB in entity `data` (e.g. under an `estimate` or `job` entity), or as a dedicated module “FabricationOrder” with fields defined per tenant.

### Customer site: tickets, cart & checkout

The customer-facing site (`/s/[tenantSlug]`) supports **tickets and donations** for entities that have a price or suggested donation (module/entity payment settings):

- **Cart** (localStorage, per tenant): Add tickets or donation items from list or entity detail; cart link in nav shows count.
- **Checkout:** Collect purchaser name and email; place order. If the tenant has Stripe Connect enabled and the cart total > 0, the customer is redirected to Stripe Checkout; on success the order is completed and a **Payment** is recorded. Otherwise the order is created as completed (e.g. free or donation-only).
- **Dashboard**: Entity list shows "Price / Donation" and **"X sold"** (clickable). Click opens a modal with ticket details per purchaser (name, email, qty, amount, type, date) and **checked-in** count per line. Check-in is editable in the modal (saves on blur). Entity edit page shows "Tickets / orders" with total sold, total checked in, and "X/Y checked in" per purchaser.
- **Delete guards**: A **module** cannot be deleted if it has any entities. A **field** cannot be deleted if any entity in that module has data for that field. An **entity** cannot be deleted if 1 or more tickets have been sold (friendly error: "Refund or transfer tickets first"). Module delete is also enforced at the DB (Entity → Module FK `ON DELETE RESTRICT`).

**Stripe:** Platform billing (tenant subscription) and tenant-facing payments (Stripe Connect) are implemented; see [docs/BILLING_STRIPE.md](docs/BILLING_STRIPE.md) and [docs/TENANT_PAYMENTS.md](docs/TENANT_PAYMENTS.md).

### Indexing and scalability

- **Already in init migration**: `tenant_id`-first indexes on all tenant tables, GIN on `entities.data` and `relationships.data`, FTS on `entities.search_text`, composite indexes for list/sort/filter (e.g. tenant + module + created_at, tenant + module + deleted_at).
- The design follows **best practices for multi-tenant scalability and performance**; see [docs/SCALABILITY_PERFORMANCE.md](docs/SCALABILITY_PERFORMANCE.md) for what’s in place, app responsibilities (pagination, pooling, tenant filter), and optional tuning.
- **Optional (commented at end of init migration):** pgvector (vector column + index on `embeddings`) and Row-Level Security. Uncomment when needed.
- **Optional pgvector** (commented in same migration). Example when enabled:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS embedding vector(1536);
  CREATE INDEX idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  ```
  Use raw SQL for similarity search; Prisma continues to manage the rest of the table.

---

## AI readiness

The schema follows best practices for **RAG, semantic search, and hybrid search**:

| Practice | How it's supported |
|----------|--------------------|
| **Vector search** | `embeddings` table with `entity_id`, `content`; add `embedding vector(1536)` via raw SQL migration (pgvector). |
| **Chunking** | `embeddings.chunk_index`, `embeddings.chunk_count` so one entity can have multiple chunks; order and total are explicit. |
| **Model versioning** | `embeddings.model_name` (e.g. `text-embedding-3-small`) so you can re-embed when the model changes. |
| **Citation** | `embeddings.source_field` records which part of the entity (e.g. "description", "notes") the chunk came from. |
| **Hybrid search** | `entities.search_text` holds denormalized text; migration adds GIN FTS index. Combine keyword (FTS) + vector similarity in the app. |
| **Tenant isolation** | All embeddings are tenant-scoped; indexes include `tenant_id` first. |
| **Context for RAG** | `events` table gives activity/audit context per entity; query by `entity_id` for "recent actions" when building prompts. |

**To enable AI (semantic search and "Ask about your data"):** Set `OPENAI_API_KEY` in env and run the pgvector migration (`prisma/migrations/20260313110000_add_pgvector_embeddings`). That enables embedding generation on entity save and hybrid (FTS + vector) search for the dashboard "Ask about your data" feature. Without it, Ask AI still works using full-text search only.

**Application responsibilities:**

- **Populate `entities.search_text`** when saving an entity (e.g. concatenate title, description, notes from `data`). Use it for FTS and as the default source for embedding content.
- **Store embedding model name** when writing to `embeddings` so you can bulk re-embed by `model_name` after upgrading.
- **Use raw SQL** for vector similarity (pgvector) and for FTS queries on `search_text`; use Prisma for CRUD and simple filters.
- For **entity + relationship + JSONB + vector at full potential** (edge attributes, relationship-level embeddings, hybrid FTS+vector), see [docs/DATABASE_DESIGN.md#entity--relationship--jsonb--vector-using-to-full-potential](docs/DATABASE_DESIGN.md).

---

## Security

The schema supports common security best practices; the application must enforce them.

| Practice | In the schema | Application responsibility |
|----------|----------------|----------------------------|
| **Multi-tenant isolation** | `tenant_id` on every table; indexes tenant-first | Always filter by `tenant_id` from **session**, never from client. Consider [RLS](docs/SECURITY.md#row-level-security) for defense-in-depth. |
| **Passwords** | `password_hash` only (no plaintext) | Hash with bcrypt/argon2 before save; never log or expose hash. |
| **Account lockout** | `failed_login_attempts`, `account_locked`, `locked_until` on users | Increment on failed login; reset on success; block login when locked. |
| **Audit** | `events` table; `created_by` on entities/events | Log sensitive actions; use `event_type` and `data` for forensics. |
| **IDs** | UUID primary keys | Reduces enumeration; no sequential guessing. |
| **Cascades** | Delete tenant → cascade all tenant data | Supports right-to-erasure (e.g. GDPR). |

**Critical:** Never trust `tenant_id` (or any tenant scope) from the request body or URL. Resolve tenant from the authenticated session only. See [docs/SECURITY.md](docs/SECURITY.md) for RLS, secrets, and sensitive data.

**Who sets up what after launch:** Developers own infra, auth, platform billing, and integrations; tenants can configure modules, fields, views, users/roles, and all business data in the app. See [docs/LAUNCH_SETUP.md](docs/LAUNCH_SETUP.md). **Future-proofing:** Soft delete, tenant hierarchy, consent, and multi-ledger support the widest range of businesses; see [docs/FUTURE_PROOFING.md](docs/FUTURE_PROOFING.md). **UI/UX plan (Next.js, multi-tenant dashboard + customer site, AI-assisted):** [docs/UI_UX_MULTITENANT_PLAN.md](docs/UI_UX_MULTITENANT_PLAN.md).

### Billing (Stripe)

**Platform billing:** Tenants can be charged via Stripe in two ways: **per-user** (subscription quantity = active user count) or **set price** (fixed amount, e.g. $99/month). The schema has `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, and `subscription_current_period_end` on `tenants`; same fields for both models. See [docs/BILLING_STRIPE.md](docs/BILLING_STRIPE.md) for flows and webhooks.

**Tenant-facing payments:** Tenants can connect their own payment provider (Stripe Connect, Square, etc.) to charge **their** customers. Provider config lives in `tenants.settings`; each payment is recorded in `payments` with `entity_id` (invoice/order). See [docs/TENANT_PAYMENTS.md](docs/TENANT_PAYMENTS.md).

**Tenant accounting:** Invoicing, AR, AP, and a **general ledger** (double-entry) are supported: `journal_entries` + `ledger_lines` (accounts are entities, e.g. module “Account”). P&L and balance sheet can be derived from the ledger. See [docs/ACCOUNTING.md](docs/ACCOUNTING.md).

**Work orders and employee hours:** Jobs and work orders are entities (e.g. modules "Job", "WorkOrder"); link work orders to a job via a relationship (`job_work_order`). **`time_entries`** stores hours per user (employee), per job, and optionally per work order — for reporting by job, person, or date.

**Approvals, tags, recurring, views, allocations, multi-currency, period close:** **`approvals`**, **`entity_tags`**, **`recurring_schedules`**; **`views`** (saved list/board/calendar); **`payment_allocations`** (one payment → many invoices); **`exchange_rates`**; **`fiscal_periods`**. See [docs/BUSINESS_COVERAGE.md](docs/BUSINESS_COVERAGE.md) for full coverage. **Customization vs performance:** tenant-defined fields live in `entities.data` (JSONB + GIN index); no EAV. Saved views store only filter/sort/columns; queries still hit entities with the same indexes.

## Project setup

### How to run

1. **Use Node 20** (see `.nvmrc`; `nvm use` or `fnm use` if you use a version manager).
2. **Copy env and set required variable**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set at least:
   - `DATABASE_URL` — PostgreSQL connection string (required). Use `sslmode=require` in production.

3. **Install and migrate**
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   ```
   For production (or after pull), run `npx prisma migrate deploy` to apply pending migrations.

4. **Start the app**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `OPENAI_API_KEY` | No | For AI-assisted module creation and prompts. |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob for file uploads. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLATFORM_PRICE_ID` | No | Platform billing; leave unset to disable Stripe. |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | No | Tenant-facing Stripe Connect. |
| `RESEND_API_KEY`, `EMAIL_FROM` | No | Transactional email (Resend). |
| `NEXT_PUBLIC_APP_URL` | No | Public URL for redirects; defaults to `VERCEL_URL` or `http://localhost:3000`. |
| `SUBSCRIPTION_GRACE_DAYS` | No | Grace period when subscription is past_due (default 7). |
| `API_RATE_LIMIT_PER_MINUTE` | No | Per-tenant API rate limit (default 100). |
| `CORS_ORIGIN` | No | CORS origin for `/api/v1` (tenant API). Default `*`. Set to a specific origin in production to restrict custom frontends. |
| `CRON_SECRET` | No | Secret for cron endpoints (e.g. webhook retries). Use `Authorization: Bearer <CRON_SECRET>`. |
| `DEBUG_API_LOGGING` | No | Set to `1` or `true` to log each `/api/v1` request (method, path, request ID) to the server console. |
| `MAINTENANCE_MODE` | No | Set to `1` or `true` to return 503 "Under maintenance" for all routes except `GET /api/health` and `GET /api/ready`. Use during brief outages or deployments. |
| `APP_VERSION` | No | Override version shown in `GET /api/health` and `GET /api/ready`. Defaults to `package.json` version; Vercel deployments also expose `buildId` (git SHA). |

For full endpoint and auth details (e.g. building a custom customer frontend), see [docs/TENANT_API.md](docs/TENANT_API.md).

The app validates required env at startup (via `instrumentation.ts` and `lib/env.ts`) and will throw if `DATABASE_URL` is missing.

### Configuration

- **App config** (`lib/app-config.ts`): Central place for layout and UI constants—dashboard max width, entity list page size, fetch limits, subscription grace days, API rate limit, export limits, etc. Env vars override where applicable (e.g. `SUBSCRIPTION_GRACE_DAYS`, `API_RATE_LIMIT_PER_MINUTE`). Use this file instead of scattering magic numbers.

### Backup and restore

- **Export**: From the dashboard home (when you have modules), use **Export data (JSON)** to download a snapshot of modules, fields, and entities for the current tenant. The JSON includes **`exportVersion`** (currently `1`) so future import logic can support multiple formats.
- **Import**: Use **Import from export JSON** (expand the section on the same page) to paste or upload that JSON. The app creates any missing modules (and their fields), then creates entities under the matching module slug. Requires **modules manage** and **entities write** permissions. Only export version `1` is supported; newer versions will be rejected with a clear error. Relationships in the export are not restored (entity IDs change); relation fields in data are copied as-is and may need editing after import.

### Infrastructure

- **Health and readiness:** `GET /api/health` is a liveness probe (200 + version/buildId, no DB). `GET /api/ready` runs full checks (DB, Resend, Stripe, webhook retries) and returns 503 when not ready. Use readiness for routing traffic; use liveness so orchestrators don’t kill the process when DB is temporarily down.
- **Idempotency:** Tenant API `POST` and `PATCH` (entities) accept optional `Idempotency-Key` header; responses are cached 24h so retries don’t create duplicates. See [docs/TENANT_API.md](docs/TENANT_API.md).
- **Request ID:** Every request that goes through middleware gets an `X-Request-ID` response header (and `x-request-id` on the request) for logging and tracing.
- **RLS:** Migration `20260313140000_add_rls_policies` enables Row-Level Security on tenant-scoped tables; the app’s DB user bypasses by default until you enforce (see docs/SECURITY.md).
- **Storage:** Uploads use `lib/storage` (default: Vercel Blob); swap the implementation for another provider without changing callers.
- **Stripe webhook idempotency:** Processed Stripe event IDs are stored in `stripe_processed_events`; the table grows indefinitely. Consider a periodic job to delete rows older than 90 days if the table becomes large.
- **security.txt:** `GET /.well-known/security.txt` returns a security policy (RFC 9116). Update the `Contact` and `Expires` values in `app/well-known/security.txt/route.ts` for your deployment.
- **Deploy verification:** After deploy, verify with `curl https://your-app/api/health` and `curl https://your-app/api/ready`.

### Dashboard behaviour

- **Clone entity**: On any entity edit page, **Clone** creates a new entity in the same module with the same data and metadata and syncs relationship fields; you are redirected to the new record.
- **Error handling**: The dashboard has an error boundary (`app/dashboard/error.tsx`) so a single failing component doesn’t white-screen the app; users get “Try again” and “Back to dashboard”. The app uses a custom 404 page (`app/not-found.tsx`) for unknown routes.

### First login

Ensure you have at least one tenant and user in the database. The easiest way is to run the seed: `npm run db:seed` (see `prisma/seed.js`). This creates a demo workspace (slug `demo`) and admin user `admin@demo.com` / `demo123` — log in at `/login` and change the password after first use.

### Database migration

One migration creates all tables, indexes (including GIN on `entities.data` and FTS on `search_text`), and optional commented sections for pgvector and RLS at the end of the same file. To enable pgvector or RLS later, uncomment the relevant block at the bottom of `prisma/migrations/20260308000000_init/migration.sql` and run `npx prisma migrate dev` again (or apply the SQL manually).

## Documentation

Key docs in `docs/`:

| Doc | Purpose |
|-----|---------|
| [TENANT_API.md](docs/TENANT_API.md) | Tenant REST API: auth, endpoints, CORS — for custom frontends and integrations. |
| [BILLING_STRIPE.md](docs/BILLING_STRIPE.md) | Platform (SaaS) billing and webhooks. |
| [TENANT_PAYMENTS.md](docs/TENANT_PAYMENTS.md) | Tenant-facing payments (Stripe Connect). |
| [LAUNCH_SETUP.md](docs/LAUNCH_SETUP.md) | Developer vs tenant responsibilities after launch. |
| [GAPS_AND_IMPROVEMENTS.md](docs/GAPS_AND_IMPROVEMENTS.md) | Current implementation status and remaining gaps. |
| [DESIGN_EVALUATION_AND_CROSS_INDUSTRY_ROADMAP.md](docs/DESIGN_EVALUATION_AND_CROSS_INDUSTRY_ROADMAP.md) | Design evaluation and feature roadmap. |
| [SECURITY.md](docs/SECURITY.md), [SCALABILITY_PERFORMANCE.md](docs/SCALABILITY_PERFORMANCE.md), [DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) | Security, scaling, and schema depth. |
| [ACTIVITY_EVENT_TYPES.md](docs/ACTIVITY_EVENT_TYPES.md) | Event types in the Activity / audit log (dashboard and API). |
| [USER_GUIDE.md](docs/USER_GUIDE.md) | End-user guide: how to use the dashboard and public site (also shown in-app at **Help**). |
| [QBO_INTEGRATION_READINESS.md](docs/QBO_INTEGRATION_READINESS.md) | Prepared for QuickBooks Online: Integration table, external ID convention, mapping plan. |

## Seed (optional)

Run `npm run db:seed` to create a demo tenant (slug `demo`), an admin role, and admin user `admin@demo.com` / `demo123`. See `prisma/seed.js`. Useful for local development and first login.

## E2E smoke tests

Run `npm run test:e2e` to execute Playwright smoke tests (health, ready, optional tenant API). Start the app first (`npm run dev`) or let Playwright start it via `webServer` in `playwright.config.ts`. For the optional tenant API test, set `E2E_TENANT_SLUG` and `E2E_API_KEY` in the environment. In CI, run `npm run test:e2e:ci` after starting the app.

## References

- Design informed by swad-app-emp, swad-app-main (domains: CRM, estimates, orders, inventory, fabrication), and swad-fabrication-shared (UI/data shapes). This schema does **not** replicate those tables; it provides one flexible model that can represent the same concepts via entities + relationships + JSONB.
