# UI/UX plan: multi-tenant dashboard + customer-facing site (Next.js, TypeScript, AI-assisted)

This document outlines how to design the front-end and experience so **each tenant** gets:

1. **A backend dashboard** — where their staff manage data (entities, relationships, users, settings) with maximum customization (modules, fields, views) and AI help.
2. **A customer-facing website** — the tenant’s public presence (storefront, donation site, portfolio, etc.), also customizable and AI-assisted.

**Stack:** Next.js (App Router) + TypeScript. Backend = Tasc360-ERJV DB (PostgreSQL, Prisma). Logic/server layer (API, webhooks, automations) to be added later; this plan focuses on structure and UX so that layer slots in cleanly.

**Goal:** One codebase; tenant resolution at runtime; schema-driven and settings-driven UI; AI used to help tenants configure both surfaces with minimal manual setup.

---

## 1. Architecture overview: two surfaces, one codebase

### 1.1 Two surfaces per tenant

| Surface | Who uses it | Purpose |
|--------|-------------|---------|
| **Dashboard** | Tenant’s staff (users in `users` table) | Manage modules, fields, entities, relationships, views, users/roles, settings, reports. Schema-driven: UI reads `modules` + `fields` and renders forms/lists; `views` drive saved list/board/calendar. |
| **Customer-facing site** | Tenant’s end users (customers, donors, visitors) | Public pages: homepage, product/service catalog, forms (e.g. contact, donation, application), maybe auth for “my account” or portal. Content and structure are tenant-configurable (branding, which modules are public, page structure). |

Both surfaces are **tenant-scoped**: every request resolves the current tenant (see below) and all data and config are filtered by that tenant.

### 1.2 Tenant resolution (how we know “which tenant”)

Options:

- **Subdomain:** `acme.yourapp.com` = tenant “acme”. Dashboard might be `acme.yourapp.com/dashboard` or `dashboard.yourapp.com` with tenant from session.
- **Path:** `yourapp.com/acme` = tenant “acme”; `yourapp.com/acme/dashboard` = dashboard for acme.
- **Custom domain:** `acme.com` maps to tenant “acme” (DNS + your routing). Dashboard could be `app.acme.com` or `acme.com/dashboard`.

**Recommendation for plan:**

- **Dashboard:** Always under a single “app” host, e.g. `app.yourapp.com` (or `yourapp.com/app`). Tenant comes from **auth session** (user belongs to one tenant). No need to encode tenant in the URL for the dashboard.
- **Customer site:** Tenant identified by **subdomain** or **path** or **custom domain**:
  - **Subdomain:** `acme.yourapp.com` → tenant slug `acme`.
  - **Path:** `yourapp.com/s/acme` or `yourapp.com/acme` → tenant slug `acme`.
  - **Custom domain:** `acme.com` → resolve tenant via a mapping table (e.g. `tenants.settings.custom_domain` or a separate `tenant_domains` table). Store in DB; resolve in middleware.

One codebase serves both: **route groups** (e.g. `(dashboard)` and `(site)`) or **middleware** that branches by host/path and renders the right layout and data. Next.js middleware can set `tenantId` / `tenantSlug` (and optionally `surface: 'dashboard' | 'site'`) for the request.

### 1.3 High-level request flow

- **Dashboard:** User logs in → session has `tenantId` (and `userId`) → all API and Server Components use `tenantId` from session. No tenant in URL required (optional: `/t/[slug]` for “switch workspace” if you add multi-tenant membership later).
- **Customer site:** Request hits `acme.yourapp.com` or `yourapp.com/s/acme` or `acme.com` → middleware resolves `tenantId` from subdomain/path/domain → layout and pages load tenant’s branding and public config (which pages exist, which modules are exposed, etc.).

Data layer (later): all server logic and API routes receive `tenantId` (and for dashboard `userId`) and query Tasc360-ERJV with tenant scoping only.

---

## 2. Backend dashboard: UX principles

### 2.1 Schema-driven UI (no code per module)

The DB already has **modules**, **fields**, and **entities** with JSONB `data`. The dashboard should be **generic**:

- **Module list:** List of tenant’s modules (from `modules` + `fields`). Clicking a module opens the “entity list” for that module.
- **Entity list:** Renders a table (or board/calendar when view type says so) of entities for that module. Columns = field definitions (from `fields`); data = `entity.data`. Filter/sort/columns come from the current **view** (saved in `views` table) or defaults.
- **Entity create/edit:** Form generated from `fields` (type, label, required, options). Save = upsert `entities` row with `data` = form values keyed by field slug. Optionally maintain `search_text` and fire events.
- **Relationships:** UI to link entities (e.g. “Link to customer”) using the `relationships` table; relation types can come from field type “relation” in `fields.settings`.

So: **no hand-coded “Customer” or “Job” screens**. One set of components: “module list”, “entity list”, “entity form”, “relationship picker”. They read schema from the DB and render accordingly. This maximizes customization: tenants add modules/fields and immediately get the UI.

### 2.2 Views as saved “screens”

Tenants save **views** (list/board/calendar, filter, sort, columns). Dashboard UX:

- Per module, show a view selector (tabs or dropdown): “All”, “Active”, “My deals”, etc. Each is a `views` row.
- Changing view only changes filter/sort/columns; the same entity list component runs with different params. No new code per view.

### 2.3 Tenant-level dashboard settings

Store in `tenants.settings` (or a small `tenant_dashboard_settings` entity if you prefer):

- **Branding:** Logo URL, primary color, name. Dashboard shell (sidebar, header) uses these.
- **Home/default:** Which module or view to show after login; sidebar order of modules.
- **Feature flags:** Which features are on (e.g. time entries, approvals, accounting). Lets you ship one codebase but enable/disable by tenant or plan.

Dashboard layout reads tenant settings and renders nav/sidebar accordingly. No per-tenant code.

### 2.4 AI in the dashboard

Use AI to **reduce setup effort** and **explain data**:

- **“Create a module for X”:** Tenant types “I need to track projects with name, status, due date, and client”. AI suggests a module (e.g. slug `project`) and fields (name text, status select, due_date date, client relation to “Customer”). Tenant confirms or edits; app creates `modules` + `fields` rows. No manual field-by-field form.
- **“Create a view that shows Y”:** “Show me all jobs where status is In Progress, sorted by due date.” AI suggests filter and sort; app creates/updates a `views` row.
- **“Explain / summarize”:** “What’s the total value of open opportunities?” or “Summarize this customer.” AI uses context (entity data, related entities, or aggregated data from the DB) to answer. Optionally: NL → structured query (e.g. to entities or reports) then show result in the UI.
- **Onboarding wizard:** Step-by-step (“What’s your business?” → “Here are suggested modules and a first view”) backed by AI suggestions and one-click create.

Implementation note: AI needs **tenant context** (tenant_id, existing modules/fields, plan) and **auth** (dashboard AI only for logged-in tenant users). Server-side only; call your LLM from API route or server action with tenant-scoped context.

---

## 3. Customer-facing site: UX principles

### 3.1 Tenant as “site owner”

Each tenant can have **one** customer-facing site. Configuration stored per tenant, e.g. in `tenants.settings` or dedicated tables:

- **Branding:** Logo, favicon, colors, fonts, site name, tagline.
- **Domain:** Subdomain (`acme.yourapp.com`), path prefix, or custom domain (with DNS mapping).
- **Site structure:** Which “pages” exist and what they show (see below).
- **Navigation:** Menu items (label + link). Can be derived from “public” modules or manually defined.

### 3.2 What the customer site shows (content model)

- **Static-ish pages:** Home, About, Contact, etc. Content can be: (a) rich text in tenant settings, (b) or entities of a “Page” module (body in `data`), or (c) AI-generated and then editable.
- **Dynamic lists from modules:** e.g. “Products”, “Services”, “Campaigns”. Tenant marks a module as “public” and chooses a slug (e.g. `/products`). Site renders a list of entities (that pass optional visibility rules) and detail pages per entity (e.g. `/products/[id]`). All driven by module/field definitions; list/detail components are generic.
- **Forms:** “Contact us”, “Apply”, “Donate”. Can be: (a) a generic “form” tied to a module (submissions create entities), or (b) a custom form builder (fields stored as config). AI can “generate a contact form” or “generate a donation form” from a description and create the config.
- **Auth (optional):** “My account” or “Portal” where the visitor logs in (tenant’s users or a separate “customer” entity). If you add customer auth, tenant_id is still from the request; user is scoped to that tenant.

So: customer site = **layout + branding + a set of routes** (pages, module-based list/detail, forms). Routes and “which module is public” are config, not hard-coded per tenant.

### 3.3 Public module mapping

- **Option A:** In `modules.settings` or `tenants.settings`, store e.g. `publicSite: { slug: 'products', showInNav: true }`. Middleware/layout for the customer site reads this and registers routes (e.g. `/products`, `/products/[id]`).
- **Option B:** A small table `site_pages` (tenant_id, type: 'page'|'module'|'form', slug, module_id or content_ref, sort_order). Site generator builds routes from this.

Either way: **one routing convention** (e.g. `/[slug]` for list, `/[slug]/[id]` for detail) and a single set of React components that render from config + entity data.

### 3.4 AI on the customer site

- **“Generate my site” / “Generate homepage”:** Tenant describes their business (“We sell handmade furniture”) or pastes existing copy. AI suggests: site name, tagline, section structure (hero, features, testimonials, CTA), and copy. Tenant approves; app writes to tenant settings or “Page” entities. Optional: generate a first “Products” or “Services” module and mark it public.
- **“Generate a form for X”:** “I need a contact form with name, email, message.” AI suggests field types and labels; app creates a form config or a module + view for submissions.
- **“Suggest what to show on the homepage”:** From tenant’s modules and data, AI suggests “Show your 3 latest products” or “Show a donation CTA and recent impact stats.” Tenant turns suggestions into widgets/sections (stored as config).

Customer-site AI must be **tenant-scoped and read-only** for public visitors (e.g. “Summarize this product”); **editing** (generate/change pages, forms) only from the dashboard with auth.

---

## 4. AI integration strategy (shared)

### 4.1 Where AI runs

- **Server-only:** All prompts that create or change data (modules, views, pages, forms) run in Next.js API routes or server actions. Never expose tenant data or schema to the client beyond what’s needed to render.
- **Context passed to AI:** Tenant id, tenant name/slug, existing modules and field slugs, plan/limits, and (when relevant) sample entity data or aggregates. For “explain this entity,” pass the entity’s `data` and related relationships. For “generate site,” pass tenant industry/description and current settings.

### 4.2 What the AI needs from the stack

- **Tasc360-ERJV:** Modules, fields, entities (and optionally views, events) to suggest schema, views, and content. Stored prompts or “AI suggestions” can live in tenant settings or a small `ai_suggestions` table (tenant_id, type, input_summary, output_json, status).
- **Auth:** For dashboard AI, require logged-in user + tenant. For customer site, only allow generation/editing from dashboard; public site can have “chat about this product” style features with tenant-scoped context.
- **Rate limits / safety:** Per-tenant or per-user limits on “create module/view/page” via AI to avoid abuse and cost spikes. Validate AI output (e.g. field types must be in allowlist) before writing to DB.

### 4.3 Leveraging AI “as much as possible”

- **Onboarding:** “Tell us your business” → AI suggests modules, first view, and optionally a first draft of the customer site (homepage + one public module).
- **Ongoing:** “Add a field for X,” “Create a view for Y,” “Add a page that does Z,” “Rewrite my homepage hero.” Each can be a short prompt; AI returns structured output (module/field/view/page config) for the app to apply.
- **Assist, don’t replace:** Tenant can always edit generated modules, views, and pages. AI is the fast path; manual editing remains for full control.

---

## 5. Next.js structure (conceptual, no code yet)

- **App Router:** Use route groups to separate surfaces.
  - e.g. `app/(dashboard)/**` for the backend dashboard (layout with sidebar, tenant from session).
  - e.g. `app/(site)/**` for the customer-facing site (layout with tenant from host/path, public nav).
- **Middleware:** First step: resolve tenant (and surface) from host/path/domain; set headers or cookies for downstream. For dashboard, tenant can also be from session after login.
- **Server Components:** Default for list and detail pages: load module/field defs and entities (or view config) in RSC, pass to generic components. Reduces client JS and keeps tenant scoping on the server.
- **Client Components:** Where needed: interactive forms, view builder, drag-and-drop for nav or page sections, AI chat or “suggest” buttons. They call server actions or API routes that receive tenant (and user) from server context.
- **API routes / Server Actions:** All mutations and AI calls take `tenantId` from session or middleware; never from client. Validate permissions (e.g. `modules:write`) using `roles.permissions`.

Later, when you add a dedicated **logic/server layer** (BFF, webhooks, jobs), it will also resolve tenant (e.g. from webhook payload or job metadata) and use the same Tasc360-ERJV data and tenant_id-first access.

---

## 6. Phased rollout (suggested order)

| Phase | Scope | Delivers |
|-------|--------|----------|
| **1. Dashboard core** | Tenant resolution (session); schema-driven module list, entity list, entity form; one default view per module. | Tenants can define modules/fields and CRUD entities. No AI yet. |
| **2. Dashboard views + settings** | Save/load views (filter, sort, columns); tenant branding and sidebar config in settings. | Customized lists and a branded dashboard. |
| **3. Dashboard AI** | “Create module for X,” “Create view for Y,” optional “explain/summarize.” | Less manual setup; AI-assisted onboarding. |
| **4. Customer site shell** | Resolve tenant from subdomain/path/custom domain; layout + branding; static “Home / About / Contact” from tenant settings. | Public site with tenant branding. |
| **5. Customer site dynamic** | Public modules (list + detail), optional forms; nav from config. | Tenant’s data visible on their site. |
| **6. Customer site AI** | “Generate my site,” “Generate homepage,” “Generate form.” | AI-driven site and form setup. |
| **7. Logic/server layer** | API for external systems, webhooks, background jobs, automations. | Integrations and workflows; same tenant resolution and DB. |

You can merge or split phases (e.g. 4+5 together) depending on priorities.

---

## 7. Summary

| Question | Answer |
|----------|--------|
| **How does each tenant get their own dashboard?** | One dashboard app (e.g. `app.yourapp.com`); tenant from **session** after login. UI is **schema-driven** from `modules`/`fields`/`views`; tenant settings drive branding and nav. No per-tenant screens. |
| **How does each tenant get their own customer site?** | One customer-site surface; tenant from **subdomain/path/custom domain** in middleware. Content and structure come from **tenant settings** and **public module/page config**; list/detail/form components are generic. |
| **How do we keep it highly customizable?** | All customization is **data**: modules, fields, views, tenant settings, site pages/config. UI code is generic and reads this data. |
| **How do we leverage AI?** | AI suggests or generates **config** (modules, fields, views, pages, forms, copy) from natural language. All writes go through server-side APIs with tenant context; tenants can edit everything after. |
| **Where does the logic/server layer fit?** | Same tenant resolution and Tasc360-ERJV DB. Later: BFF, webhooks, jobs, and automations all use `tenant_id` and the same entities/relationships; UI stays the single “control plane” for tenant and AI-driven customization. |

This plan gives you a clear path to implement the UI/UX so that each tenant has a customizable backend dashboard and customer-facing site, with AI used to get them there quickly, and room to add the logic and server layers later without re-architecting.
