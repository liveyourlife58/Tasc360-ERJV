import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyApiKeyForTenant } from "@/lib/api-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; moduleSlug: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const { tenantId, moduleSlug } = await params;
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
  const entities = await prisma.entity.findMany({
    where: { tenantId, moduleId: module_.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, data: true, createdAt: true },
  });
  return NextResponse.json({ entities });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; moduleSlug: string }> }
) {
  const apiKey = request.headers.get("x-api-key");
  const { tenantId, moduleSlug } = await params;
  const ok = await verifyApiKeyForTenant(apiKey, tenantId);
  if (!ok) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid X-API-Key for this tenant." },
      { status: 401 }
    );
  }
  const module_ = await prisma.module.findFirst({
    where: { tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) {
    return NextResponse.json({ error: "Module not found." }, { status: 404 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Send an object with field slugs as keys." },
      { status: 400 }
    );
  }
  const fieldSlugs = new Set(module_.fields.map((f) => f.slug));
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (fieldSlugs.has(key)) data[key] = value;
  }
  const searchText = Object.values(data)
    .filter((v) => typeof v === "string" && v)
    .join(" ");
  const entity = await prisma.entity.create({
    data: {
      tenantId,
      moduleId: module_.id,
      data: data as object,
      searchText: searchText.slice(0, 10000) || null,
    },
  });
  return NextResponse.json(
    { id: entity.id, data: entity.data, createdAt: entity.createdAt },
    { status: 201 }
  );
}
