-- CreateTable
CREATE TABLE "webhook_retries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event" VARCHAR(100) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "payload" JSONB NOT NULL,
    "attempt_count" INTEGER NOT NULL,
    "next_retry_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_retries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_webhook_retries_next_retry" ON "webhook_retries"("next_retry_at");

-- AddForeignKey
ALTER TABLE "webhook_retries" ADD CONSTRAINT "webhook_retries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
