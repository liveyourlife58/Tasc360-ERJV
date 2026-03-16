-- CreateTable
CREATE TABLE "tenant_end_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "password_hash" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invite_token" VARCHAR(64),
    "invite_token_expires_at" TIMESTAMPTZ(6),
    "reset_token" VARCHAR(64),
    "reset_token_expires_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_end_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_end_users_tenant_email_unique" ON "tenant_end_users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_end_users_invite_token_unique" ON "tenant_end_users"("invite_token");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_end_users_reset_token_unique" ON "tenant_end_users"("reset_token");

-- CreateIndex
CREATE INDEX "idx_tenant_end_users_tenant_id" ON "tenant_end_users"("tenant_id");

-- AddForeignKey
ALTER TABLE "tenant_end_users" ADD CONSTRAINT "tenant_end_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
