-- Add externalId to journal_entries for integration sync (e.g. QuickBooks JournalEntry id).
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "external_id" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "idx_journal_entries_tenant_external" ON "journal_entries"("tenant_id", "external_id");
