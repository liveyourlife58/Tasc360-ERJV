# Tenant customer login — design

This doc describes how the current design can accommodate **tenants who want their own customers to log into the tenant’s custom frontend** (e.g. a site built from the Tasc360-Frontend template or a white-label app).

## Current state

- **Dashboard users (`User`)** — Tenant staff (admins, members) log into the **Tasc360-ERJV app** (dashboard) via `/login`. They have email/password, roles, and permissions. Session is cookie-based; middleware sets `x-tenant-id` and `x-user-id` for dashboard routes. This is **not** exposed to custom frontends.
- **Tenant API** — Custom frontends call `/api/v1/tenants/:tenantId/...` with **`X-API-Key`** only. The API authenticates the *tenant* (and optionally the key), but there is **no concept of an end user** (the tenant’s customer). So today, every request from that frontend is “tenant acting as a whole”; there is no “logged-in customer” identity.

So: **tenant customer logins are not supported today.** To support them, we need a way for the API to know *which end user* is making the request, and optionally to scope data or permissions by that user.

---

## Goal

- A **tenant** (e.g. Acme Corp) has a custom frontend (their site/app).
- The tenant wants **their customers** (e.g. Acme’s clients) to have accounts and log in.
- After login, the frontend calls the tenant API on behalf of that **customer**, so the backend can:
  - Know who the user is (e.g. for “My orders”, “My profile”).
  - Optionally scope reads/writes by user (e.g. only their records, or role-based access).

---

## Option A: Built-in tenant end-user auth (recommended baseline)

Add a **tenant-scoped end-user** identity and auth **inside** Tasc360-ERJV, used only for the tenant API (not the dashboard).

### Backend changes

1. **New model: tenant end users**  
   e.g. `TenantEndUser` (or `CustomerLogin`): `tenantId`, `email`, `passwordHash`, `name`, `isActive`, `externalId` (optional, for IdP linking). Same tenant can have many end users. No role/permission model required in v1; add later if needed.

2. **Auth endpoints under tenant API** (all under `/api/v1/tenants/:tenantId/...`):
   - `POST .../auth/login` — body: `{ email, password }`. Validate API key **and** credentials; return a **JWT** (or opaque token) that encodes `tenantId` + `endUserId` (and optionally expiry).
   - `POST .../auth/register` — optional; body: `{ email, password, name }`. Only if tenant allows self-signup (e.g. tenant setting). Create `TenantEndUser`, return JWT.
   - `GET .../auth/me` — `Authorization: Bearer <token>`. Return `{ id, email, name }` for the current end user (validates token, no API key required for this call if token is enough).
   - Optional: refresh token, forgot-password, etc., later.

3. **Tenant API auth: two modes**
   - **API key only** (current): `X-API-Key` → tenant only. No user context. Use for server-to-server, admin tools, or “anonymous” frontend access.
   - **API key + Bearer token**: If the request has `Authorization: Bearer <jwt>`, verify the JWT (tenantId + endUserId), then **optionally** scope queries (e.g. filter entities by `ownedByEndUserId` if you add that field, or enforce per-user permissions in a later phase). If only API key is sent, behavior stays as today (no user).

4. **Data scoping (optional, can be phase 2)**  
   If you want “customers only see their own data”, add e.g. `ownedByEndUserId` on `Entity` (or a generic `endUserId` on a link table), and in list/get endpoints when a Bearer token is present, filter by that user. Without Bearer, keep current behavior.

### Frontend template changes (Tasc360-Frontend)

- **Login page** — Form that POSTs to `.../auth/login` with tenant in path; store returned JWT (e.g. in memory + optional httpOnly cookie or secure storage).
- **API client** — Send `Authorization: Bearer <token>` on every request when the user is logged in (in addition to or instead of API key, depending on backend design). If backend accepts “Bearer only” for tenant+user, you can use that; otherwise send both.
- **Auth guard** — For routes that require login, check for a valid token (and optionally call `.../auth/me`); redirect to login if missing.
- **Logout** — Clear token and redirect to login or home.

No change to dashboard or existing `User` model; this is a separate, tenant-API-only identity.

---

## Option B: External IdP (Auth0, Cognito, Firebase, etc.)

The tenant uses an **external identity provider** for their customers. The frontend logs users in with that IdP and gets a JWT from the IdP.

### Backend changes

1. **Tenant end-user identity (minimal)**  
   You still need a **tenant-scoped identity** in the backend so the API can scope data: e.g. `TenantEndUser` with `tenantId` + `externalId` (IdP’s `sub`). No password; identity is “this IdP sub, for this tenant”.

2. **Trust the IdP’s JWT**  
   - Tenant config: e.g. “Auth0 domain”, “Cognito region + user pool”, or a JWKS URL. Stored in tenant `settings` or a small `TenantAuthProvider` table.
   - New middleware or auth helper for tenant API: if `Authorization: Bearer <idp-jwt>`, verify the JWT with the tenant’s IdP config (e.g. JWKS), read `sub`, find or create `TenantEndUser` for that tenant + `sub`, then attach `endUserId` to the request. API key might still be required for tenant context, or the JWT’s audience/issuer could imply tenant (if you encode it).

3. **Same data scoping as Option A** — Once the request has an `endUserId`, list/get (and optionally write) can filter by that user.

### Frontend template changes

- **Login** — Redirect to IdP or use IdP SDK; on success, store IdP JWT.
- **API client** — Send `Authorization: Bearer <idp-jwt>`; backend validates and maps to tenant end user.
- **Auth guard** — Same idea: require valid token and optionally `.../auth/me` (backend could implement `GET .../auth/me` by reading the IdP JWT and returning the mapped end user).

This path is good when the tenant already has an IdP or wants SSO/social login. The backend still needs a place to store “tenant + external user” and optional metadata.

---

## Recommendation

- **Short term:** Implement **Option A** (built-in tenant end-user auth): one new model, a few auth routes, JWT issue/verify, and “Bearer optional” in the tenant API. No dependency on external IdP; every tenant can offer customer logins immediately. Document in TENANT_API.md.
- **Later:** Add **Option B** (e.g. “Login with Auth0”) by allowing tenant-level IdP config and accepting IdP JWTs; map `sub` to the same `TenantEndUser` (e.g. by setting `externalId = sub`). Then the frontend can choose “email/password” or “Login with Auth0” depending on tenant config.

---

## How tenants set up customer logins

Tenants configure and manage **customer** (end-user) logins from the **dashboard**, separate from their own **team** (dashboard users). Below is a concrete setup flow that fits the current product.

### Where: Dashboard → Settings

- Add a new settings section, e.g. **“Customer logins”** (or “End-user accounts”), in **Dashboard → Settings**, alongside “API access”, “Branding”, etc.
- Only tenants who use a custom frontend (or the built-in customer site) need it; it can be gated by a feature flag or simply shown to all.

### What tenants configure

1. **Enable customer logins**  
   Toggle: “Allow customers to log in to your site/app.” When off, the tenant API behaves as today (API key only; no `.../auth/login` or `.../auth/register`). When on, auth endpoints are active and the frontend can show login/register.

2. **How accounts are created**
   - **Self-signup** — “Allow anyone to create an account” (e.g. Register link on the frontend). If on, `POST .../auth/register` is allowed; if off, only existing end users can log in (see below).
   - **Invite-only (default)** — Tenant staff create end-user accounts from the dashboard; no public register. Recommended default so tenants control who has access.

3. **Optional (later)**  
   Password policy (length, expiry), “Login with Google/Auth0” (Option B), custom redirect after login, etc. Can live in the same section or under “Advanced.”

Settings can be stored in tenant `settings` JSON (e.g. `customerLogin: { enabled: true, allowSelfSignup: false }`) or in a small table if you prefer.

### How end users get accounts

| Method | Who does it | Flow |
|--------|-------------|------|
| **Self-signup** | Customer | Tenant enables “Allow self-signup.” Customer opens the frontend → Register → email + password → `POST .../auth/register` → account created and JWT returned (or redirect to login). |
| **Invite** | Tenant staff | In dashboard, e.g. **Settings → Customer logins → Invite user** (or a dedicated “Customer accounts” page). Staff enters email (and optional name). Backend creates `TenantEndUser` with a temporary or null password and sends an **invite email** with a “Set password” link (or magic link). User sets password and can then use `POST .../auth/login`. |
| **Bulk import (optional)** | Tenant staff | CSV upload: email, name. Backend creates accounts and sends invite emails. Phase 2. |

So: tenants **turn on** customer logins in Settings, choose **self-signup vs invite-only**, and (for invite-only) **invite** users from the dashboard; those users set a password and log in on the frontend.

### Managing end users

- **List** — In dashboard: e.g. **Settings → Customer logins** or **Team / Customer accounts**: table of end users (email, name, created, last login, status). Reuse the same “list + actions” pattern as dashboard **Subscription → Team** (which lists `User`).
- **Actions** — Deactivate (soft-disable login), “Send reset password email,” optionally delete. No need for full “roles” in v1; add later if tenants need different customer permissions.
- **Audit** — Log “customer_invited”, “customer_deactivated”, “customer_password_reset” in the same audit stream as dashboard events (tenant-scoped).

### Summary: tenant flow

1. Tenant goes to **Dashboard → Settings → Customer logins**.
2. Turns **on** “Allow customer logins.”
3. Chooses **Allow self-signup** or **Invite only**.
4. If invite-only: uses **Invite user** (and optionally bulk import later) to create accounts; invites receive email and set password.
5. Customers open the tenant’s custom frontend and log in (and register, if self-signup is on).
6. Tenant can view and manage (deactivate, reset password) those accounts in the same Settings section or a dedicated list page.

This keeps setup in one place (dashboard), reuses existing patterns (invite email, list/actions), and leaves the tenant API and frontend template unchanged in spirit: they just gain auth endpoints and a Bearer token when customers log in.

---

## Summary

| Aspect | Today | With Option A |
|--------|--------|----------------|
| Who logs in to dashboard | Tenant staff (`User`) | Unchanged |
| Who “logs in” to custom frontend | No one (API key only) | Tenant’s customers (`TenantEndUser`) |
| Tenant API auth | `X-API-Key` only | `X-API-Key` and/or `Authorization: Bearer <jwt>` |
| Data scoping by user | N/A | Optional (e.g. filter by `endUserId`) |

The **design accommodates** tenant customer logins by introducing a **tenant-scoped end-user** identity and auth (built-in and/or external IdP) used only for the tenant API, leaving dashboard users and existing API-key usage unchanged.
