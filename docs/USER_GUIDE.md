# How to use the app

This guide explains how to use the dashboard and your public site. You can manage your data, team, billing, and settings from one place.

---

## Table of contents

1. [Getting started](#getting-started)
2. [Dashboard home](#dashboard-home)
3. [Modules and entities](#modules-and-entities)
4. [Views: list, board, and calendar](#views-list-board-and-calendar)
5. [Fields and relationships](#fields-and-relationships)
6. [Approvals](#approvals)
7. [Activity (audit log)](#activity-audit-log)
8. [Finance](#finance)
9. [Integrations](#integrations)
10. [Team (users and roles)](#team-users-and-roles)
11. [Subscription and billing](#subscription-and-billing)
12. [Settings](#settings)
13. [Ask about your data (AI)](#ask-about-your-data-ai)
14. [Export and import](#export-and-import)
15. [Your public customer site](#your-public-customer-site)
16. [Permissions](#permissions)

---

## Getting started

After you log in, you land in the **dashboard**. The sidebar on the left is your main navigation:

- **Workspace**: **Home** plus each of your **modules** (e.g. Customers, Jobs, Invoices).
- **Settings & billing**: Approvals, Activity, Finance, Integrations, Team, Subscription & billing, Settings.
- **Footer**: **Preview site** (opens your public site in a new tab) and **Log out**.

If you have no modules yet, the home page will prompt you to **start from a template** or **describe what you need** so the app can suggest modules. You can also create a custom module by describing it in plain language.

---

## Dashboard home

From **Home** you can:

- See and open all your **modules**.
- **Ask about your data**: type a question to get answers based on your records (see [Ask about your data (AI)](#ask-about-your-data-ai)).
- **Export** your data as a JSON file (backup or move to another workspace).
- **Import** data from a previously exported JSON file.
- Create a **new module** (template or custom).

If your administrator has set a **default home**, you may be redirected to a specific module or view instead of the modules list.

---

## Modules and entities

A **module** is a type of record in your workspace (e.g. Customers, Projects, Invoices). Each module has a list of **fields** (name, date, amount, status, etc.) that you define.

An **entity** is a single record in a module (e.g. one customer, one invoice). You create and edit entities from the module’s page.

### Opening a module

Click the module name in the sidebar (under **Workspace**). You’ll see the list (or board/calendar view) of records for that module.

### Creating a record

1. Open the module.
2. Click **New [record type]** (e.g. **New customer**).
3. Fill in the fields and save.

### Editing a record

Click a row (or card) in the list/board/calendar, or use the link to open the record. Change any fields and save.

### Deleting a record

On the record’s page, use the delete option. Records are **soft-deleted**: they are hidden from the main list but can be restored. Use **Show deleted** on the module page to see them, then **Restore** if needed.

### Cloning a record

From a record’s page you can **Clone** to create a copy with the same field values (handy for templates or duplicates).

### Pagination

Long lists are paginated. Use **Previous** / **Next** at the bottom to move between pages.

---

## Views: list, board, and calendar

Each module can have multiple **views**. A view stores:

- **Filters** (e.g. status = Open, date after last month).
- **Sort** (e.g. by date, by name).
- **Visible columns** (list view).
- **View type**: **List**, **Board** (Kanban), or **Calendar**.

### Switching views

Use the view selector near the top of the module page. Pick an existing view or create a new one.

### List view

- Table with columns you choose.
- Filter and sort using the view’s configuration.
- **Export CSV**: download the current (filtered) list as a spreadsheet.

### Board view

- Cards grouped by a **status** (or similar) field (e.g. To do, In progress, Done).
- Drag and drop cards between columns to update that field.
- You must have at least one **select** (dropdown) field to use as the board column.

### Calendar view

- Records shown on a calendar by a **date** field.
- You need at least one **date** field to use the calendar.
- Use the arrows to change month.

### Saving a view

After setting filters, sort, and columns (or board/calendar options), save the view and give it a name. You can set one view as the **default** so the module opens to it automatically.

### Default view

Admins can set a **default view** per module. When you open that module, you’ll land on that view instead of the first one.

---

## Fields and relationships

### Managing fields

From a module page, click **Manage fields**. You can:

- **Add** a field: name, type (text, number, date, boolean, select, relation, file, etc.), required/optional, and for select/relation the options.
- **Edit** a field: change label, type, options.
- **Reorder** fields (they appear in that order on forms and lists).
- **Remove** a field (only if you’re sure; existing data in that field may be lost).

Field **slugs** are used internally and in the API; names are what users see.

### Relationship fields

A **relation** field links a record to another record (possibly in another module). For example, an Invoice can have a relation to a Customer. When you add a relation field, you choose the **target module** and optionally the **relation type** (e.g. “customer” or “bill_to”). Relationships can be one-to-one or one-to-many depending on how you use them.

### Tags

You can add **tags** to records (e.g. “vip”, “urgent”) and filter or group by tag in views.

---

## Approvals

Use approvals when a record must be approved before it’s considered final (e.g. quotes, purchase orders, time off).

### Requesting approval

1. Open the record.
2. In the **Approvals** section, choose an **approval type** (e.g. Quote, PO) and submit.
3. If email notifications are on, approvers may receive an email.

### Approving or rejecting

1. Go to **Approvals** in the sidebar.
2. You’ll see pending requests with type, record, requester, and date.
3. Open the record if needed, then **Approve** or **Reject** (with an optional comment).

Only users with the right permissions see the Approvals page and can approve or reject.

---

## Activity (audit log)

**Activity** shows a log of what happened in your workspace: who did what and when (e.g. record created/updated/deleted, logins, user invites, API key changes).

Use the filters to narrow by:

- **User**
- **Event type**
- **Module**
- **Date range**

This helps with compliance, support, and debugging. Some events (e.g. sensitive actions) are always recorded. Activity can also be **exported** for external audit or retention.

---

## Finance

The **Finance** area is for accounting and reporting: ledgers, journal entries, exchange rates, and fiscal periods.

### Ledgers and accounts

- **Ledgers** are typically entities in a “Ledger” (or “Account”) module.
- In **Settings** (or Finance settings), you can set which module is used for **accounts** and which for **ledgers**, and choose a **default ledger**.

### Journal entries

- **New journal entry**: choose date, reference, description, and add **lines**. Each line has an account (entity), debit or credit amount, and optional memo.
- From the Finance page, click a journal entry **date** to open its **detail**: view all lines and totals. If the entry was synced to an external system (e.g. QuickBooks), that is shown there too.
- Journal entries can be in different **currencies** if you use multi-currency (exchange rates).

### Exchange rates

If you use multiple currencies, add **exchange rates** (from/to currency, rate, effective date) so amounts can be converted for reporting.

### Fiscal periods

Define **fiscal periods** (start/end dates). You can **close** a period so no further changes are allowed (optional; depends on your workflow).

### Permissions

Finance pages may be restricted to users with **settings** or **finance** permissions; ask your admin if you don’t see them.

---

## Integrations

**Integrations** is where you connect external services (e.g. accounting software) to your workspace.

- Open **Integrations** from the sidebar to see connected services and their status.
- When connect flows are available (e.g. QuickBooks Online), you will be able to link your account from this page; the app will then be able to sync data (e.g. journal entries, customers) according to the integration.
- If your administrator has not enabled integration encryption for the platform, the page will show a short note; connect buttons appear once that is configured.

---

## Team (users and roles)

**Team** is where you manage **users** and **roles** for your workspace.

### Users

- See all users: email, name, role, active status.
- **Add user**: invite by email; they receive a link to set their password and join.
- **Edit user**: change name, role, or active status.
- Deactivating a user removes access without deleting history.

### Roles

- **Roles** define what a user can do (e.g. “Editor”, “Viewer”, “Admin”).
- Each role has a set of **permissions** (e.g. read entities, manage entities, manage users, manage settings).
- Create or edit roles from the **Roles** section on the Team page; then assign that role to users.

Only users with **manage users** permission can invite or edit users and manage roles.

---

## Subscription and billing

**Subscription & billing** shows:

- Your current **plan** and **subscription status** (e.g. active, trialing, past_due).
- **Billing portal**: update payment method, view invoices, or change plan (if your administrator enabled it).

If your workspace is behind on payment, access may be limited until the subscription is active again. The exact behavior (e.g. grace period) is set by the platform.

---

## Settings

**Settings** is split into sections. What you see depends on your **permissions** (e.g. only admins may see billing or API keys).

### Dashboard (backend) settings

- **Branding**: dashboard name and logo.
- **Default home**: open to a specific module or view when users go to Home.
- **Feature flags**: turn customer-facing features on or off (e.g. waitlist, donations).
- **Locale & format**: date and number format for your workspace.
- **Email notifications**: opt in to emails for approval requests, payments, webhook failures, etc.

### Customer site (public site) settings

- **Homepage**: hero image, tagline, main content, sidebar module and fields.
- **Contact**: contact details and optional extra content.
- **Public modules**: which modules (e.g. Events, Products) are visible on the public site and in the nav.
- **SEO**: meta title, description, Open Graph image, canonical URL, custom domain.
- **Waitlist**: if you use a waitlist, configure the module and fields for it.

### Payments (your customers)

- **Stripe Connect**: connect your own Stripe account so you can charge **your** customers (e.g. for orders, events, donations). Follow the link to complete Stripe onboarding. After that, payments can be recorded against orders/invoices and optionally shown in the dashboard (refunds, etc.).

### API access

- **API keys**: create or revoke keys for the **Tenant API**. Use these to build custom apps or integrations that read/write your data. Keep keys secret; revoke any that are leaked.

### Webhooks

- **Outbound webhooks**: add a URL and optional secret. The app will send HTTP POST requests when certain events happen (e.g. entity created/updated/deleted). Use this to sync with other systems or trigger automations.

---

## Ask about your data (AI)

From **Home**, use **Ask about your data** to type a question in plain language. The app will:

1. Search your records (using full-text and, if configured, semantic search).
2. Use the relevant records as context to answer your question.

If AI is configured, you get richer answers; otherwise answers are based on full-text search only. When records were used to answer, they appear as **Sources** with links so you can open the record.

You need **read** permission on entities to use this.

---

## Export and import

### Export

- From **Home**, use **Export** to download a **JSON file** of your workspace data: modules, entities, relationships, and **finance data** (journal entries with lines, exchange rates, fiscal periods). Use this for backups or to move data to another workspace.

### Import

- From **Home**, open **Import from export JSON** and upload a previously exported JSON file. The app will create or update data according to the file. Check the import summary for any errors.

Export and import are usually restricted to users with the right permissions (e.g. settings or admin).

---

## Your public customer site

Your workspace has a **public site** where your customers can:

- See the homepage and any content you configured.
- Browse public modules (e.g. events, products).
- Submit forms, register, or place orders (depending on your setup and Stripe Connect).
- View “My orders” or similar pages if you enabled them.

- Use **Preview site** in the dashboard footer to open this site in a new tab.
- Configure it under **Settings** → customer site sections (homepage, contact, public modules, SEO, etc.).
- The URL is typically something like: `https://your-app.com/s/your-workspace-slug`.

---

## Permissions

What you can see and do depends on your **role** and its **permissions**. For example:

- **Read entities**: view module lists and record details; Activity log and Approvals page; export (backup).
- **Manage entities**: create, edit, delete, restore records; request approvals; approve or reject; record or revoke consent.
- **Manage views**: create, edit, delete views; set filters, sort, and default view.
- **Manage modules/fields**: create or edit modules and fields (often admin only).
- **Manage users**: invite users, edit roles, assign permissions (Team page).
- **Manage settings**: change workspace settings, API keys, webhooks, billing; Finance and Integrations pages.

If you don’t see a menu item or get an error when performing an action, your role may not have the required permission. Ask an administrator to adjust your role or create a new one. Administrators can refer to the full permission list and default roles in the platform documentation.

---

## Need more help?

- Use **Activity** to see what changed and who did it.
- Use **Ask about your data** for quick answers from your records.
- For API integration details, your developer can refer to the **Tenant API** documentation (endpoints, authentication, and limits).
