-- CreateTable
CREATE TABLE "stripe_processed_events" (
    "stripe_event_id" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_processed_events_pkey" PRIMARY KEY ("stripe_event_id")
);
