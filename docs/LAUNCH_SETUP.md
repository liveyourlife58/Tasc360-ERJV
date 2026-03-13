# Launch setup: developer vs tenant

After the platform is launched, some things are done **once by developers** (platform/infra and app features), and others can be done **by each tenant** in the app (no code, no DB access).

---

## Developer setup (platform / one-time or rare)

These require code, infra, or database access. Tenants cannot do them.

| Area | What the developer does |
|------|-------------------------|
| **Database** | Run Prisma migrations; provision Postgres; optionally enable pgvector and RLS (see [SECURITY.md](SECURITY.md)). |
| **Application** | Deploy the app; set env (e.g. `DATABASE_URL`, Stripe keys, session secret). The app validates required env at startup (`instrumentation.ts`). For first tenant + user, run the seed: `npm run db:seed` (see project README and `prisma/seed.js`). After deploy, verify with `curl https://your-app/api/health` and `curl https://your-app/api/ready`. |
| **Auth** | Implement sign-up/sign-in; resolve tenant from session (e.g. subdomain, tenant slug in JWT); never trust `tenant_id` from client. |
| **Platform billing** | Configure Stripe products/prices (per-user or fixed); implement webhooks to update `tenants.subscription_status`, `subscription_current_period_end`; optionally enforce seat limits. See [BILLING_STRIPE.md](BILLING_STRIPE.md). |
| **Tenant creation** | Provide a flow to create a tenant (e.g. sign-up creates `tenants` + first user). Tenant name/slug can be chosen by the user; the rest is developer logic. |
| **Roles & permissions** | Implement permission checks using `roles.permissions` (e.g. `entities:read`, `modules:manage`). Define a default role for new users if desired. |
| **Integrations** | Any code that calls external APIs, processes webhooks from payment providers, or syncs data (e.g. QuickBooks). Store provider config in `tenants.settings`; app reads it at runtime. |
| **AI / embeddings** | For semantic search and "Ask about your data": set `OPENAI_API_KEY` and run the pgvector migration (`20260313110000_add_pgvector_embeddings`). The app then generates embeddings on entity save and uses hybrid (FTS + vector) search for RAG. See README "AI readiness". |
| **Backups & ops** | Backups, monitoring, scaling. Optional: tenant restore, export (GDPR). |
| **Cron / webhook retries** | Failed webhook deliveries are enqueued and retried with backoff (1m, 5m, 30m, 60m). Call `GET /api/cron/webhook-retries` with `Authorization: Bearer <CRON_SECRET>` on a schedule (e.g. every 5 minutes via Vercel Cron or external scheduler). Set `CRON_SECRET` in env. |

**Summary:** Developers own infra, deployment, auth, platform billing, permission enforcement, and any coded integrations. Tenants never see the DB or env.

---

## Tenant setup (self-service in the app)

If the app exposes the right UI and APIs, tenants can do the following **themselves**. No developer or DB access needed.

| Area | What the tenant can do (with app UI) |
|------|-------------------------------------|
| **Organization** | Edit tenant name; manage billing (payment method, plan change) if the app uses Stripe Customer Portal or similar. |
| **Users & roles** | Invite users (email); create/edit roles; assign permissions (from the list the app defines); assign users to roles. Tables: `users`, `roles`. |
| **Modules** | Create modules (e.g. Customers, Jobs, Invoices, Products). Set name, slug, description, sort order. Table: `modules`. |
| **Fields** | For each module, add/edit/remove fields: name, slug, type (text, number, date, boolean, select, relation, file, json), options for select/relation, required flag. Table: `fields`. |
| **Views** | Save list/board/calendar views: name, filters, sort, visible columns. Table: `views`. |
| **Data** | Create and edit entities (records) in each module; link entities via relationships (e.g. customer → job). Tables: `entities`, `relationships`. |
| **Tags** | Add/remove tags on any entity; filter by tag. Table: `entity_tags`. |
| **Approvals** | Configure approval types (e.g. quote, PO, time-off) if the app lets them; request/approve per entity. Table: `approvals`. |
| **Time** | Log time to jobs/work orders (if the app exposes time entry UI). Table: `time_entries`. |
| **Payments (their customers)** | Connect their Stripe/Square (or similar) via app settings; record payments against invoices/orders. Config in `tenants.settings`; table: `payments`, `payment_allocations`. See [TENANT_PAYMENTS.md](TENANT_PAYMENTS.md). |
| **Accounting** | Define chart of accounts (as entities); enter journal entries; run reports. Tables: `journal_entries`, `ledger_lines`. Optional: exchange rates, fiscal periods. Tables: `exchange_rates`, `fiscal_periods`. |
| **Recurring** | Set up recurring items (e.g. recurring invoice template, frequency, next run). Table: `recurring_schedules`. App must run a job to create entities from templates. |
| **Files** | Upload/attach documents to entities. Table: `files`. |
| **Notifications** | Configure notification preferences (e.g. in `users.settings`) if the app supports it. |

**Summary:** Tenants configure their own data model (modules, fields), views, users/roles, and business data (entities, relationships, tags, time, payments, accounting, recurring). All of this is stored in the existing schema; no new tables or migrations are required for tenant choices.

---

## What the app must provide for tenant self-service

For the “tenant setup” column to be true, the application must:

1. **UI (or API) for modules and fields** — Create/edit modules and fields; validate entity `data` against field definitions when saving.
2. **UI for entities and relationships** — CRUD on entities; create/delete relationships and choose `relation_type` (and optionally edge `data`).
3. **UI for views** — Save/load filter, sort, and columns per module (list/board/calendar).
4. **User/role management** — Invite users, create roles, assign permissions from a fixed list the app defines.
5. **Tenant settings** — Edit `tenants.settings` (e.g. payment provider keys, webhook URL) in a settings page; never expose raw DB.
6. **Resolve tenant from session** — Every request uses `tenant_id` from the authenticated session (or RLS), not from the client.

Optional but valuable: onboarding (e.g. “create your first module”), templates (predefined modules/fields per industry), and help text so tenants know they can customize modules and fields themselves.

---

## Quick reference

| Who        | Examples |
|-----------|----------|
| **Developer** | Migrations, env, auth, Stripe products, permissions logic, webhooks, embedding pipeline, backups. |
| **Tenant**   | Modules, fields, views, entities, relationships, tags, users/roles, payments config, time entries, journal entries, recurring schedules, exchange rates, fiscal periods. |

The schema is built so that **tenant-customizable** pieces (modules, fields, views, entity data, relationships) live in the DB without new migrations; **developer-owned** pieces (infra, auth, billing, integrations) stay in code and configuration.
