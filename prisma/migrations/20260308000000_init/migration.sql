-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "plan" VARCHAR(50),
    "settings" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "parent_tenant_id" UUID,
    "stripe_customer_id" VARCHAR(255),
    "stripe_subscription_id" VARCHAR(255),
    "subscription_status" VARCHAR(50),
    "subscription_current_period_end" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "permissions" JSONB DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "password_hash" VARCHAR(255),
    "role_id" UUID,
    "settings" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "account_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable (GDPR / marketing consent — who consented to what, when)
CREATE TABLE "consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "consent_type" VARCHAR(50) NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL,
    "source" VARCHAR(255),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "settings" JSONB DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fields" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "field_type" VARCHAR(50) NOT NULL,
    "settings" JSONB DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "module_id" UUID,
    "data" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "search_text" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "relation_type" VARCHAR(100) NOT NULL,
    "data" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "data" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "file_url" VARCHAR(1024) NOT NULL,
    "name" VARCHAR(512),
    "mime_type" VARCHAR(128),
    "size_bytes" INTEGER,
    "metadata" JSONB,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "relationship_id" UUID,
    "content" TEXT NOT NULL,
    "source_field" VARCHAR(100),
    "chunk_index" INTEGER,
    "chunk_count" INTEGER,
    "model_name" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable (tenant-facing payments: tenants charge their customers; link to invoice/order entity)
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "external_id" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable (general ledger: double-entry; accounts are entities)
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "ledger_entity_id" UUID,
    "entry_date" DATE NOT NULL,
    "reference" VARCHAR(255),
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "journal_entry_id" UUID NOT NULL,
    "account_entity_id" UUID NOT NULL,
    "debit_cents" INTEGER NOT NULL DEFAULT 0,
    "credit_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL,
    "description" VARCHAR(512),
    "source_entity_id" UUID,

    CONSTRAINT "ledger_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable (employee hours per job / work order)
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_entity_id" UUID NOT NULL,
    "work_order_entity_id" UUID,
    "hours" DECIMAL(10, 2) NOT NULL,
    "work_date" DATE NOT NULL,
    "description" VARCHAR(512),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable (approvals: quote, PO, time-off, expense, etc.)
CREATE TABLE "approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "approval_type" VARCHAR(100) NOT NULL,
    "requested_by" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "decided_by" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "comment" VARCHAR(1024),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable (tags on any entity for filtering)
CREATE TABLE "entity_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "tag" VARCHAR(100) NOT NULL,

    CONSTRAINT "entity_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable (recurring invoices, subscriptions, etc.)
CREATE TABLE "recurring_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "frequency" VARCHAR(50) NOT NULL,
    "next_run_at" TIMESTAMPTZ(6) NOT NULL,
    "last_run_at" TIMESTAMPTZ(6),
    "settings" JSONB DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable (one payment applied to multiple invoices)
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable (saved list/board/calendar views — filter/sort/columns as JSON)
CREATE TABLE "views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "module_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "view_type" VARCHAR(50) NOT NULL,
    "filter" JSONB DEFAULT '{}',
    "sort" JSONB DEFAULT '[]',
    "columns" JSONB DEFAULT '[]',
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "views_pkey" PRIMARY KEY ("id")
);

-- CreateTable (multi-currency exchange rates)
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "from_currency" VARCHAR(3) NOT NULL,
    "to_currency" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(18, 8) NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable (fiscal period close for accounting)
CREATE TABLE "fiscal_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "idx_tenants_slug" ON "tenants"("slug");
CREATE INDEX "idx_tenants_parent" ON "tenants"("parent_tenant_id");

-- CreateIndex
CREATE INDEX "idx_tenants_stripe_customer" ON "tenants"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "idx_tenants_subscription_status" ON "tenants"("subscription_status");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_email_unique" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "idx_users_tenant_id" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_users_tenant_email" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "consent_tenant_user_type_unique" ON "consents"("tenant_id", "user_id", "consent_type");
CREATE INDEX "idx_consent_tenant_id" ON "consents"("tenant_id");
CREATE INDEX "idx_consent_tenant_type" ON "consents"("tenant_id", "consent_type");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_name_unique" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "idx_roles_tenant_id" ON "roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "modules_tenant_slug_unique" ON "modules"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "idx_modules_tenant_id" ON "modules"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "fields_module_slug_unique" ON "fields"("module_id", "slug");

-- CreateIndex
CREATE INDEX "idx_fields_module_id" ON "fields"("module_id");

-- CreateIndex
CREATE INDEX "idx_entities_tenant_id" ON "entities"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_entities_tenant_module" ON "entities"("tenant_id", "module_id");

-- CreateIndex
CREATE INDEX "idx_entities_tenant_module_created" ON "entities"("tenant_id", "module_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_entities_tenant_module_deleted" ON "entities"("tenant_id", "module_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "relationships_source_target_type_unique" ON "relationships"("source_id", "target_id", "relation_type");

-- CreateIndex
CREATE INDEX "idx_relationships_tenant_id" ON "relationships"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_relationships_source_id" ON "relationships"("source_id");

-- CreateIndex
CREATE INDEX "idx_relationships_target_id" ON "relationships"("target_id");

-- CreateIndex
CREATE INDEX "idx_relationships_tenant_type" ON "relationships"("tenant_id", "relation_type");

-- CreateIndex
CREATE INDEX "idx_events_tenant_id" ON "events"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_events_tenant_entity" ON "events"("tenant_id", "entity_id");

-- CreateIndex
CREATE INDEX "idx_events_tenant_type" ON "events"("tenant_id", "event_type");

-- CreateIndex
CREATE INDEX "idx_events_tenant_created" ON "events"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_files_tenant_id" ON "files"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_files_tenant_entity" ON "files"("tenant_id", "entity_id");

-- CreateIndex
CREATE INDEX "idx_embeddings_tenant_id" ON "embeddings"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_embeddings_tenant_entity" ON "embeddings"("tenant_id", "entity_id");

-- CreateIndex
CREATE INDEX "idx_embeddings_tenant_relationship" ON "embeddings"("tenant_id", "relationship_id");

-- CreateIndex
CREATE INDEX "idx_embeddings_tenant_model" ON "embeddings"("tenant_id", "model_name");

-- CreateIndex
CREATE INDEX "idx_payments_tenant_id" ON "payments"("tenant_id");
CREATE INDEX "idx_payments_tenant_entity" ON "payments"("tenant_id", "entity_id");
CREATE INDEX "idx_payments_tenant_external" ON "payments"("tenant_id", "external_id");
CREATE INDEX "idx_payments_tenant_status" ON "payments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "idx_journal_entries_tenant_id" ON "journal_entries"("tenant_id");
CREATE INDEX "idx_journal_entries_tenant_ledger" ON "journal_entries"("tenant_id", "ledger_entity_id");
CREATE INDEX "idx_journal_entries_tenant_date" ON "journal_entries"("tenant_id", "entry_date");
CREATE INDEX "idx_journal_entries_tenant_status" ON "journal_entries"("tenant_id", "status");
CREATE INDEX "idx_ledger_lines_journal_entry" ON "ledger_lines"("journal_entry_id");
CREATE INDEX "idx_ledger_lines_account" ON "ledger_lines"("account_entity_id");
CREATE INDEX "idx_ledger_lines_source" ON "ledger_lines"("source_entity_id");
CREATE INDEX "idx_time_entries_tenant_id" ON "time_entries"("tenant_id");
CREATE INDEX "idx_time_entries_tenant_user" ON "time_entries"("tenant_id", "user_id");
CREATE INDEX "idx_time_entries_tenant_job" ON "time_entries"("tenant_id", "job_entity_id");
CREATE INDEX "idx_time_entries_tenant_work_order" ON "time_entries"("tenant_id", "work_order_entity_id");
CREATE INDEX "idx_time_entries_tenant_date" ON "time_entries"("tenant_id", "work_date");
CREATE INDEX "idx_approvals_tenant_id" ON "approvals"("tenant_id");
CREATE INDEX "idx_approvals_tenant_status" ON "approvals"("tenant_id", "status");
CREATE INDEX "idx_approvals_tenant_entity" ON "approvals"("tenant_id", "entity_id");
CREATE INDEX "idx_approvals_requested_by" ON "approvals"("requested_by");
CREATE UNIQUE INDEX "entity_tags_tenant_entity_tag_unique" ON "entity_tags"("tenant_id", "entity_id", "tag");
CREATE INDEX "idx_entity_tags_tenant_id" ON "entity_tags"("tenant_id");
CREATE INDEX "idx_entity_tags_tenant_tag" ON "entity_tags"("tenant_id", "tag");
CREATE INDEX "idx_entity_tags_entity_id" ON "entity_tags"("entity_id");
CREATE INDEX "idx_recurring_schedules_tenant_id" ON "recurring_schedules"("tenant_id");
CREATE INDEX "idx_recurring_schedules_tenant_next_run" ON "recurring_schedules"("tenant_id", "next_run_at");
CREATE INDEX "idx_recurring_schedules_entity_id" ON "recurring_schedules"("entity_id");
CREATE INDEX "idx_payment_allocations_payment" ON "payment_allocations"("payment_id");
CREATE INDEX "idx_payment_allocations_entity" ON "payment_allocations"("entity_id");
CREATE INDEX "idx_views_tenant_id" ON "views"("tenant_id");
CREATE INDEX "idx_views_tenant_module" ON "views"("tenant_id", "module_id");
CREATE UNIQUE INDEX "exchange_rates_tenant_currencies_date_unique" ON "exchange_rates"("tenant_id", "from_currency", "to_currency", "effective_date");
CREATE INDEX "idx_exchange_rates_tenant_id" ON "exchange_rates"("tenant_id");
CREATE INDEX "idx_exchange_rates_tenant_currencies" ON "exchange_rates"("tenant_id", "from_currency", "to_currency");
CREATE UNIQUE INDEX "fiscal_periods_tenant_start_unique" ON "fiscal_periods"("tenant_id", "period_start");
CREATE INDEX "idx_fiscal_periods_tenant_id" ON "fiscal_periods"("tenant_id");
CREATE INDEX "idx_fiscal_periods_tenant_end" ON "fiscal_periods"("tenant_id", "period_end");

-- GIN on relationships.data for edge-attribute queries (e.g. data @> '{"role":"primary"}')
CREATE INDEX "idx_relationships_data" ON "relationships" USING GIN ("data");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_parent_tenant_id_fkey" FOREIGN KEY ("parent_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fields_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_relationship_id_fkey" FOREIGN KEY ("relationship_id") REFERENCES "relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_ledger_entity_id_fkey" FOREIGN KEY ("ledger_entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_account_entity_id_fkey" FOREIGN KEY ("account_entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ledger_lines" ADD CONSTRAINT "ledger_lines_source_entity_id_fkey" FOREIGN KEY ("source_entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_job_entity_id_fkey" FOREIGN KEY ("job_entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_work_order_entity_id_fkey" FOREIGN KEY ("work_order_entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approvals" ADD CONSTRAINT "approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entity_tags" ADD CONSTRAINT "entity_tags_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recurring_schedules" ADD CONSTRAINT "recurring_schedules_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "views" ADD CONSTRAINT "views_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "views" ADD CONSTRAINT "views_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GIN index for JSONB queries on entities.data (recommended for scalability)
CREATE INDEX "idx_entities_data" ON "entities" USING GIN ("data");
-- Optional: if you filter often by metadata (e.g. external_id), uncomment:
-- CREATE INDEX "idx_entities_metadata" ON "entities" USING GIN ("metadata");

-- Full-text search on entities.search_text for hybrid (keyword + vector) search
CREATE INDEX "idx_entities_search_text_fts" ON "entities" USING GIN (to_tsvector('english', COALESCE("search_text", '')));

-- =============================================================================
-- Optional: pgvector (uncomment when extension is installed)
-- =============================================================================
-- CREATE EXTENSION IF NOT EXISTS vector;
-- ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
-- CREATE INDEX IF NOT EXISTS "idx_embeddings_vector" ON "embeddings" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- Optional: Row-Level Security (uncomment to enforce tenant isolation in DB)
-- App must set: SELECT set_config('app.current_tenant_id', $tenantId, true);
-- =============================================================================
-- ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "modules" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "fields" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "entities" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "relationships" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "embeddings" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "time_entries" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "approvals" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "entity_tags" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "recurring_schedules" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "views" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "exchange_rates" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "fiscal_periods" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "tenant_isolation" ON "users" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "roles" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "modules" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "fields" FOR ALL USING ((SELECT tenant_id FROM "modules" WHERE id = module_id) = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "entities" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "relationships" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "events" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "files" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "embeddings" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "payments" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "journal_entries" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "time_entries" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "approvals" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "entity_tags" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "recurring_schedules" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "views" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "exchange_rates" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "fiscal_periods" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
-- CREATE POLICY "tenant_isolation" ON "consents" FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true)::uuid));
