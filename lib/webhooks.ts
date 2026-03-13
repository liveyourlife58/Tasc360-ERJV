/**
 * Tenant webhooks: fire on entity/order/payment events.
 * Configure webhookUrl (and optional webhookSecret) in tenant.settings.
 * Fire-and-forget; do not block the request on webhook delivery.
 * Recent deliveries are logged to webhook_deliveries (last 50 per tenant).
 */

import { prisma } from "@/lib/prisma";

export type WebhookPayload = {
  event: string;
  tenantId: string;
  timestamp: string;
  data: Record<string, unknown>;
  /** Stable id for this delivery; receivers can use it to dedupe. */
  deliveryId?: string;
};

export async function getWebhookConfig(tenantId: string): Promise<{ url: string; secret?: string } | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  const url = settings.webhookUrl as string | undefined;
  if (!url || typeof url !== "string" || !url.startsWith("https://")) return null;
  return {
    url,
    secret: (settings.webhookSecret as string) || undefined,
  };
}

const MAX_DELIVERIES_PER_TENANT = 50;

/** Create a delivery record (pending). Returns id for deliveryId in payload/header. */
async function createDelivery(tenantId: string, event: string, url: string): Promise<string | null> {
  try {
    const row = await prisma.webhookDelivery.create({
      data: {
        tenantId,
        event,
        url,
        success: false,
        statusCode: null,
        errorMessage: null,
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

/** Update delivery with result and prune old deliveries. */
async function updateDelivery(
  deliveryId: string,
  success: boolean,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  try {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        success,
        statusCode,
        errorMessage: errorMessage?.slice(0, 1024) ?? null,
      },
    });
    const row = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      select: { tenantId: true },
    });
    if (row) {
      const toDelete = await prisma.webhookDelivery.findMany({
        where: { tenantId: row.tenantId },
        orderBy: { createdAt: "desc" },
        skip: MAX_DELIVERIES_PER_TENANT,
        select: { id: true },
      });
      if (toDelete.length > 0) {
        await prisma.webhookDelivery.deleteMany({
          where: { id: { in: toDelete.map((d) => d.id) } },
        });
      }
    }
  } catch {
    // ignore
  }
}

async function logDelivery(
  tenantId: string,
  event: string,
  url: string,
  success: boolean,
  statusCode: number | null,
  errorMessage: string | null
): Promise<void> {
  try {
    await prisma.webhookDelivery.create({
      data: {
        tenantId,
        event,
        url,
        success,
        statusCode,
        errorMessage: errorMessage?.slice(0, 1024) ?? null,
      },
    });
    const toDelete = await prisma.webhookDelivery.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      skip: MAX_DELIVERIES_PER_TENANT,
      select: { id: true },
    });
    if (toDelete.length > 0) {
      await prisma.webhookDelivery.deleteMany({
        where: { id: { in: toDelete.map((d) => d.id) } },
      });
    }
  } catch {
    // ignore log failures
  }
}

const RETRY_BACKOFF_MINUTES = [1, 5, 30, 60];
const MAX_RETRY_ATTEMPTS = 5;

function nextRetryAt(attemptCount: number): Date {
  const idx = Math.min(attemptCount - 1, RETRY_BACKOFF_MINUTES.length - 1);
  const minutes = RETRY_BACKOFF_MINUTES[Math.max(0, idx)];
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

async function enqueueWebhookRetry(
  tenantId: string,
  event: string,
  url: string,
  payload: WebhookPayload
): Promise<void> {
  try {
    await prisma.webhookRetry.create({
      data: {
        tenantId,
        event,
        url,
        payload: payload as object,
        attemptCount: 1,
        nextRetryAt: nextRetryAt(1),
      },
    });
  } catch {
    // ignore
  }
}

/** Fire webhook in background; never throws. Logs delivery to webhook_deliveries; includes deliveryId in payload and X-Webhook-Delivery-Id header. On failure, enqueues a retry. */
export function fireWebhook(tenantId: string, event: string, data: Record<string, unknown>): void {
  getWebhookConfig(tenantId).then((config) => {
    if (!config) return;
    createDelivery(tenantId, event, config.url).then((deliveryId) => {
      const payload: WebhookPayload = {
        event,
        tenantId,
        timestamp: new Date().toISOString(),
        data,
        ...(deliveryId ? { deliveryId } : {}),
      };
      const body = JSON.stringify(payload);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        ...(deliveryId ? { "X-Webhook-Delivery-Id": deliveryId } : {}),
      };
      if (config.secret) {
        const crypto = require("crypto");
        const sig = crypto.createHmac("sha256", config.secret).update(body).digest("hex");
        headers["X-Webhook-Signature"] = `sha256=${sig}`;
        headers["X-Webhook-Signature-Algorithm"] = "sha256";
      }
      fetch(config.url, { method: "POST", headers, body })
        .then(async (res) => {
          const ok = res.ok;
          if (deliveryId) {
            await updateDelivery(deliveryId, ok, res.status, ok ? null : `HTTP ${res.status}`);
          } else {
            await logDelivery(tenantId, event, config.url, ok, res.status, ok ? null : `HTTP ${res.status}`);
          }
          if (!ok) {
            enqueueWebhookRetry(tenantId, event, config.url, payload).catch(() => {});
            const { sendWebhookFailedEmail } = await import("@/lib/email");
            sendWebhookFailedEmail(tenantId, { event, url: config.url, errorMessage: `HTTP ${res.status}` }).catch(() => {});
          }
        })
        .catch(async (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (deliveryId) {
            await updateDelivery(deliveryId, false, null, msg);
          } else {
            await logDelivery(tenantId, event, config.url, false, null, msg);
          }
          enqueueWebhookRetry(tenantId, event, config.url, payload).catch(() => {});
          const { sendWebhookFailedEmail } = await import("@/lib/email");
          sendWebhookFailedEmail(tenantId, { event, url: config.url, errorMessage: msg }).catch(() => {});
        });
    });
  });
}

/** Process due webhook retries (call from cron). Returns count processed. */
export async function processWebhookRetries(limit = 50): Promise<number> {
  const crypto = require("crypto");
  const now = new Date();
  const due = await prisma.webhookRetry.findMany({
    where: { nextRetryAt: { lte: now } },
    orderBy: { nextRetryAt: "asc" },
    take: limit,
  });
  let processed = 0;
  for (const row of due) {
    const config = await getWebhookConfig(row.tenantId);
    if (!config || config.url !== row.url) {
      await prisma.webhookRetry.delete({ where: { id: row.id } });
      processed++;
      continue;
    }
    const payload = row.payload as WebhookPayload;
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Webhook-Event": row.event,
    };
    if (config.secret) {
      const sig = crypto.createHmac("sha256", config.secret).update(body).digest("hex");
      headers["X-Webhook-Signature"] = `sha256=${sig}`;
      headers["X-Webhook-Signature-Algorithm"] = "sha256";
    }
    try {
      const res = await fetch(row.url, { method: "POST", headers, body });
      await logDelivery(row.tenantId, row.event, row.url, res.ok, res.status, res.ok ? null : `HTTP ${res.status}`);
      if (res.ok) {
        await prisma.webhookRetry.delete({ where: { id: row.id } });
        processed++;
        continue;
      }
    } catch {
      // network error
    }
    const nextAttempt = row.attemptCount + 1;
    if (nextAttempt >= MAX_RETRY_ATTEMPTS) {
      await prisma.webhookRetry.delete({ where: { id: row.id } });
      const { sendWebhookFailedEmail } = await import("@/lib/email");
      sendWebhookFailedEmail(row.tenantId, {
        event: row.event,
        url: row.url,
        errorMessage: `Delivery failed after ${MAX_RETRY_ATTEMPTS} attempts.`,
      }).catch(() => {});
      processed++;
      continue;
    }
    await prisma.webhookRetry.update({
      where: { id: row.id },
      data: { attemptCount: nextAttempt, nextRetryAt: nextRetryAt(nextAttempt) },
    });
    processed++;
  }
  return processed;
}

/** Fire a test webhook and return the result (for "Send test event" UI). Includes deliveryId in payload and header. */
export async function fireWebhookTest(tenantId: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const config = await getWebhookConfig(tenantId);
  if (!config) return { success: false, error: "No webhook URL configured." };
  const deliveryId = await createDelivery(tenantId, "test", config.url);
  const payload: WebhookPayload = {
    event: "test",
    tenantId,
    timestamp: new Date().toISOString(),
    data: { message: "This is a test event from Tasc360." },
    ...(deliveryId ? { deliveryId } : {}),
  };
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": "test",
    ...(deliveryId ? { "X-Webhook-Delivery-Id": deliveryId } : {}),
  };
  if (config.secret) {
    const crypto = require("crypto");
    const sig = crypto.createHmac("sha256", config.secret).update(body).digest("hex");
    headers["X-Webhook-Signature"] = `sha256=${sig}`;
    headers["X-Webhook-Signature-Algorithm"] = "sha256";
  }
  try {
    const res = await fetch(config.url, { method: "POST", headers, body });
    if (deliveryId) {
      await updateDelivery(deliveryId, res.ok, res.status, res.ok ? null : `HTTP ${res.status}`);
    } else {
      await logDelivery(tenantId, "test", config.url, res.ok, res.status, res.ok ? null : `HTTP ${res.status}`);
    }
    return { success: res.ok, statusCode: res.status, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (deliveryId) await updateDelivery(deliveryId, false, null, msg);
    else await logDelivery(tenantId, "test", config.url, false, null, msg);
    return { success: false, error: msg };
  }
}
