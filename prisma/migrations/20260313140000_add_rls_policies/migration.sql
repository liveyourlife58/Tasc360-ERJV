-- Row-Level Security (RLS) for tenant isolation (defense-in-depth).
-- Policies restrict rows to current_setting('app.tenant_id')::uuid.
-- The app's DB user (table owner) bypasses RLS by default, so behavior is unchanged until
-- you use a role that does not bypass RLS and set app.tenant_id at connection/request time.
-- See docs/SECURITY.md for enabling enforcement.

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "roles"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "consents"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "modules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "modules"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "fields" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fields"
  USING ("module_id" IN (SELECT id FROM "modules" WHERE "tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid));

ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "entities"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "relationships" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "relationships"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "events"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "files"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "journal_entries"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "time_entries"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "payments"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "orders"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "approvals"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "entity_tags" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "entity_tags"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "recurring_schedules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "recurring_schedules"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "views" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "views"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "exchange_rates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "exchange_rates"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "fiscal_periods" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fiscal_periods"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "webhook_deliveries"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "embeddings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "embeddings"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE "idempotency_keys" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "idempotency_keys"
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
