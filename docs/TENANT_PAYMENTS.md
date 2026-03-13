# Tenant-facing payments (tenants charge their customers)

Tenants can connect **their own** payment provider (Stripe, Square, PayPal, etc.) to charge **their customers** for invoices, orders, or services. The platform does not process or hold these funds; money goes to the tenant’s connected account.

## What the schema provides

| Piece | Purpose |
|-------|--------|
| **`tenants.settings`** | Store the tenant’s payment provider config (no raw secrets). See below. |
| **`payments`** table | One row per payment from the tenant’s customer, linked to an entity (e.g. invoice or order). |

### Payments table

| Column | Purpose |
|--------|--------|
| `tenant_id` | Which tenant received the payment. |
| `entity_id` | The entity this payment is for (e.g. invoice or order). |
| `amount_cents` | Amount in smallest currency unit (cents). |
| `currency` | ISO 4217 (e.g. `USD`). |
| `status` | e.g. `succeeded`, `pending`, `failed`, `refunded`. |
| `provider` | Which provider: `stripe`, `square`, `paypal`, etc. |
| `external_id` | Provider’s ID (e.g. Stripe `payment_intent_id` or `charge_id`) for idempotency and webhooks. |
| `metadata` | Extra provider-specific or app-specific data (JSON). |

Use `payments` to show “payments for this invoice,” total paid per entity, and to avoid duplicate webhook processing (lookup by `tenant_id` + `external_id`).

## Storing the tenant’s provider config

Store **per tenant** in `tenants.settings` (JSONB). Do **not** store raw API secrets in the DB; use OAuth or Connect so the provider gives you tokens or an account ID.

**Example (Stripe Connect):**

```json
{
  "paymentProvider": "stripe",
  "stripeConnectAccountId": "acct_xxx",
  "stripeConnectOnboardingComplete": true
}
```

After the tenant completes Connect onboarding, save `stripeConnectAccountId`. When creating a payment (e.g. PaymentIntent), use that account so funds go to the tenant.

**Example (Square):**

```json
{
  "paymentProvider": "square",
  "squareMerchantId": "MLXXX",
  "squareAccessTokenEncrypted": "..."
}
```

(Prefer OAuth and short-lived tokens where possible; if you must store tokens, encrypt and use a separate secrets store.)

**Example (multiple providers):**

```json
{
  "paymentProviders": {
    "stripe": { "connectAccountId": "acct_xxx", "onboardingComplete": true },
    "square": { "merchantId": "MLXXX" }
  },
  "defaultPaymentProvider": "stripe"
}
```

Your app reads the chosen provider from settings and uses the right SDK/API when creating charges or recording payments.

## Flow

1. **Tenant connects their account**  
   Use the provider’s OAuth or Connect flow; store only the resulting account ID (and optionally encrypted token) in `tenants.settings`. Do not store raw API keys in plaintext.

2. **Tenant charges their customer**  
   - Create the charge using the **tenant’s** connected account (e.g. Stripe Connect: create PaymentIntent with `stripe_account: tenant.settings.stripeConnectAccountId`).  
   - When the charge is created (or when the customer pays), insert a row in `payments`: `tenant_id`, `entity_id` = the invoice/order entity, `amount_cents`, `currency`, `status`, `provider`, `external_id` = provider’s payment/charge ID.

3. **Webhooks from the tenant’s provider**  
   - Provider sends events (e.g. `payment_intent.succeeded`) to your app.  
   - Identify the tenant (e.g. from the connected account ID or webhook metadata).  
   - Upsert `payments` by `tenant_id` + `external_id`: update `status` (and optionally `metadata`).  
   - Optionally emit an `event` (e.g. `payment_received`) for audit.

4. **UI**  
   - “Payments for this invoice” = list `payments` where `entity_id` = invoice entity.  
   - “Total paid” for an entity = sum `amount_cents` where `entity_id` and `status = 'succeeded'`.

## Entity link

The `entity_id` on `payments` points to whatever entity represents the thing being paid (usually an **invoice** or **order** entity in your modules). You can derive “customer” from the entity’s relationships (e.g. invoice → customer) if needed. No extra tables are required for that.

## Summary

- **Config:** Tenant’s payment provider (Stripe Connect, Square, etc.) is stored in `tenants.settings`; no raw secrets, use Connect/OAuth.  
- **Recording:** Each payment from the tenant’s customer is a row in `payments` with `tenant_id`, `entity_id` (invoice/order), amount, currency, status, provider, and `external_id`.  
- **Integration:** App uses tenant’s connected account to create charges; webhooks update `payments` by `external_id` so the tenant can easily see payments for their services or products.

---

## Implementation (Stripe Connect)

- **Env:** Same `STRIPE_SECRET_KEY` (platform). Optional: `STRIPE_CONNECT_WEBHOOK_SECRET` for Connect webhook (when `Stripe-Account` header is present).
- **Dashboard:** Settings → Payments (Stripe). “Connect Stripe” creates an Express Connect account, stores `stripeConnectAccountId` in `tenant.settings`, and redirects to Stripe Account Link (onboarding). Return URL `/dashboard/settings?stripe_connect=return` checks `account.charges_enabled` and sets `stripeConnectOnboardingComplete`.
- **Customer checkout:** When tenant has Connect onboarding complete and cart total > 0, checkout creates an Order with `status: pending_payment`, then a Stripe Checkout Session with `stripe_account: connectAccountId`, line items from cart, and metadata `orderId`, `tenantId`. Customer is redirected to Stripe; on success they land on thank-you. Webhook `checkout.session.completed` (with `Stripe-Account` header) updates the order to `completed` and creates a `Payment` row.
- **Webhook:** `POST /api/webhooks/stripe` — when `Stripe-Account` header is set, uses `STRIPE_CONNECT_WEBHOOK_SECRET` and handles Connect events (e.g. `checkout.session.completed`, `payment_intent.succeeded`).
