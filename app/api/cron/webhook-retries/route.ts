import { NextResponse } from "next/server";
import { processWebhookRetries } from "@/lib/webhooks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Process due webhook retries. Call from Vercel Cron or external scheduler.
 * Secured with Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const processed = await processWebhookRetries(50);
  return NextResponse.json({ ok: true, processed });
}
