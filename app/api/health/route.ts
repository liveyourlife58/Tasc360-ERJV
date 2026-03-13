import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Liveness probe: no DB or external calls. Returns 200 so orchestrators don't kill the process.
 * For dependency checks (DB, Resend, Stripe), use GET /api/ready.
 */

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
  const version = getAppVersion();
  const buildId = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_REF ?? null;
  return NextResponse.json(
    {
      status: "ok",
      ...(version && { version }),
      ...(buildId && { buildId }),
    },
    { status: 200 }
  );
}
