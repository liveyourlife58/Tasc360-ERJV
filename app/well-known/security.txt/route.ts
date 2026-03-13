/**
 * Security policy (RFC 9116). Update Contact and Expires for your deployment.
 * See https://securitytxt.org/
 */

import { NextResponse } from "next/server";

const SECURITY_TXT = `Contact: mailto:security@example.com
Expires: 2026-12-31T23:59:59.000Z
Preferred-Languages: en
`;

export function GET() {
  return new NextResponse(SECURITY_TXT, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
