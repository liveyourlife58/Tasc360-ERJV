# Tenant accounting: what the schema supports

## What you have today (without ledger)

| Need | Supported | How |
|------|-----------|-----|
| **Invoices** | Yes | Entity (e.g. module "Invoice"); `data` holds lines, totals, due date, customer ref. |
| **Customers / vendors** | Yes | Entities + relationships (e.g. customer → invoice). |
| **Payments from customers (AR)** | Yes | `payments` table: `entity_id` = invoice; amount, status, provider, `external_id`. |
| **Payments to vendors (AP)** | Yes | Same `payments` table with a type or `metadata.provider` indicating "outgoing"; link `entity_id` to a bill/purchase entity. |
| **Audit trail** | Yes | `events` + `created_by` on entities; log who did what. |
| **Documents** | Yes | `files` attached to any entity (invoices, bills). |

So tenants can do **invoicing, AR, AP, and basic audit** using entities + relationships + `payments` + `events`.

## What’s still optional

- **Payment allocation** — One payment applied to multiple invoices, or partial payments. Today: one `payments` row per payment with one `entity_id`. Allocations can be stored in `payments.metadata` (e.g. `{ "allocations": [{ "entity_id": "...", "amount_cents": 5000 }] }`) or in a small `payment_allocations` table if you want first-class queries.
- **Period close** — “Lock” a month/quarter so no more edits. Usually a small table (e.g. `fiscal_periods`: tenant_id, period_end, closed_at) or in `tenants.settings`; app enforces “no new entries before closed period.”

## General ledger (double-entry) in the schema

- **`journal_entries`** — One row per entry: tenant_id, entry_date, reference, description, status (draft/posted), created_by.
- **`ledger_lines`** — One row per line: journal_entry_id, account_entity_id (FK to entities — use an “Account” module), debit_cents, credit_cents, currency, description, optional source_entity_id (e.g. invoice or payment entity).  
  The app (or a DB trigger) must enforce **sum(debit_cents) = sum(credit_cents)** per journal entry.

With that, tenants get:

- **Double-entry** — Every financial change is a posted journal entry with balanced lines.
- **P&L and balance sheet** — From ledger_lines grouped by account (and account type), by period.
- **Chart of accounts** — Model accounts as entities (module "Account"); ledger lines reference `account_entity_id`.
- **Traceability** — `source_entity_id` links a line to an invoice, bill, or payment entity.

Optional next steps (not in schema by default):

- **Payment allocations** — Table or `payments.metadata` to split one payment across multiple invoices.
- **Fiscal periods** — Table or settings for period-end dates and “closed” flag; app blocks new entries in closed periods.

## Summary

| Area | Status |
|------|--------|
| Invoicing, AR, AP, customers, vendors | Supported via entities + `payments` + relationships. |
| Double-entry general ledger | Supported via `journal_entries` + `ledger_lines` (account = entity). |
| P&L / balance sheet | Derived from `ledger_lines` + account entities. |
| Audit | `events` + `created_by`; ledger is append-only (post then don’t delete; use reversal entries). |
| Allocation / period close | App logic + metadata or small future tables. |

So the design **does** give tenants the core they need for a full accounting system: general ledger plus the existing entities and payments.
