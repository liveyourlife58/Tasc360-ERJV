# Future-proofing: accommodating the widest range of businesses and organizations

The schema includes several additions that help the same design serve many verticals and future needs without new migrations.

---

## Built-in future-proofing (in the schema today)

| Feature | Purpose | Who benefits |
|--------|---------|--------------|
| **Soft delete (`entities.deleted_at`)** | Set timestamp instead of hard delete; default lists filter `WHERE deleted_at IS NULL`. Enables undo, audit, and compliance (e.g. “show deleted” in admin). | All verticals: retail, nonprofit, professional services, healthcare, education. |
| **Tenant hierarchy (`tenants.parent_tenant_id`)** | Optional parent tenant per tenant. Enables franchise (brand → locations), white-label (reseller → end customer), or org trees (holding co → subsidiaries). Billing and access can be defined per parent or child in app logic. | Franchise, multi-location brands, agencies, platforms with resellers. |
| **Consent (`consents`)** | One row per (tenant, user, consent_type) with `granted_at`, optional `source`, and `revoked_at`. Answer “who consented to marketing/essential/analytics and when?” for GDPR and marketing. | Any org that collects user consent (EU, healthcare, education, nonprofit). |
| **Multi-ledger (`journal_entries.ledger_entity_id`)** | Optional link to a “Ledger” entity. When null, tenant has one default ledger; when set, supports multiple books (e.g. by region, brand, or legal entity). | Enterprises, multi-entity groups, franchises with separate P&L per location. |
| **Entity + relationship + JSONB + vector** | Custom modules/fields, graph edges with attributes, hybrid search. See [DATABASE_DESIGN.md#entity--relationship--jsonb--vector](DATABASE_DESIGN.md). | Any vertical that needs flexible data model and AI search. |
| **Views, exchange rates, fiscal periods, payment allocations** | Saved views, multi-currency, period close, split payments. | Global businesses, nonprofits, professional services. |

---

## How to use them

- **Soft delete:** On “delete” entity, set `deleted_at = now()`. On list/read, filter `deleted_at IS NULL` unless the user has “show deleted” permission. Restore by setting `deleted_at = null`.
- **Tenant hierarchy:** Create child tenants with `parent_tenant_id` set. App can aggregate reporting under parent, enforce “parent can see child data” (with care for tenant_id resolution), or bill parent for child seats.
- **Consent:** On signup or preferences, insert/update `consents` (e.g. `consent_type = 'marketing'`, `granted_at = now()`, `source = 'signup_form'`). On withdraw, set `revoked_at = now()`. For “can email?” use latest row per (user, consent_type) where `revoked_at IS NULL`.
- **Multi-ledger:** Create module “Ledger” and one entity per book. When creating journal entries, set `ledger_entity_id` when the tenant uses multiple ledgers; leave null for single-ledger tenants.

---

## Optional extensions (add when a vertical needs them)

| Need | Suggestion |
|------|------------|
| **Volunteer hours by non-users** | Add optional `volunteer_entity_id` to `time_entries` and allow `user_id` null when set. See [NONPROFIT.md](NONPROFIT.md). |
| **Entity version history** | Table `entity_versions` (entity_id, version, data snapshot, updated_at, updated_by) for “view previous version” and compliance. Or derive from `events` in app. |
| **Multiple webhook/integration endpoints** | Table `integration_endpoints` (tenant_id, type, url, secret, is_active) or store array in `tenants.settings`. |
| **Locale / timezone** | Prefer `tenants.settings` / `users.settings` (e.g. `locale`, `timezone`). Add columns only if you need to index or enforce at DB level. |
| **Rate cards (billable rates)** | Entity module “RateCard” or table (tenant_id, entity_id for user/service, rate_cents, effective_from, currency). |

---

## Verticals at a glance

| Vertical | Soft delete | Tenant hierarchy | Consent | Multi-ledger | Rest |
|----------|-------------|------------------|---------|--------------|------|
| **SMB / professional services** | ✓ | Optional (locations) | ✓ | Rarely | Entities, time, payments, views |
| **Nonprofit** | ✓ | Optional (chapters) | ✓ | Optional (funds) | Donors, donations, grants, programs; see [NONPROFIT.md](NONPROFIT.md) |
| **Franchise / multi-location** | ✓ | ✓ (brand → locations) | ✓ | ✓ (per location) | Entities, payments, reporting |
| **Education** | ✓ | Optional (districts/schools) | ✓ | Optional | Entities for students, courses, enrollments |
| **Healthcare** | ✓ | Optional (org → sites) | ✓ | Optional | Entities, audit (events), consent critical |
| **Retail / e‑commerce** | ✓ | Optional (brands) | ✓ | Optional | Entities, payments, allocations |
| **Enterprise** | ✓ | ✓ (group → subsidiaries) | ✓ | ✓ | Multi-ledger, approvals, fiscal close |

The combination of **soft delete**, **tenant hierarchy**, **consent**, and **multi-ledger** keeps one schema flexible for the highest number of businesses and organizations without degrading the critical path (entity/relationship/JSONB and tenant-first indexing).
