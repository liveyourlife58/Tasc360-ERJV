import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/app/forgot-password/actions";

/**
 * POST /api/auth/forgot-password — used by forgot-password form so client can handle 429 (rate limit) and still get JSON.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const state = await requestPasswordReset(null, formData);
  return NextResponse.json(state);
}
