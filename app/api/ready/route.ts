/**
 * Readiness probe: DB, optional Resend/Stripe, webhook retries.
 * Use for routing traffic (e.g. load balancer). Returns 503 if any check fails.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Check = { name: string; status: "ok" | "error"; message?: string };

function getAppVersion(): string | null {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const path = require("path");
    const fs = require("fs");
    const pkgPath = path.join(process.cwd(), "package.json");
    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const checks: Check[] = [];
  let webhookRetriesPending = 0;
  const version = getAppVersion();
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_REF ?? null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: "database", status: "ok" });
  } catch (e) {
    checks.push({
      name: "database",
      status: "error",
      message: e instanceof Error ? e.message : "Connection failed",
    });
  }

  try {
    webhookRetriesPending = await prisma.webhookRetry.count();
  } catch {
    // ignore
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      });
      checks.push({ name: "resend", status: res.ok ? "ok" : "error", message: res.ok ? undefined : `HTTP ${res.status}` });
    } catch (e) {
      checks.push({ name: "resend", status: "error", message: e instanceof Error ? e.message : "Request failed" });
    }
  } else {
    checks.push({ name: "resend", status: "ok", message: "skipped (no key)" });
  }

  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = (await import("stripe")).default;
      const s = new stripe(process.env.STRIPE_SECRET_KEY!);
      await s.balance.retrieve();
      checks.push({ name: "stripe", status: "ok" });
    } catch (e) {
      checks.push({ name: "stripe", status: "error", message: e instanceof Error ? e.message : "Request failed" });
    }
  } else {
    checks.push({ name: "stripe", status: "ok", message: "skipped (no key)" });
  }

  const allOk = checks.every((c) => c.status === "ok");
  return NextResponse.json(
    {
      status: allOk ? "ready" : "not_ready",
      ...(version && { version }),
      ...(buildId && { buildId }),
      checks,
      webhookRetriesPending,
    },
    { status: allOk ? 200 : 503 }
  );
}
