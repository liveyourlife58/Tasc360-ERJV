import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import {
  applyViewToEntities,
  filterEntitiesByKeyword,
  getColumnOrder,
  type ViewConfig,
} from "@/lib/view-utils";
import { APP_CONFIG } from "@/lib/app-config";
import { getModuleEntityListCreatedAtOrder } from "@/lib/module-settings";

export const dynamic = "force-dynamic";

const EXPORT_LIMIT = 5000;

function csvEscape(s: string): string {
  const str = String(s ?? "");
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleSlug: string }> }
) {
  const session = getSessionFromCookie(request.headers.get("cookie") ?? "");
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const canRead = await hasPermission(session.userId, PERMISSIONS.entitiesRead);
  if (!canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { moduleSlug } = await params;
  const viewId = request.nextUrl.searchParams.get("view")?.trim() || null;
  const showDeleted = request.nextUrl.searchParams.get("deleted") === "1";
  const searchQuery = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const module_ = await prisma.module.findFirst({
    where: { tenantId: session.tenantId, slug: moduleSlug, isActive: true },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!module_) return NextResponse.json({ error: "Module not found." }, { status: 404 });

  let viewConfig: ViewConfig | null = null;
  if (viewId) {
    const view = await prisma.view.findFirst({
      where: { id: viewId, tenantId: session.tenantId, moduleId: module_.id },
      select: { filter: true, sort: true, columns: true },
    });
    if (view && (view.filter || view.sort || view.columns))
      viewConfig = {
        filter: view.filter as ViewConfig["filter"],
        sort: view.sort as ViewConfig["sort"],
        columns: view.columns as ViewConfig["columns"],
      };
  }

  const listOrder = getModuleEntityListCreatedAtOrder(module_);
  const entities = await prisma.entity.findMany({
    where: {
      tenantId: session.tenantId,
      moduleId: module_.id,
      ...(showDeleted ? { deletedAt: { not: null } } : { deletedAt: null }),
    },
    orderBy: { createdAt: listOrder },
    take: EXPORT_LIMIT,
    select: { id: true, data: true, createdAt: true },
  });

  const filtered = applyViewToEntities(
    entities as { id: string; data: unknown; createdAt: Date }[],
    viewConfig
  );
  const fieldSlugs = module_.fields.map((f) => f.slug);
  const columnSlugs = getColumnOrder(viewConfig, fieldSlugs, APP_CONFIG.entityListMaxColumns);
  const headerSlugs = ["id", "createdAt", ...columnSlugs];
  const header = headerSlugs.map(csvEscape).join(",") + "\n";
  const rows = filtered.map((e) => {
    const data = (e.data as Record<string, unknown>) ?? {};
    const cells: string[] = [
      e.id,
      e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt ?? ""),
      ...columnSlugs.map((slug) => {
        const v = data[slug];
        if (v == null) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      }),
    ];
    return cells.map(csvEscape).join(",");
  });
  const csv = header + rows.join("\n");

  const filename = `export-${module_.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
