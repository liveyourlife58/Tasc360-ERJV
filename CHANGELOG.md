# Changelog

All notable changes to the project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Team page:** Dedicated **Dashboard → Team** for users and roles. List users (email, name, role, status, added); add user (with invite-by-email); edit user (role, name, email, password, active). **Roles** section: list roles with user count, create role, edit role (name, description, permissions checkboxes). Sidebar now has **Team** and **Subscription & billing**; subscription page still includes the team section.
- **429 UX on login/forgot-password:** Login and forgot-password forms now submit via `fetch` to `POST /api/auth/login` and `POST /api/auth/forgot-password`. When middleware returns 429 (rate limit), the client reads the JSON body and displays the error message. Successful login redirects; forgot-password shows success/error from the API response. Middleware rate-limits both the page paths and the API paths.
- **GAPS "Last updated":** Updated to mention Team page, E2E smoke tests, auth 429 UX, health/ready, and related work.
- **Deploy verification (doc):** README and LAUNCH_SETUP now note verifying deploy with `curl .../api/health` and `curl .../api/ready`.
- **E2E smoke tests:** Playwright smoke tests in `tests/e2e/smoke.spec.ts`: `GET /api/health` (expect 200 + status ok), `GET /api/ready` (200 or 503), optional `GET /api/v1/tenants/:slug/modules` when `E2E_API_KEY` is set. Run with `npm run test:e2e` (start the app first or use webServer in config). CI: `npm run test:e2e:ci`.
- **API version header:** All `/api/v1/*` responses include `X-API-Version: 1` so clients can detect and lock to the API version. Documented in [TENANT_API.md](docs/TENANT_API.md).
- **.nvmrc:** Node 20 is pinned for local and CI; README setup step added.
- **Stripe webhook audit:** Successful Stripe webhook processing (platform or Connect) is logged to the Activity log as `stripe_webhook_processed` with `stripeEventId` and `type`. Tenant is resolved from Connect account or event metadata/subscription.
- **security.txt:** `GET /.well-known/security.txt` returns a security policy (RFC 9116). Update `Contact` and `Expires` in `app/well-known/security.txt/route.ts` for your deployment.
- **OpenAPI X-API-Version:** The minimal tenant API spec documents the `X-API-Version` response header on success responses.
- **Auth rate limit 429 + Retry-After:** Login and forgot-password IP rate limiting now runs in middleware; when over limit the response is `429 Too Many Requests` with `Retry-After: 900` (seconds) and a JSON error body so clients can back off or show a countdown.
- **Stripe processed events retention:** README notes that `stripe_processed_events` can be pruned (e.g. delete rows older than 90 days) if the table grows large.
- **Request timeout (doc):** TENANT_API.md states that clients should set a request timeout (e.g. 30s); the server does not enforce one.
- **GAPS doc:** Read permission and public form rate limit rows updated to **Done**.
- **Auth rate limiting (IP):** Login and forgot-password are rate-limited by IP (in-memory; 20 attempts / 15 min for login, 5 / 15 min for forgot-password) to reduce brute force and credential stuffing.
- **Readiness vs liveness:** `GET /api/health` is now a lightweight liveness probe (200 + version/buildId, no DB). `GET /api/ready` runs full dependency checks (DB, Resend, Stripe, webhook retries) and returns 503 when not ready. Both are allowed during maintenance mode.
- **Read permission enforcement:** Entity list and entity detail dashboard pages now require `entities:read`; users without it get 404.
- **Stripe webhook idempotency:** Processed Stripe webhook event IDs are stored in `stripe_processed_events`; duplicate deliveries return 200 without re-processing.
- **Permissions-Policy header:** `next.config.ts` sets `Permissions-Policy` (camera, microphone, geolocation, interest-cohort disabled where not needed).

---

## [0.1.0] – initial scope

- Multi-tenant platform with entity + relationship + JSONB data model.
- Dashboard: modules, fields, entities, list/board/calendar views, soft delete, clone, export/import.
- Tenant API: REST CRUD, bulk PATCH, related entities, cursor pagination, rate limiting, idempotency keys, ETag for GET entity.
- Stripe: platform billing (tenant subscriptions) and Connect (tenant customer payments).
- Webhooks: tenant-configured outbound webhooks with retries and delivery logging.
- Auth: login, logout, account lockout, password reset, invite flow; session-based dashboard access.
- Activity/audit: tenant-wide events, sensitive-action audit, CSV export.
- Health: liveness (`/api/health`), readiness (`/api/ready`), version/buildId, maintenance mode.
- Security: CORS, request ID, security headers, RLS migration (optional), API key management.

[Unreleased]: https://github.com/your-org/tasc360-erjv/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/tasc360-erjv/releases/tag/v0.1.0
