import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyForTenant } from "@/lib/api-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; moduleSlug: string; entityId: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const { tenantId, moduleSlug, entityId } = await params;
  const ok = await verifyApiKeyForTenant(apiKey, tenantId);
  if (!ok) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid X-API-Key for this tenant." },
      { status: 401 }
    );
  }
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    select: { id: true },
  });
  if (!module_) {
    return NextResponse.json({ error: "Module not found." }, { status: 404 });
  }
  const entity = await prisma.entity.findFirst({
    where: {
      id: entityId,
      tenantId,
      moduleId: module_.id,
      deletedAt: null,
    },
    select: { id: true, data: true, createdAt: true, updatedAt: true },
  });
  if (!entity) {
    return NextResponse.json({ error: "Entity not found." }, { status: 404 });
  }
  return NextResponse.json(entity);
}
