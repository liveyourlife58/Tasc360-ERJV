# Nonprofit use of the schema

The Tasc360-ERJV design is **largely comprehensive** for typical nonprofit needs. Almost everything maps to existing tables and the entity/relationship/JSONB model; one pattern benefits from a small optional extension.

---

## How nonprofit needs map to the schema

| Nonprofit need | How the schema supports it |
|----------------|----------------------------|
| **Donors / constituents** | Entity module (e.g. `constituent` or `donor`). One record can be donor, volunteer, member; use `data` or tags for type. |
| **Donations** | Entity module `donation`; `payments` row linked to donation entity (`entity_id`). Use same Stripe/payment provider flow (donor pays → payment recorded). |
| **Recurring giving** | `recurring_schedules`: template donation entity + frequency + `next_run_at`; app creates donation entities and charges per schedule. |
| **Pledges** | Entity module `pledge`; `data`: amount, due dates, payment schedule. Relationship constituent → pledge; optional `recurring_schedules` for reminder/fulfillment. |
| **Designations / split gifts** | One payment, multiple allocations: `payment_allocations` (payment_id, entity_id, amount_cents). Allocate to program/fund entities (e.g. $60 → Program A, $40 → Program B). |
| **Campaigns / appeals** | Entity module `campaign` or `appeal`. Relationship donation → campaign; or store `campaign_id` / appeal code in donation entity `data`. |
| **Soft credits** | Relationship with `data`: e.g. donation → constituent, `relation_type` `donor_credit`, `data` = `{ "amount_cents", "is_soft_credit": true }`. Multiple relationships per donation for spouse, company match, etc. |
| **Tribute / memorial** | Donation entity `data`: `tribute_type`, `tribute_name`, `notify_name`, `notify_address`. |
| **Restricted vs unrestricted / fund accounting** | Chart of accounts as entities (e.g. “Cash – Unrestricted”, “Cash – Restricted – Program X”). `ledger_lines` use `account_entity_id`; fund or restriction in account entity `data` or via relationship account → fund entity. |
| **Grants** | Entity module `grant`; `data`: funder, amount, period, reporting_due, restrictions. Relationships grant → program; journal entries for grant revenue and expense. |
| **Programs / services** | Entity module `program`; relationships to grants, donations (restriction), and outcome entities. |
| **Outcomes / impact** | Entity module (e.g. `outcome` or `impact_metric`); `data`: metric, value, period; relationship to program. |
| **Volunteers** | **Option A:** Constituents as entities; volunteer hours as entities (module `volunteer_hours`) with `data`: { constituent_id, opportunity_id, hours, date }. No schema change. **Option B:** Volunteers as platform users; use `time_entries` (user_id, job_entity_id = opportunity, hours). **Option C (optional extension):** Add optional `volunteer_entity_id` to `time_entries` and allow `user_id` null when set, so staff can log hours on behalf of constituent volunteers. |
| **Volunteer opportunities** | Entity module `volunteer_opportunity` or use “job”/“event”; relationship to program/location. |
| **Members / membership** | Entity module `membership`; `data`: level, start, expiry, benefits; relationship constituent → membership. Renewals via `recurring_schedules` or app logic. |
| **Board / governance** | Entity module `board_member` or use constituent + relationship to “Board” entity; `data`: term_start, term_end, committee, role. |
| **In-kind donations** | Entity module `in_kind_donation`; `data`: description, value, date, donor. Journal entry for audit (debit in-kind asset, credit revenue) if needed. |
| **Thank-you / acknowledgment** | `events` (e.g. `event_type`: `ack_sent`); or entity `data` on donation (ack_date, method). |
| **Compliance / audit** | `journal_entries`, `ledger_lines`, `fiscal_periods` (close periods); `events` for audit trail; `created_by` on key tables. |
| **990 / reporting** | Report logic in app (or materialized views) over entities + journal_entries + payments; no new tables required. |

---

## Summary: covered vs optional extension

- **Fully supported with current schema:** Donors, donations, recurring giving, pledges, designations, campaigns, soft credits, tribute, fund accounting, grants, programs, outcomes, in-kind, membership, board, compliance, and (with entity-based volunteer hours or platform users) volunteers.
- **Optional extension for volunteer hours:** If you want volunteer hours in the same table as staff time (`time_entries`) and logged by staff on behalf of constituents who do **not** have platform accounts, add to `time_entries`:
  - `volunteer_entity_id` (optional, FK to `entities`) and
  - make `user_id` optional when `volunteer_entity_id` is set.

  Otherwise, model volunteer hours as **entities** (e.g. module `volunteer_hours` with relationship to constituent and opportunity); no schema change.

---

## Conclusion

The design is **fully comprehensive for typical nonprofit needs** as long as you accept one of:

- Volunteer hours as **entities** (constituent + opportunity + hours in `data`), or  
- Volunteers as **users** and `time_entries` as-is, or  
- The **optional** `time_entries.volunteer_entity_id` extension for staff-logged volunteer time.

Everything else (donors, donations, designations, campaigns, grants, programs, fund accounting, compliance, fiscal close) fits the existing schema.
