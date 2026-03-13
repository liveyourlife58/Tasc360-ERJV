# Billing with Stripe (subscription per tenant)

The schema supports both **per-user** and **fixed (set) price** subscriptions. Same tenant fields; only the Stripe Price type and whether you update quantity differ.

## What the schema provides

| Field | Purpose |
|-------|--------|
| `tenants.stripe_customer_id` | Stripe Customer ID (`cus_xxx`). Create when tenant signs up or starts trial. |
| `tenants.stripe_subscription_id` | Stripe Subscription ID (`sub_xxx`). Set when subscription is created; clear when canceled. |
| `tenants.subscription_status` | Mirror of Stripe status: `active`, `past_due`, `canceled`, `trialing`, etc. Update from webhooks. |
| `tenants.subscription_current_period_end` | End of current billing period. Use to gate access and show renewal date. |
| `tenants.plan` | Plan tier (e.g. `starter`, `pro`). Can map to Stripe Price IDs in your app or `settings`. |
| `users` (per tenant) | User count = `SELECT count(*) FROM users WHERE tenant_id = $tenantId AND is_active = true`. |

## Two billing models

| Model | Stripe Price type | Quantity | When to update subscription |
|-------|--------------------|----------|----------------------------|
| **Per user** | Per-seat (e.g. $X/user/month) | = active user count | Update quantity whenever the tenant’s user count changes. |
| **Set (fixed) price** | Standard/fixed (e.g. $99/month) | Usually 1 | No need to update when users change. |

Same `tenants` fields for both; only the Price you attach and your app logic differ.

---

## Flow (shared)

1. **Tenant signup**  
   Create Stripe Customer; save `stripe_customer_id` on the tenant. Optionally start a trial (no subscription yet).

2. **Subscribe**  
   - **Per user:** Create a Stripe Subscription with a **per-seat** Price; set **quantity** = current active user count for that tenant.  
   - **Set price:** Create a Stripe Subscription with a **fixed** Price (e.g. $99/month); **quantity** = 1 (or leave default).  
   - In both cases save `stripe_subscription_id`, `subscription_status`, `subscription_current_period_end` on the tenant.

3. **When user count changes**  
   - **Per user:** On user create/delete (or activate/deactivate), recalculate user count and call Stripe to update the subscription item quantity ([Update a subscription](https://stripe.com/docs/api/subscriptions/update)); Stripe prorates.  
   - **Set price:** Do nothing; billing does not depend on user count.

4. **Webhooks**  
   - `customer.subscription.updated` → update tenant’s `subscription_status`, `subscription_current_period_end`.  
   - `customer.subscription.deleted` → set `subscription_status = 'canceled'`, clear `stripe_subscription_id` (or leave it for history).  
   - `invoice.paid` / `invoice.payment_failed` → optional: record in `events` or a separate billing_events table for audit.

5. **Access control**  
   - Before allowing access, check `subscription_status IN ('active', 'trialing')` and optionally `subscription_current_period_end > now()`.  
   - If past_due or canceled, restrict or show upgrade/billing page.

## Optional: store Price ID and billing type per plan

Store mapping in app config or in `tenants.settings`, e.g.:

```json
{
  "stripePriceId": "price_xxx",
  "stripeProductId": "prod_xxx",
  "billingType": "per_user"
}
```

- **Per user:** `billingType: "per_user"` → when creating subscription use the per-seat Price and set quantity to tenant’s user count; when users change, update quantity.  
- **Set price:** `billingType: "fixed"` (or omit) → use a fixed Price, quantity = 1; ignore user count for billing.

You can also infer from the Stripe Price (e.g. `recurring.aggregate_usage === 'sum'` vs fixed) if you prefer not to store `billingType`.

## User count query

```sql
SELECT count(*) FROM users WHERE tenant_id = $1 AND is_active = true;
```

Use this whenever you create/update a Stripe subscription or report usage.

## Summary

- **Schema:** Same tenant fields for both models; no schema change needed for set price.  
- **Per user:** Use a per-seat Stripe Price; set quantity to active user count; update quantity when users change.  
- **Set price:** Use a fixed Stripe Price; quantity = 1; do not update on user change.  
- **Webhooks:** Use in both cases to keep `subscription_status` and `subscription_current_period_end` in sync.

---

## Implementation (platform billing)

- **Env:** `STRIPE_SECRET_KEY` (platform), `STRIPE_WEBHOOK_SECRET` (platform webhook), `STRIPE_PLATFORM_PRICE_ID` (per-seat or fixed Price ID). Optional: `STRIPE_TRIAL_DAYS`, `NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`) for redirect URLs.
- **Dashboard:** Subscription & team page (`/dashboard/subscription`) shows plan breakdown, status, “Subscribe with Stripe” (Checkout Session) and “Manage billing” (Customer Portal). After checkout success (`?session_id=...`), subscription is synced to the tenant.
- **Webhook:** `POST /api/webhooks/stripe` — no `Stripe-Account` header = platform events: `customer.subscription.updated` / `created` / `deleted` → sync or clear tenant subscription.
- **User count:** When adding or deactivating users (`addTenantUser`, `updateTenantUser`), `updatePlatformSubscriptionQuantity(tenantId)` is called so per-seat quantity stays in sync.
