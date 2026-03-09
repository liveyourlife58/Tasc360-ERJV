import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyForTenant } from "@/lib/api-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const { tenantId } = await params;
  const ok = await verifyApiKeyForTenant(apiKey, tenantId);
  if (!ok) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid X-API-Key for this tenant." },
      { status: 401 }
    );
  }
  const modules = await prisma.module.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, description: true },
  });
  return NextResponse.json({ modules });
}
