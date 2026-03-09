import { cookies } from "next/headers";

const SESSION_COOKIE = "tasc_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Session = {
  userId: string;
  tenantId: string;
  email: string;
  name?: string | null;
};

function encode(session: Session): string {
  return Buffer.from(JSON.stringify(session), "utf-8").toString("base64url");
}

function decode(payload: string): Session | null {
  try {
    const json = Buffer.from(payload, "base64url").toString("utf-8");
    const s = JSON.parse(json) as Session;
    if (s?.userId && s?.tenantId && s?.email) return s;
  } catch {
    // ignore
  }
  return null;
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  return decode(value);
}

export async function setSession(session: Session): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encode(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/** For middleware: read session from cookie string (no async cookies in edge). */
export function getSessionFromCookie(cookieHeader: string | null): Session | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  return decode(decodeURIComponent(match[1]));
}
