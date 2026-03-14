/**
 * Sensitive-action audit logging. Logs to Event with consistent eventType and data.
 * Use for: login, password reset, invite, role change, refund, API key create/revoke.
 */

import { prisma } from "./prisma";

export type AuditEventType =
  | "auth_login"
  | "auth_password_reset_requested"
  | "auth_password_reset_completed"
  | "user_invited"
  | "user_updated"
  | "order_refunded"
  | "api_key_created"
  | "api_key_revoked"
  | "entity_created"
  | "entity_updated"
  | "entity_deleted"
  | "stripe_webhook_processed"
  | "journal_entry_created"
  | "fiscal_period_closed"
  | "developer_setup_enabled"
  | "developer_setup_disabled";

export async function logAuditEvent(
  tenantId: string,
  eventType: AuditEventType,
  data: Record<string, unknown>,
  createdBy?: string | null,
  entityId?: string | null
): Promise<void> {
  try {
    await prisma.event.create({
      data: {
        tenantId,
        entityId: entityId ?? null,
        eventType,
        data: data as object,
        createdBy: createdBy ?? null,
      },
    });
  } catch {
    // avoid breaking callers if audit write fails
  }
}

/** Log entity mutation from the API (create/update/delete). Uses Event table with source "api". */
export async function logApiEntityEvent(
  tenantId: string,
  eventType: "entity_created" | "entity_updated" | "entity_deleted",
  entityId: string,
  meta: { moduleSlug?: string; apiKeyPrefix?: string }
): Promise<void> {
  await logAuditEvent(
    tenantId,
    eventType,
    { source: "api", ...meta },
    null,
    entityId
  );
}
