# How to use the app

This guide explains how to use the **dashboard** (your private workspace) and the **public customer site** your visitors see. It is written for workspace members, administrators, and anyone configuring modules, fields, and integrations.

Use the **table of contents** to jump to a section. Some topics (API keys, webhooks, JSON field rules) are more technical; skim those if you only use the UI.

---

## Table of contents

1. [Concepts and terminology](#concepts-and-terminology)
2. [Getting started](#getting-started)
3. [Platform administration and dashboard features](#platform-administration-and-dashboard-features)
4. [Dashboard home](#dashboard-home)
5. [Modules and records (entities)](#modules-and-records-entities)
6. [Deadlines, list priority, and Deadline attention](#deadlines-list-priority-and-deadline-attention)
7. [Field value highlights (conditional row colors)](#field-value-highlights-conditional-row-colors)
8. [Views: list, board, and calendar](#views-list-board-and-calendar)
9. [Fields and field types](#fields-and-field-types)
10. [Relationships, tags, and backlinks](#relationships-tags-and-backlinks)
11. [Approvals](#approvals)
12. [Activity (audit log)](#activity-audit-log)
13. [Consent](#consent)
14. [Finance](#finance)
15. [Integrations](#integrations)
16. [Team (users and roles)](#team-users-and-roles)
17. [Subscription and billing](#subscription-and-billing)
18. [Settings](#settings)
19. [Ask about your data (AI)](#ask-about-your-data-ai)
20. [Export and import](#export-and-import)
21. [Your public customer site](#your-public-customer-site)
22. [Permissions and roles](#permissions-and-roles)
23. [Developers: API, webhooks, and customer logins](#developers-api-webhooks-and-customer-logins)
24. [Need more help?](#need-more-help)

---

## Concepts and terminology

| Term | Meaning |
|------|--------|
| **Workspace** / **tenant** | Your organization’s isolated data and settings. One login can belong to a workspace; data does not leak between tenants. |
| **Module** | A type of record you define (e.g. Customers, Events). Each module has its own fields and records. |
| **Entity** | A single record inside a module (one row of data). Sometimes called a **record**. |
| **Field** | A column on a module: name, type, validation, and optional settings (e.g. select options, relation target). |
| **Slug** | A short, URL-safe identifier for a module or field, used in URLs and APIs. |
| **View** | A saved way to look at a module’s entities: filters, sort, columns, and list vs board vs calendar. |
| **Soft delete** | Deleting hides a record from normal lists; it can be restored. Data is not immediately destroyed. |
| **Dashboard features** | Switches (per tenant) that a **platform administrator** can use to show or hide whole areas of the dashboard, the public site, and some home blocks. |
| **Developer setup** | When enabled for a workspace, users with **developer** permission can see API keys, webhooks, and the Integrations sidebar link (when those features are on). |

---

## Getting started

After you log in, you land in the **dashboard**. The **sidebar** on the left is the main navigation.

### Workspace section

- **Dashboard** (Home): summary, optional deadline list, module tiles (depending on [dashboard features](#platform-administration-and-dashboard-features)), and navigation help.
- **Module links**: one link per active module, in the order your workspace configures (sidebar order). Use these to open list/board/calendar views for that module.

### Settings and billing section

Items appear **only if** the corresponding **dashboard feature** is on for your tenant **and** you have [permissions](#permissions-and-roles). Typical items include:

- **Help** — this guide (loaded from the workspace documentation).
- **Approvals** — pending and historical approval requests.
- **Activity** — tenant-wide audit log.
- **Consent** — consent records for people (marketing, essential, etc.).
- **Finance** — ledgers, journal entries, exchange rates, fiscal periods (when configured).
- **Integrations** — external service connections — only when the **Integrations** feature is on, **developer setup** is enabled for the workspace, and you have **developer** permission.
- **Team** — users and roles.
- **Subscription & billing** — plan and Stripe customer portal (when used).
- **Settings** — branding, modules hub, customer site, Stripe, API, webhooks, consent types, and more.

### Footer

- **Preview site** — opens your public customer site in a new tab when the **Customer site** dashboard feature is enabled.
- **Log out** — ends your session.

### First-time workspace with no modules

**Home** explains how to open **Dashboard settings** → **Modules & data** to start from a **template**, describe a module with **AI**, or **import** data from a JSON export.

### Default home redirect

If an administrator sets **Default home** (in Settings → **Default home**) to a specific **module** or **view**, visiting **Home** may **redirect** you straight to that module or view instead of the dashboard overview.

---

## Platform administration and dashboard features

A **platform administrator** (not the same as a workspace admin) can enable or disable **dashboard features** for your tenant. Stored settings control what appears in the sidebar, which routes are available, and some blocks on the home page.

Typical feature keys include:

| Feature | What it affects (summary) |
|--------|---------------------------|
| **Help** | The Help page and sidebar link. |
| **Approvals** | Approvals area and home summary card. |
| **Activity** | Activity log and home summary card. |
| **Consent** | Consent page and related settings. |
| **Finance** | Finance area. |
| **Integrations** | Integrations page (with developer setup + permission). |
| **Team** | Team management. |
| **Subscription** | Subscription page and home billing notices. |
| **Settings** | Settings hub and home **Modules** tile section (module shortcuts still appear in the sidebar unless you restrict access elsewhere). |
| **Customer site** | Public site at `/s/your-slug`, Preview site link, and customer-site settings cards. |
| **Deadlines** | Home **Deadline attention** list and the data loaded for it. |

If something you expect is missing, your role may lack permission, or a platform administrator may have turned off that **dashboard feature**. Ask your workspace or platform admin.

---

## Dashboard home

What you see on **Home** depends on [dashboard features](#platform-administration-and-dashboard-features), [permissions](#permissions-and-roles), and whether you have any modules.

### Summary row (when enabled and you can read entities)

- **Approvals**: count of **pending** approval requests (when the Approvals feature is on).
- **Activity**: count of **events in the last 7 days** (when Activity is on).
- **Subscription**: short notice when billing needs attention (e.g. trial ending, past due) — when Subscription is on and Stripe status warrants it.

These are informational shortcuts; use the sidebar for full pages.

### Deadline attention (when enabled)

When **Deadlines** is on and your workspace has [deadline fields](#deadlines-list-priority-and-deadline-attention) configured, Home can show a **Deadline attention** list: recent records that match the **same priority rule** as module list ordering (see [Deadlines](#deadlines-list-priority-and-deadline-attention)). The list is **not exhaustive** — it scans recent updates per module — so treat it as a quick glance, not a complete report.

If the block is missing, the feature may be off, you may lack entity read access, or **no rows** currently match.

### Modules tile section (when Settings is on)

When the **Settings** dashboard feature is on, Home shows **module tiles** and a link to **Modules & data** in Settings. If Settings is off for your tenant, use the **sidebar module links** to navigate; **Modules & data** (templates, AI, import/export) lives under Settings when you can access it.

### Modules & data hub (Settings)

**Templates**, **Ask about your data**, **Export** (JSON), **Import from export JSON**, and **create module** (AI or custom) live under **Settings** → **Modules & data**, not on the Home overview. See [Ask about your data](#ask-about-your-data-ai) and [Export and import](#export-and-import).

---

## Modules and records (entities)

A **module** is a type of record (e.g. Customers, Jobs). Each module has **fields** you define. An **entity** is one record in that module.

### Opening a module

Click the module name in the sidebar or a module tile on Home. You land on the module’s default or selected **view** (list, board, or calendar).

### Creating a record

1. Open the module.
2. Click **New …** (label depends on module name).
3. Fill in fields and save.

### Editing a record

Open a row, card, or calendar item, or use links from **Approvals**, **Deadline attention**, or **Activity**. On the record page, change fields and save.

### Deleting a record

Use the delete action on the record page. Deletes are **soft**: the record is hidden from normal lists. Use **Show deleted** on the module view (when available) to list soft-deleted records and **restore** them.

### Hard delete (platform)

In rare cases a **platform administrator** may have a hard-delete option; this is destructive and not available to normal users.

### Cloning

Use **Clone** on a record to copy field values into a new entity (useful for templates or repeating entries).

### Pagination

Long lists are paginated. Use **Previous** / **Next** at the bottom.

### Record page extras (when configured)

- **Approvals**: request approval on the record.
- **Related data**: relation fields, **inverse relation backlinks** (records in other modules pointing here).
- **Payments**: if the module uses Stripe (payment/donation), pricing and checkout-related UI may appear.
- **Recent changes**: on some events, **field-level before/after** summaries appear in the activity section on the record.

---

## Deadlines, list priority, and Deadline attention

### Date fields marked as deadlines

For **date** fields, you can enable **Treat as deadline** (in field settings). That opt-in is used for:

1. **List / export priority** — how entities sort when a module has deadline fields.
2. **Home “Deadline attention”** — same rule: a record appears if **any** deadline field on the row matches its **priority window** (see below).

### List priority window (`deadlineListDaysAhead`)

Only applies when **Treat as deadline** is checked. Values are interpreted in the **tenant timezone** (“today” is the calendar date in that zone):

| Setting | Meaning |
|--------|---------|
| **Blank / omitted** | **Overdue only** — date strictly **before** today. |
| **0** | **Today or overdue** — date `≤` today. |
| **N > 0** | Date **on or before** today + **N** calendar days (includes overdue), i.e. a rolling horizon. |

**Multiple deadline fields** on one module: a row is prioritized if **any** deadline field qualifies under **its own** window (field order defines the specs; the row matches if any spec matches).

### Home “Deadline attention” list

The app loads **recently updated** entities per module (not every entity in the database). It keeps rows that match the same **priority** rule as above, then shows a short list (with a cap). Titles are taken from the **first field** in the module or common fallbacks (`name`, `title`).

So: configure deadlines on date fields and set windows appropriately; then **Deadline attention** and list ordering stay consistent.

---

## Field value highlights (conditional row colors)

On **Manage fields**, each field can have **Value highlights (JSON)** — optional rules that color **list cells** (and optionally other columns) when conditions match.

### Behavior

- Rules are an **array** of objects. The **first matching rule wins** (field order, then rule order in the JSON).
- Each rule has a **`when`** condition and a **`variant`** (preset tone) or custom **`colors`**.
- Preset tones: `blue`, `green`, `amber`, `red`, `gray` (legacy names `info`, `success`, `warning`, `danger`, `neutral` still work and map to those tones).
- Optional **`whenFieldSlug`**: evaluate the condition against **another field** in the same row (must match that field’s type for operators).
- Optional **`highlightFieldSlugs`**: apply the highlight to **other columns** instead of only the field that owns the rule.
- Optional **`colors`**: `{ "background": "#rrggbb", "accent": "#rrggbb" }` or `transparent` — overrides preset styling when valid.

### Example operators (`when.op`)

**General:** `empty`, `nonEmpty`, `equals`, `oneOf`, `contains` (optional `caseSensitive`), `gt`, `gte`, `lt`, `lte`, `between` (numbers), `betweenDates`, `before`, `after` (ISO `YYYY-MM-DD` dates), `isTrue`, `isFalse`.

**Date / deadline-oriented:** `deadlinePassed`, `deadlineNotPassed`, `deadlineDueToday`, `deadlineDueWithinDays` (with `days` — aligns with [deadline windows](#deadlines-list-priority-and-deadline-attention)).

Minimal example:

```json
[
  { "when": { "op": "oneOf", "values": ["Blocked", "Cancelled"] }, "variant": "red" },
  { "when": { "op": "equals", "value": "Review" }, "variant": "amber" }
]
```

Invalid JSON or malformed rules show an error when saving; fix the textarea and save again.

---

## Views: list, board, and calendar

Each module can have multiple **views**. A view stores:

- **Filters** (e.g. status = Open).
- **Sort** (e.g. by date).
- **Visible columns** (list view).
- **View type**: **List**, **Board**, or **Calendar**.

### Switching views

Use the view selector at the top of the module page. Create new views if you have [permission](#permissions-and-roles).

### List view

- Table with columns you choose.
- Filter and sort using the view configuration.
- **Export CSV**: downloads the filtered list as a spreadsheet.

### Board view

- Cards grouped by a **select** (dropdown) field (e.g. status).
- Drag cards between columns to update that field.
- You need at least one **select** field to drive the board.

### Calendar view

- Records placed by a **date** field.
- Navigate months with arrows.
- Requires at least one **date** field.

### Default view

Admins can set a **default view** per module. Opening the module selects that view.

---

## Fields and field types

From a module, open **Manage fields** to add, edit, reorder, or remove fields. **Slugs** are stable identifiers for APIs and URLs; **names** are shown in the UI.

Removing a field may be blocked while data exists; you may need to clear values or ask a platform admin.

### Field types (overview)

| Type | Typical use |
|------|-------------|
| **Text** | Free text, names, notes. |
| **Number** | Amounts, counts; supports comparisons in highlights. |
| **Date** | Calendar dates (`YYYY-MM-DD`); optional [deadline](#deadlines-list-priority-and-deadline-attention) behavior. |
| **Boolean** | Yes/no toggles. |
| **Select** | Options from a comma-separated list; good for status and board columns. |
| **Tenant user** | Pick a **workspace member** (user in your tenant). |
| **Relation (single)** | Link to **one** record in another module; optional display field and backlinks. |
| **Relation (multiple)** | Link to **many** records. |
| **File** | Upload or reference file storage (see UI for limits). |
| **JSON** | Structured data for advanced use; validate carefully. |
| **Activity** | Read-only **activity feed** on the record (preview limit configurable); not a normal user-editable value. |

### Showing in lists

Fields can be toggled **show in entity list** so they appear as columns in list views (subject to view column settings).

### Value highlights

See [Field value highlights](#field-value-highlights-conditional-row-colors).

---

## Relationships, tags, and backlinks

**Relation** fields point to another module’s entity. Configure **target module** and optionally **display field** (what label shows in the picker and lists).

**Inverse relation backlinks**: when enabled on the relation, the **target** record’s page can show incoming links from records that reference it.

**Tags** (if supported on your deployment) can be used for filtering and grouping in views.

---

## Approvals

Use approvals when a record must be **approved** before it is final (e.g. quotes, POs).

### Request approval

1. Open the record.
2. In the **Approvals** section, choose an **approval type** and submit.
3. If [email notifications](#settings) are enabled, approvers may get email.

### Approve or reject

1. Open **Approvals** in the sidebar.
2. Review pending items; open the record if needed.
3. **Approve** or **Reject** (optional comment).

Access requires **Approvals** and appropriate [permissions](#permissions-and-roles).

---

## Activity (audit log)

**Activity** lists **tenant-wide events**: creates, updates, deletes, logins, invites, API key changes, and more.

### Filters

Narrow by **user**, **event type**, **module**, and **date range**.

### Export CSV

Use **Export CSV** with the current filters for offline review or retention.

### Detail

Events may include **field-level** before/after information when the event payload supports it. Record pages may show a compact **changes** summary for recent entity updates.

---

## Consent

The **Consent** page lists **consent records** (who granted or revoked which consent type, and when). **Consent types** (labels like marketing, essential) are configured in **Settings** → **Consent types**.

- **Filters**: by user, type, and active/revoked.
- **Grant** (when permitted): record consent on behalf of a user.
- **Revoke**: sets a revocation timestamp; it does not erase history.

You need **read entities** to open Consent; **manage settings** is required for some actions (e.g. granting on behalf of others), depending on implementation.

---

## Finance

**Finance** covers **journal entries**, **exchange rates**, **fiscal periods**, and configuration (which modules represent **accounts** and **ledgers**, default ledger).

### Journal entries

Create entries with lines (debit/credit per account entity). Open a journal entry’s **date** for detail. Multi-currency setups use **exchange rates**.

### Exchange rates and fiscal periods

Add rates with effective dates. Define fiscal periods and optionally **close** periods to block further changes.

### Permissions

Finance management uses **Manage settings & billing** (`settings:manage`) for configuration and many actions. If you cannot see Finance, the **Finance** dashboard feature may be off or your role may lack access.

---

## Integrations

**Integrations** (sidebar) connects external services (e.g. accounting). It appears only when:

- The **Integrations** dashboard feature is on,
- **Developer setup** is enabled for the workspace, and
- You have **developer** permission.

**Settings** also includes **API access** and **Webhooks** under the Integrations group when your feature flags and permissions allow. See [Developers](#developers-api-webhooks-and-customer-logins).

---

## Team (users and roles)

### Users

Invite by email, assign roles, activate or deactivate users. Deactivation removes access without deleting history.

### Roles

Roles bundle [permissions](#permissions-and-roles). Edit roles in **Team** if you have **Manage users & roles**.

---

## Subscription and billing

Shows **plan**, **subscription status**, and a **billing portal** link (Stripe) when configured. If payment is past due, access may be limited until resolved.

---

## Settings

**Settings** opens a **hub of cards** grouped by:

1. **Customer site & public** — homepage, contact, SEO, public modules, waitlist, footer, cookie banner, **Stripe Connect**, **end-user accounts**.
2. **Workspace** — branding, default home, **Modules & data**, locale/timezone, email notifications, **feature flags** (customer-facing toggles).
3. **Integrations** — **API keys**, **webhooks** (developer setup + permissions).
4. **Consent & compliance** — **consent type** labels.

Which cards appear depends on:

- Your **permissions**,
- **Dashboard features** (e.g. customer-site cards hide if **Customer site** is off),
- **Developer setup** for API/webhooks.

### Developer setup (platform)

A platform admin can enable **developer setup** for your workspace so **API** and **Webhook** settings appear for users with **developer** permission.

### Email notifications

Opt in to emails for approvals, payments, webhook failures, etc. (Exact options depend on your tenant configuration.)

### Stripe Connect

Connect **your** Stripe account to charge customers on the public site; complete onboarding in the Stripe flow.

### End-user accounts

Customer logins for **custom frontends** using the Tenant API (JWT). Configure in Settings; backend needs `JWT_SECRET` for tokens.

---

## Ask about your data (AI)

Under **Settings** → **Modules & data**, **Ask about your data** lets you type a question in plain language. The app searches your records (full-text and, if configured, semantic search) and uses matching records as **context** for an answer.

When records were used, they appear as **Sources** with links.

You need **read** permission on entities.

---

## Export and import

### Export (JSON)

From **Settings** → **Modules & data**, **Export** downloads a **JSON** snapshot: modules, entities, relationships, and **finance** data where applicable. Use for **backup** or **migrating** to another workspace.

### Import

Upload a previously exported JSON file. Review the **import summary** for errors.

### Permissions

Export/import often requires **manage settings** or equivalent; your admin can confirm.

---

## Your public customer site

Customers can browse **public modules**, **contact** you, use **waitlists**, **checkout** (with Stripe Connect), and more — depending on configuration.

- **URL**: typically `https://<app-host>/s/<workspace-slug>`.
- **Preview site**: footer link in the dashboard when **Customer site** is enabled.
- **Configuration**: **Settings** → customer site sections (homepage, contact, public modules, SEO, cookie banner, etc.).

If the **Customer site** dashboard feature is off, the public site and preview link are unavailable.

---

## Permissions and roles

Permissions are strings attached to **roles**. Users receive one role per workspace (unless your platform uses a special default). A role can include `*` for **full access** (legacy / admin).

Standard permission labels used in the UI:

| Permission | Typical meaning |
|------------|-----------------|
| **Read entities** | View modules and records; Activity; Approvals; export; many read-only flows. |
| **Create & edit entities** | Create, update, delete (soft), restore; request approvals; consent actions. |
| **Manage modules & fields** | Create/edit modules and fields. |
| **Manage views** | Create/edit views and defaults. |
| **Manage settings & billing** | Workspace settings, Finance configuration, billing-related UI. |
| **Manage API keys, webhooks & integrations** | Developer integrations (with dashboard features + developer setup). |
| **Manage users & roles** | Team page: invites, roles. |

**Dashboard features** (platform-level) can still hide a route even if your role would allow it. **Feature** + **role** both apply.

---

## Developers: API, webhooks, and customer logins

- **Tenant API**: REST API under `/api/v1/tenants/...` with `X-API-Key`. See **`docs/TENANT_API.md`** and **`docs/openapi-tenant-api.yaml`** for endpoints, auth, rate limits, idempotency, soft delete, and `highlightRules` in field settings.
- **Webhooks**: outbound POSTs to your URL on entity events; configure a secret for verification.
- **Customer logins**: `POST .../auth/login` and `register` with API key; JWT in `Authorization: Bearer` for `auth/me`.

---

## Need more help?

- **Activity** — investigate who changed what.
- **Ask about your data** — **Settings** → **Modules & data**.
- **Tenant API** — developers: `docs/TENANT_API.md`.
- Workspace or **platform** administrators — for dashboard features, billing, or developer setup.
