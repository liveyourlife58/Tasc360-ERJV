import { NextResponse } from "next/server";
import { login } from "@/app/login/actions";

/**
 * POST /api/auth/login — used by login form so client can handle 429 (rate limit) and still get JSON/redirect.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  try {
    const state = await login(null, formData);
    return NextResponse.json(state);
  } catch (e: unknown) {
    const err = e as { digest?: string; url?: string };
    if (err?.digest?.includes("REDIRECT") && typeof err?.url === "string") {
      return NextResponse.redirect(err.url);
    }
    throw e;
  }
}
