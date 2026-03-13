# Tasc360-ERJV — Security

This document describes how the database design supports security and what the application must do.

## What the schema provides

- **No plaintext passwords** — `users.password_hash` only; application hashes with bcrypt or argon2.
- **Tenant isolation** — Every tenant-scoped table has `tenant_id` with FK to `tenants`; composite indexes start with `tenant_id`.
- **Account lockout** — `users.failed_login_attempts`, `account_locked`, `locked_until` for rate limiting / lockout (enforced in app).
- **Audit trail** — `events` table and `created_by` on entities/events so you can attribute and review actions.
- **UUID primary keys** — Reduces ID enumeration; no predictable sequences.
- **Cascade delete** — Deleting a tenant removes all related rows (supports data erasure).

## Application responsibilities

### 1. Tenant scope

- **Never** use `tenant_id` from request body, query params, or URL.
- Resolve tenant from the **authenticated session** (e.g. JWT or session table) and pass it to every query.
- If you use raw SQL, always include `tenant_id = $currentTenantId` in WHERE.

### 2. Authentication

- Hash passwords with **bcrypt** (cost ≥ 10) or **argon2** before writing to `password_hash`.
- On failed login: increment `failed_login_attempts`; optionally set `account_locked` and `locked_until` after a threshold.
- On success: set `failed_login_attempts = 0`, clear lock, update `last_login_at`.
- Reject login when `account_locked` is true and `locked_until` is in the future (or clear lock when time has passed).

### 3. Authorization

- Use `users.role_id` and `roles.permissions` (or your policy engine) to enforce access.
- Check permission before any create/update/delete (e.g. `entities:write`, `modules:manage`).

### 4. Queries

- **Prisma:** Always scope by `tenantId` (from session) in `where`.
- **Raw SQL:** Use parameterized queries only; never concatenate user input. Set `app.current_tenant_id` if using RLS (see below).

### 5. Secrets

- Keep `DATABASE_URL` and other secrets in `.env`; do **not** commit `.env`.
- Rotate DB credentials periodically; use a dedicated DB user with least privilege (e.g. no SUPERUSER, only needed tables).

### 6. Sensitive data in `entities.data`

- PII or regulated data (e.g. SSN, payment details) inside JSONB is **not** encrypted at rest by the schema.
- Option A: Encrypt sensitive fields in the application before writing to `data` (and decrypt after read).
- Option B: Store only non-sensitive identifiers in `data` and keep sensitive values in a separate, access-controlled store.

## Row-level security (RLS)

PostgreSQL RLS adds **defense-in-depth**: even if the app forgets a tenant filter, the database restricts rows by tenant.

### How it works

1. Enable RLS on each tenant-scoped table.
2. Add a policy that allows access only when `tenant_id = current_setting('app.current_tenant_id', true)::uuid`.
3. In the application, at the start of each request (e.g. middleware), run:  
   `SELECT set_config('app.current_tenant_id', $tenantIdFromSession, true);`  
   so that all subsequent queries in that connection see only that tenant’s rows.

### Optional migration

Use the optional migration in `prisma/migrations/..._add_rls_optional` to enable RLS and attach policies. Prisma does not set session variables by default, so you must call `set_config` (or equivalent) in your app before running Prisma or raw SQL in the same request/connection.

### Tables to protect

- `users`, `roles`, `modules`, `fields`, `entities`, `relationships`, `events`, `files`, `embeddings`  
Do **not** enable RLS on `tenants` if the app needs to resolve tenant by slug/id for login; keep tenant resolution outside RLS or use a separate, highly restricted path.

## Encryption and infrastructure

- **Encryption at rest** — Use your host’s option (e.g. PostgreSQL or disk encryption); the schema does not define it.
- **TLS** — Use `sslmode=require` (or stricter) in `DATABASE_URL` for production.
- **Backups** — Restrict backup access; consider encrypted backups if they contain PII.

## Summary

| Layer        | Schema / DB | App |
|-------------|-------------|-----|
| Tenant isolation | `tenant_id`, indexes, optional RLS | Always scope by session tenant; set RLS variable if used |
| Passwords        | `password_hash` only               | Hash with bcrypt/argon2; never log hash |
| Lockout          | `failed_login_attempts`, `account_locked`, `locked_until` | Update on login success/failure; enforce lock |
| Audit            | `events`, `created_by`             | Log important actions; use for forensics |
| Secrets          | —                                  | .env, rotate credentials, least privilege |
| Sensitive JSONB  | —                                  | Encrypt in app or store elsewhere |
