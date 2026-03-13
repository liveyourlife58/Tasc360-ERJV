-- AlterTable: time_entries: add volunteer_entity_id (nonprofit volunteer hours), make user_id optional
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "volunteer_entity_id" UUID;
ALTER TABLE "time_entries" ALTER COLUMN "user_id" DROP NOT NULL;

-- Add FK for volunteer_entity_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'time_entries_volunteer_entity_id_fkey' AND table_name = 'time_entries'
  ) THEN
    ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_volunteer_entity_id_fkey"
      FOREIGN KEY ("volunteer_entity_id") REFERENCES "entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Index for volunteer lookups
CREATE INDEX IF NOT EXISTS "idx_time_entries_tenant_volunteer" ON "time_entries"("tenant_id", "volunteer_entity_id");
