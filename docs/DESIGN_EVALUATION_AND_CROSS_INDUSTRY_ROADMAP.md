# Design Evaluation & Cross-Industry Feature Roadmap

This document evaluates the Tasc360-ERJV design and proposes concepts and features to **maximize the platform’s potential across the highest number of industries**.

---

## Part 1: Design Evaluation

### Strengths of the Current Foundation

| Strength | Why It Matters |
|----------|----------------|
| **Entity + relationship + JSONB** | One schema serves many verticals without migrations. Tenants define modules/fields; the same engine powers CRM, jobs, donations, events, inventory, and more. |
| **Multi-tenancy from day one** | Tenant-first indexes, session-based tenant resolution, and optional parent-tenant hierarchy support franchises, agencies, and white-label. |
| **Money and operations built in** | Payments, allocations, journal entries, time entries, approvals, recurring schedules, and fiscal periods are in the schema—not bolted on. This is rare for a “flexible” platform. |
| **Customer site + dashboard** | Two surfaces (staff dashboard + public site) with shared tenant config. Cart, checkout, check-in, and public forms already exist; Stripe is the main missing piece. |
| **AI-assisted configuration** | Module/view suggestion and dashboard intent parsing reduce setup friction and make the product feel “smart” across any vertical. |
| **Audit and compliance hooks** | Events, soft delete, consent, created_by, and optional RLS support regulated industries (healthcare, finance, nonprofit, EU). |
| **Search and AI-ready schema** | `search_text`, FTS, and `embeddings` (pgvector) support hybrid search and RAG without redesign. |

### Architectural Fit for Cross-Industry Use

- **Horizontal platform, vertical by configuration:** No vertical is hard-coded. Industries are expressed as different module sets, relationship graphs, and settings (e.g. payment vs donation, fund accounting). The same codebase can serve professional services, nonprofits, events, field service, and light manufacturing.
- **Extensibility without forking:** New domains (e.g. healthcare encounters, education enrollments) = new modules + relationships + optional small extensions (e.g. `volunteer_entity_id`). No need to fork the product.
- **API-first readiness:** REST API with tenant + API key auth is in place. PATCH/DELETE and webhooks would make the platform a strong backbone for industry-specific UIs and integrations.

### Gaps That Limit Cross-Industry Power

| Gap | Impact |
|-----|--------|
| **No Stripe (or payment provider)** | Tenant-facing payments (invoices, donations, tickets) and platform billing are not live. This blocks e‑commerce, events, and nonprofit revenue flows. |
| **Relationships not first-class in UI** | Relation fields store target id in `entity.data`; the `relationships` table is not written/used for graph-style queries and reporting (e.g. “all donations by campaign”). |
| **No board/calendar views** | Only list view is implemented. Many industries (project management, field service, events, care scheduling) need board and calendar. |
| **Semantic search not wired** | pgvector and embeddings table exist but are not populated or queried. Limits “find anything” and AI explain/summarize across large tenant data. |
| **No webhooks / automations** | Tenants cannot react to entity/order/payment events in real time (CRM, fulfillment, accounting integrations). |
| **Limited field config UI** | Creating relation fields and other advanced fields often requires DB/seed; no full field editor in the dashboard. |
| **No vertical templates** | Every tenant starts from zero. Industry templates (nonprofit, field service, events) would dramatically shorten time-to-value. |

---

## Part 2: Industries and How the Platform Can Serve Them

The following table maps industries to the **current** schema and to **features that would maximize** value.

| Industry | Current fit | Key differentiator with proposed features |
|----------|-------------|-------------------------------------------|
| **Nonprofit** | Donors, donations, designations, campaigns, grants, fund accounting, volunteer hours (doc’d in NONPROFIT.md). | Templates, Stripe for donations, 990-style reports, volunteer check-in on customer site. |
| **Professional services** | Jobs, estimates, invoices, time entries, approvals, allocations. | Proposals/quotes workflow, client portal (customer site), Stripe invoicing. |
| **Field service / trades** | Jobs, work orders, time, customers, scheduling. | Board/calendar views, dispatch view, mobile-friendly, Stripe + optional inventory. |
| **Events & ticketing** | Orders, order lines, check-in, tickets. | Stripe checkout, capacity limits, waitlist, post-event reports. |
| **E‑commerce / retail** | Products (entities), cart, checkout, orders. | Stripe, inventory levels, variants (entity or JSONB), shipping, basic reporting. |
| **Education** | Entities for students, courses, enrollments; consent; roles. | Enrollment workflows, certificates, Stripe for tuition/fees, parent portal. |
| **Healthcare (light)** | Entities, audit (events), consent, soft delete. | Consent and audit emphasis, appointment-like modules, HIPAA-oriented docs and RLS. |
| **Franchise / multi-location** | Tenant hierarchy, multi-ledger, per-tenant data. | Parent dashboards, consolidated reporting, location-level billing. |
| **Manufacturing / fabrication** | Jobs, BOM-style entities, JSONB config. | Templates for work orders + BOM, optional lot/serial, Stripe for deposits. |
| **Agencies / studios** | Projects, clients, time, approvals. | Project templates, client portal, Stripe for retainers/invoices. |

---

## Part 3: Feature Concepts to Maximize Cross-Industry Power

### Tier 1: Unlock Revenue and Core Workflows (Highest Impact)

1. **Stripe (and/or payment provider) integration**
   - **Platform billing:** Per-tenant subscription (per-seat or fixed); use existing Stripe fields on `tenants` and docs (BILLING_STRIPE.md).
   - **Tenant-facing payments:** Checkout on customer site (tickets, donations, products) and optional “pay invoice” in dashboard. Config in `tenants.settings`; record in `payments` and link to entity/order.
   - **Effect:** E‑commerce, events, nonprofits, professional services, and education can all monetize through the same platform.

2. **Vertical / industry templates**
   - **Concept:** One-click “Start from template” with pre-defined modules, fields, relationships, and optional default views.
   - **Examples:** Nonprofit (donors, donations, campaigns, designations, grants); Field service (customers, jobs, work orders, time); Events (events, tickets, check-in); Professional services (clients, projects, invoices, time).
   - **Implementation:** Seed or API that creates `modules` + `fields` + relationship types + starter `views`; optionally create sample entities. Templates can be JSON/seed files or stored as “template” tenants that are cloned.
   - **Effect:** Fast onboarding for the largest number of industries; differentiators become configuration, not code.

3. **Board and calendar views**
   - **Board:** Kanban by a select field (e.g. status); drag-and-drop to update that field (and optionally relationship/assignee).
   - **Calendar:** Entities with a date/datetime field (e.g. `scheduled_date`, `event_date`) shown on a calendar; click to view/edit.
   - **Effect:** Project management, field service, events, care scheduling, and agencies get a familiar UX without new schema.

### Tier 2: Differentiate and Scale (High Impact)

4. **First-class relationships and graph-style access**
   - **Concept:** When a relation field is saved, also write (or sync) a row in `relationships` with a stable `relation_type` derived from the field. Expose “Related records” in entity detail and support “follow relationship” in API (e.g. `GET /entities/:id/related?type=donation`).
   - **Reporting:** “Donations by campaign,” “Invoices by customer,” “Time by job” become simple relationship traversals or pre-built reports.
   - **Effect:** Nonprofit, CRM, and any vertical that relies on links between entities get reporting and UX that match their mental model.

5. **Semantic search and “Ask” AI**
   - **Concept:** Enable pgvector; backfill and maintain `embeddings` from `entities.search_text` (and optionally from related entity snippets). Implement hybrid search (FTS + vector) in API and dashboard.
   - **“Explain / Summarize”:** “What’s the total of open opportunities?” or “Summarize this donor” using RAG over entity + relationship + ledger data.
   - **Effect:** Large tenants and knowledge-heavy verticals (professional services, support, nonprofit) get “find anything” and AI that feels native.

6. **Webhooks and optional automations**
   - **Concept:** Webhook URLs in `tenants.settings` (or `integration_endpoints`); on entity create/update, order placed, payment recorded, call webhook with payload. Optional: simple rules (e.g. “when entity X is created, create entity Y” or “when payment received, send email”).
   - **Effect:** CRM sync, accounting export, fulfillment, and custom integrations without building one-off connectors per industry.

7. **Full field configuration in the dashboard**
   - **Concept:** UI to add/edit/remove/reorder fields; for relation fields, pick target module and optionally relation type label; for select, edit options; for file, set allowed types/size.
   - **Effect:** Tenants (and implementation partners) can fully customize without DB access; lowers support and accelerates vertical templates.

### Tier 3: Polish and Expand (Medium Impact)

8. **Onboarding wizard**
   - **Concept:** “What’s your business?” → suggest template or AI-suggested module set → one-click create → optional “Add your first X” with guided form.
   - **Effect:** Higher activation and time-to-value across all segments.

9. **Custom domain and SEO for customer site**
   - **Concept:** Tenant can attach a custom domain (e.g. `donate.tenant.org`); store in settings and resolve in middleware. Use existing SEO hooks (e.g. `lib/site-seo.ts`) for meta and structure.
   - **Effect:** Events, nonprofits, and e‑commerce look and feel like their own brand.

10. **Pagination, restore, and UX hardening**
    - **Concept:** Cursor or offset pagination on entity lists and API; “Show deleted” + Restore in dashboard; loading states and error boundaries.
    - **Effect:** Usable at scale and in regulated contexts (restore = undo + audit).

11. **API: PATCH/DELETE and bulk operations**
    - **Concept:** REST PATCH and DELETE for entities; optional bulk endpoint (e.g. “update status for these ids”) with API key and tenant scope.
    - **Effect:** Integrations and power users can fully manage data without the UI.

12. **Event writing and audit UI**
    - **Concept:** Write to `events` on entity (and optionally order/payment) create/update/delete; simple audit log UI (filter by entity, user, date, type).
    - **Effect:** Compliance and “who changed what” for healthcare, finance, and enterprise.

### Tier 4: Optional Vertical Extensions (As Needed)

13. **Volunteer hours for non-users** (nonprofit)
    - Optional `volunteer_entity_id` on `time_entries` and allow `user_id` null when set; staff logs hours on behalf of constituents.

14. **Capacity and waitlist** (events)
    - Entity-level or module-level “capacity”; when sold out, optional waitlist entity or queue; notify when spot opens.

15. **Multi-currency and multi-ledger in UI**
    - Exchange rates and multi-ledger are in schema; expose in dashboard (e.g. “Post in currency X at rate Y,” “Switch ledger”) for global and franchise tenants.

16. **Approvals and workflows in UI**
    - Approvals table exists; add “Request approval” and “Approve/Reject” flows in dashboard for quotes, POs, time-off, expenses.

---

## Part 4: Prioritized Roadmap (Recommendation)

To maximize power across the **highest number of industries** with the **fewest moving parts**:

| Priority | Feature | Industries unlocked / strengthened |
|----------|---------|------------------------------------|
| **P0** | Stripe: platform billing + tenant checkout | All revenue-generating verticals |
| **P0** | Vertical templates (nonprofit, field service, events, pro services) | Fast adoption in 4–5 major segments |
| **P1** | Board + calendar views | Field service, events, projects, agencies |
| **P1** | First-class relationships (write + read + “related” API) | Nonprofit, CRM, any linked-data vertical |
| **P1** | Semantic search + “Ask” AI | Scale and differentiation in every vertical |
| **P2** | Webhooks (and optional simple automations) | Integrations and ecosystem |
| **P2** | Full field config UI | Self-serve and template adoption |
| **P2** | Onboarding wizard | Activation and retention |
| **P3** | Custom domain, pagination, restore, PATCH/DELETE, audit UI | Polish and enterprise/regulated |

---

## Part 5: Implementation status

The following have been implemented:

- **Vertical templates:** `lib/templates` with Nonprofit, Field Service, Events, Professional Services. Dashboard home shows “Start from a template” when no modules; apply template creates modules, fields, and default views (including board/calendar).
- **Board and calendar views:** View type and settings (boardColumnField, dateField) in Edit View; module list renders `EntityBoard` (Kanban by select field) or `EntityCalendar` (by date field) when the selected view is board/calendar.
- **First-class relationships:** On entity create/update, relation and relation-multi fields are synced to the `relationships` table. Entity detail page shows “Related records” (in/out). No separate related API yet; dashboard uses `getRelatedEntities`.
- **Events and audit:** Entity create/update/delete write to `events` (entity_created, entity_updated, entity_deleted). Entity detail page shows an “Activity” list.
- **Webhooks:** `lib/webhooks` reads `tenant.settings.webhookUrl` (and optional `webhookSecret`); `fireWebhook(tenantId, event, data)` is called after entity created/updated/deleted (fire-and-forget). Configure URL via tenant settings (e.g. API or future UI).
- **Pagination (API):** GET entities supports `?limit=50&cursor=<id>`. Response includes `nextCursor` for the next page.
- **Restore and “Show deleted”:** Module list supports `?deleted=1` to show soft-deleted entities; “Restore” button calls `restoreEntity` (sets `deletedAt = null`).
- **API PATCH/DELETE:** PATCH merges body into entity `data`; DELETE soft-deletes (blocks if tickets sold).
- **Onboarding:** When there are no modules, dashboard home shows “What’s your business?” with template cards and “Or describe a custom module” (AI).

**Additional implementation (second pass):**

- **Full field config UI:** “Manage fields” at `/dashboard/m/[moduleSlug]/fields`. Add field (name, slug, type, required, options/target module), reorder (up/down), remove (blocked if any entity has data). Actions: `addFieldToModule`, `removeFieldFromModule`, `reorderFieldInModule`.
- **Semantic search and Ask AI:** `lib/search.ts` — `searchEntitiesFts(tenantId, query)` uses FTS on `entities.search_text`. Dashboard “Ask about your data” (`AskAiForm`) runs FTS, builds context from top results, and calls OpenAI for an answer (RAG). No pgvector in this pass; hybrid vector can be added later.
- **Custom domain:** `getTenantByCustomDomain(host)` in `lib/tenant.ts` resolves tenant from `tenant.settings.site.customDomain`. Root page (`/`) checks host and redirects to `/s/[slug]` when the host matches a tenant’s custom domain. Settings → SEO: “Custom domain” field to set it.
- **Volunteer entity on time entries:** Schema and migration `20260313100000_add_volunteer_entity_id_time_entries` add `volunteer_entity_id` (FK to entities) and make `user_id` optional on `time_entries` for nonprofit volunteer hours.
- **Approvals UI:** `/dashboard/approvals` lists pending approvals with type, record link, requester, date; Approve/Reject buttons call `decideApproval(approvalId, status)`. Sidebar link “Approvals” added.

**Third pass (capacity, waitlist, pgvector):**

- **Capacity:** Entity-level capacity in `entity.metadata.capacity`. Dashboard: "Capacity (max tickets / spots)" on entity edit when module has payment/donation type. Customer site: `getEntityAvailabilityForSite`; sold-out entities show "Sold out" and "X spots left" when under capacity. Checkout validates total quantity per entity and returns an error if over capacity.
- **Waitlist:** When sold out and waitlist is configured, customer site shows "Join waitlist" (email + quantity). Settings → Waitlist: configure waitlist module slug and field slugs (event relation, email, quantity). `joinWaitlist` creates an entity in that module linking to the event.
- **pgvector + embeddings:** Migration `20260313110000_add_pgvector_embeddings` adds `vector` extension and `embedding` column (1536) on `embeddings`. `lib/embeddings.ts`: `generateEmbedding(text)` (OpenAI text-embedding-3-small), `upsertEmbeddingForEntity(tenantId, entityId, content)` — stores content and vector (via raw SQL). Entity create/update trigger fire-and-forget upsert from `searchText`. `lib/search.ts`: `searchEntitiesVector`, `searchEntitiesHybrid` (FTS + vector merge by combined rank). Ask AI uses `searchEntitiesHybrid` for better results when embeddings exist.

**Stripe (platform + Connect):**

- **Platform (SaaS) billing:** `lib/stripe-platform.ts` — create Customer, Checkout Session (subscription), Billing Portal; sync subscription from webhooks. Dashboard Subscription page: “Subscribe with Stripe” and “Manage billing”. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLATFORM_PRICE_ID`. User add/deactivate triggers `updatePlatformSubscriptionQuantity`.
- **Stripe Connect (tenant-facing):** `lib/stripe-connect.ts` — Express Connect account, Account Link onboarding; config in `tenant.settings` (`stripeConnectAccountId`, `stripeConnectOnboardingComplete`). Dashboard Settings → Payments: “Connect Stripe”. Customer checkout: when Connect is complete and cart total > 0, create Order (pending_payment), create Checkout Session with `stripe_account`, redirect to Stripe; webhook `checkout.session.completed` marks order completed and creates `Payment`. Env: optional `STRIPE_CONNECT_WEBHOOK_SECRET` for Connect webhook.

**Related API, Webhook UI, Subscription gating, Multi-currency/ledger UI:**

- **Related API:** `GET /api/v1/tenants/:tenantId/entities/:entityId/related?type=...` — returns entities linked via the `relationships` table (in/out). Optional query `type` filters by relationType. Uses same X-API-Key auth as other API routes.
- **Webhook UI:** Dashboard Settings → “Webhooks” card. Configure webhook URL (HTTPS) and optional secret. Saved to `tenant.settings.webhookUrl` and `webhookSecret`; existing `lib/webhooks` and entity events use them.
- **Subscription gating:** Dashboard layout checks `tenant.subscriptionStatus`; when set and not `active` or `trialing`, redirects to `/dashboard/subscription?gated=1`. Subscription page is always reachable. Middleware sets `x-pathname` so the layout can allow the subscription route.
- **Multi-currency / fiscal periods UI:** Dashboard → Finance. Exchange rates: list and add (from/to currency, rate, effective date). Fiscal periods: list and add (period start/end); “Close period” marks a period closed. Sidebar link “Finance” added. Journal entries can use `ledgerEntityId` (schema); ledger selector can be added to a future journal-entry UI.

---

## Part 6: Summary

- **Design:** The foundation (entity/relationship/JSONB, multi-tenant, money/ops in schema, two surfaces, AI-assisted config) is strong and already horizontal. **Stripe** (platform billing + Connect), **vertical templates**, **board/calendar views**, **first-class relationships** (sync + Related API), **webhooks** (with UI), **field config UI**, **semantic search + Ask AI**, **events/audit**, **pagination**, **restore**, **subscription gating**, and **export/import** are implemented. Remaining opportunities: users/roles admin UI, full filter/sort in view edit, API key hashing, optional read-permission checks, file upload UI.
- **Maximizing potential:** The roadmap above is largely implemented. Next differentiators: **users & roles** dashboard (invite, assign roles), **full view filter/sort UI**, and vertical-specific polish (e.g. volunteer hours, capacity/waitlist) as needed.
- **Result:** One platform can credibly serve **nonprofit, professional services, field service, events, e‑commerce, education, franchise, and light healthcare/manufacturing** with the same codebase, differentiated by configuration, templates, and a few optional extensions.
