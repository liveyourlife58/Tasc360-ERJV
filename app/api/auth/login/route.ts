import { NextResponse } from "next/server";
import { login } from "@/app/login/actions";
import { setSessionOnResponse } from "@/lib/auth";

/**
 * POST /api/auth/login — used by login form so client can handle 429 (rate limit) and still get JSON/redirect.
 * On success we return 200 with { redirect } and Set-Cookie so the client can navigate (fetch with redirect: "manual" may not expose Location on 3xx).
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const state = await login(null, formData);
  if (state.redirect && state.session) {
    const res = NextResponse.json({ redirect: state.redirect }, { status: 200 });
    setSessionOnResponse(res, state.session);
    return res;
  }
  return NextResponse.json(state);
}
