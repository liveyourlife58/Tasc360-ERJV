-- AlterTable: track how many tickets have checked in per order line
ALTER TABLE "order_lines" ADD COLUMN IF NOT EXISTS "checked_in_quantity" INTEGER NOT NULL DEFAULT 0;
