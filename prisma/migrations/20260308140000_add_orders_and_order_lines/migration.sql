-- CreateTable: orders (customer site checkout — who bought, total)
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "purchaser_name" VARCHAR(255) NOT NULL,
    "purchaser_email" VARCHAR(255) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'completed',
    "total_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: order_lines (quantity + amount per entity)
CREATE TABLE "order_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "line_type" VARCHAR(20) NOT NULL,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "idx_orders_tenant_id" ON "orders"("tenant_id");
CREATE INDEX "idx_orders_tenant_created" ON "orders"("tenant_id", "created_at" DESC);
CREATE INDEX "idx_order_lines_order_id" ON "order_lines"("order_id");
CREATE INDEX "idx_order_lines_entity_id" ON "order_lines"("entity_id");

-- ForeignKeys
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
