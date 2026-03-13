-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event" VARCHAR(100) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "status_code" INTEGER,
    "error_message" VARCHAR(1024),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_webhook_deliveries_tenant_id" ON "webhook_deliveries"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_webhook_deliveries_tenant_created" ON "webhook_deliveries"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
