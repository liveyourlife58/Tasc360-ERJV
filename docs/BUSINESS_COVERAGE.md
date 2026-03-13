# Business coverage — what the schema supports

This doc maps common business needs to the schema so you can see what’s covered and what is left to app logic or optional extensions.

---

## Covered in schema (tables + entities)

| Need | How |
|------|-----|
| **Multi-tenant SaaS** | `tenants`, `tenant_id` on all tables, optional RLS. |
| **Users, roles, permissions** | `users`, `roles` (per-tenant); permissions in JSON. |
| **Custom data model** | `modules`, `fields`, `entities` (Notion-style). |
| **CRM (leads, opportunities, contacts)** | Entities + relationships; activities in `events`. |
| **Jobs, work orders, projects** | Entities; job → work order via relationships. |
| **Estimates, quotes** | Entities; link to customer/job via relationships. |
| **Invoicing & AR** | Invoice entity; `payments` linked to invoice entity. |
| **AP (bills, vendor payments)** | Bill entity; `payments` with type/metadata for outgoing. |
| **Double-entry accounting** | `journal_entries`, `ledger_lines` (accounts = entities). |
| **Employee hours** | `time_entries` (user, job, optional work order, hours, date). |
| **Tenant charges their customers** | `payments` + provider config in `tenants.settings`. |
| **Platform billing (Stripe)** | Stripe fields on `tenants`; per-user or fixed price. |
| **Approvals (quote, PO, time-off, expense)** | `approvals` (entity_id, type, requested_by, status, decided_by). |
| **Tags/labels on any entity** | `entity_tags` (tenant, entity, tag); filter “all with tag X”. |
| **Recurring (invoices, subscriptions)** | `recurring_schedules` (entity template, frequency, next_run_at). |
| **Payment allocation (one payment → many invoices)** | `payment_allocations` (payment_id, entity_id, amount_cents). |
| **Saved views (list/board/calendar)** | `views` (module_id, view_type, filter, sort, columns as JSON). No new schema; queries still use entities + indexes. |
| **Multi-currency rates** | `exchange_rates` (tenant, from_currency, to_currency, rate, effective_date). |
| **Fiscal period close** | `fiscal_periods` (tenant, period_start/end, closed_at, closed_by); app blocks new entries when closed. |
| **Documents** | `files` (entity_id, url, name, mime_type). |
| **Audit / activity** | `events`; `created_by` on entities and journal entries. |
| **AI search** | `embeddings` (+ optional pgvector); `entities.search_text` + FTS. |
| **Soft delete** | `entities.deleted_at`; app filters `WHERE deleted_at IS NULL` for default lists; enables undo and compliance. |
| **Tenant hierarchy** | `tenants.parent_tenant_id` (franchise, white-label, org tree). |
| **Consent (GDPR / marketing)** | `consents` (tenant, user, consent_type, granted_at, revoked_at, source). |
| **Multi-ledger** | `journal_entries.ledger_entity_id` (optional; null = default ledger). |

---

## Modeled via entities + relationships (no extra tables)

| Need | How |
|------|-----|
| **Locations, branches, warehouses** | Entity module “Location”; link other entities via relationship. |
| **Products, inventory items** | Entity modules; quantities/levels in `data` or hybrid table. |
| **Vendors, suppliers** | Entity module; relationship product → vendor. |
| **Territories, sales regions** | Entity module; link to users or accounts via relationship. |
| **Projects, phases** | Job/project entity; work orders or phase entities + relationships. |
| **Contracts, terms** | Entity; dates and terms in `data`; link to customer. |
| **BOM / manufacturing** | Product entity; components as child entities or `data`; relationships. |

---

## Performance and customization (without degrading critical path)

- **Custom fields** live in `entities.data` (JSONB), not in EAV rows. One document per entity; GIN index on `data` for containment queries. Adding tenant-defined fields does **not** add tables or joins.
- **Saved views** are stored config only (`views.filter`, `views.sort`, `views.columns`). The app still queries `entities` with `tenant_id` + `module_id` and applies filter/sort in the same way; no new query shape.
- **Indexing:** All tenant-scoped tables use `tenant_id` (and often `tenant_id, module_id` or `tenant_id, entity_id`) first in composite indexes so tenant isolation is efficient.
- **Heavy reporting** (e.g. P&L, aging) can use materialized views or reporting tables that you refresh; base writes stay on the same tables.

## Handled in app or tenant settings

| Need | Where |
|------|--------|
| **Notifications** | User preferences in `users.settings`; app sends email/push on `events`. |
| **Webhooks / integrations** | Webhook URL in `tenants.settings`; app calls on relevant events. |
| **Saved reports / dashboards** | `views` for list/board/calendar; complex reports in app or materialized views. |

---

## Optional / vertical-specific (add if needed)

| Need | Suggestion |
|------|------------|
| **Nonprofit (donors, grants, programs, volunteer hours)** | Fully supported with current schema; see [NONPROFIT.md](NONPROFIT.md). Optional: add `volunteer_entity_id` to `time_entries` if staff must log hours for constituents without platform logins. |
| **Lot/serial tracking** | Hybrid table `inventory_lots` (entity_id, lot_number, quantity) or in entity `data`. |
| **Advanced manufacturing** | Work orders + BOM as entities; routing in `data` or separate table. |
| **Payroll runs** | Journal entries for pay run, or entity “PayRun” with lines in `data`. |
| **Document versioning** | `file_versions` (file_id, version, url) or versions in `files.metadata`. |
| **Email/comm log** | `events` with event_type “email_sent”, data = { to, subject, id }. |

---

## Summary

The schema aims to cover the **largest number of businesses** by providing:

- **Core:** Multi-tenant, users/roles, flexible entities + relationships, audit.
- **Money:** Invoicing, payments + allocations, double-entry ledger, exchange rates, fiscal periods, platform billing.
- **Operations:** Jobs, work orders, time entries, approvals, tags, recurring.
- **Customization:** Custom modules/fields (data in JSONB, GIN indexed); saved views (filter/sort/columns as JSON); tags on any entity. No EAV — critical path stays fast.
- **Extensibility:** Integrations and notifications in app/settings.
- **Future-proofing:** Soft delete, tenant hierarchy, consent, multi-ledger. See [FUTURE_PROOFING.md](FUTURE_PROOFING.md).

What’s **not** in the base schema (multi-currency details, period close, allocation table, exchange rates) can be added as small tables or handled in app logic and tenant settings when you need them.
