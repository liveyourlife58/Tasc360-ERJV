-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_body" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_tenant_key_unique" ON "idempotency_keys"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "idx_idempotency_keys_tenant_key" ON "idempotency_keys"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "idx_idempotency_keys_created_at" ON "idempotency_keys"("created_at");

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
