import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = getSessionFromCookie(request.headers.get("cookie") ?? "");
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const canRead = await hasPermission(session.userId, PERMISSIONS.entitiesRead);
  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filterUser = searchParams.get("user")?.trim() || null;
  const filterEventType = searchParams.get("eventType")?.trim() || null;
  const filterModule = searchParams.get("module")?.trim() || null;
  const dateFromStr = searchParams.get("dateFrom")?.trim() || null;
  const dateToStr = searchParams.get("dateTo")?.trim() || null;
  const dateFrom = dateFromStr ? new Date(dateFromStr) : null;
  const dateTo = dateToStr ? new Date(dateToStr) : null;

  const where = {
    tenantId: session.tenantId,
    ...(filterEventType && { eventType: filterEventType }),
    ...(filterUser && { createdBy: filterUser }),
    ...(dateFrom && dateTo && { createdAt: { gte: dateFrom, lte: dateTo } }),
    ...(dateFrom && !dateTo && { createdAt: { gte: dateFrom } }),
    ...(!dateFrom && dateTo && { createdAt: { lte: dateTo } }),
    ...(filterModule && { entity: { module: { slug: filterModule } } }),
  };

  const events = await prisma.event.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      eventType: true,
      entityId: true,
      data: true,
      createdAt: true,
      createdBy: true,
      entity: { select: { module: { select: { slug: true, name: true } } } },
      createdByUser: { select: { email: true, name: true } },
    },
  });

  const header = "Time,Event,User,Module,Entity ID\n";
  const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = events.map((e) => {
    const time = e.createdAt.toISOString();
    const user = e.createdByUser ? (e.createdByUser.name || e.createdByUser.email || "") : "";
    const mod = e.entity?.module?.name ?? e.entity?.module?.slug ?? "";
    return [time, e.eventType, user, mod, e.entityId ?? ""].map(escape).join(",");
  });
  const csv = header + rows.join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="activity-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
