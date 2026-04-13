import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getTenantLocale, formatDateTime } from "@/lib/format";
import { ActivityFilters } from "./ActivityFilters";
import { formatEntityEventActorLabel } from "@/lib/entity-event-actor";
import { readFieldChangesFromEventData, readMetadataChangesFromEventData } from "@/lib/entity-event-field-changes";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; eventType?: string; module?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) redirect("/login");

  const canRead = await hasPermission(userId, PERMISSIONS.entitiesRead);
  if (!canRead) redirect("/dashboard");

  const params = await searchParams;
  const filterUser = params.user?.trim() || null;
  const filterEventType = params.eventType?.trim() || null;
  const filterModule = params.module?.trim() || null;
  const dateFromStr = params.dateFrom?.trim() || null;
  const dateToStr = params.dateTo?.trim() || null;
  const dateFrom = dateFromStr ? new Date(dateFromStr) : null;
  const dateTo = dateToStr ? new Date(dateToStr) : null;

  const where = {
    tenantId,
    ...(filterEventType && { eventType: filterEventType }),
    ...(filterUser && { createdBy: filterUser }),
    ...(dateFrom &&
      dateTo && { createdAt: { gte: dateFrom, lte: dateTo } }),
    ...(dateFrom && !dateTo && { createdAt: { gte: dateFrom } }),
    ...(!dateFrom && dateTo && { createdAt: { lte: dateTo } }),
    ...(filterModule && { entity: { module: { slug: filterModule } } }),
  };

  const [tenant, events, users, modules] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    }),
    prisma.event.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        eventType: true,
        entityId: true,
        data: true,
        createdAt: true,
        createdBy: true,
        entity: { select: { id: true, module: { select: { slug: true, name: true } } } },
        createdByUser: { select: { email: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, email: true, name: true },
      orderBy: { email: "asc" },
    }),
    prisma.module.findMany({
      where: { tenantId, isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const locale = getTenantLocale(tenant?.settings ?? null);

  return (
    <div>
      <div className="page-header">
        <h1>Activity</h1>
        <div className="page-header-actions">
          <a
            href={`/dashboard/activity/export?${new URLSearchParams({
              ...(filterUser && { user: filterUser }),
              ...(filterEventType && { eventType: filterEventType }),
              ...(filterModule && { module: filterModule }),
              ...(dateFromStr && { dateFrom: dateFromStr }),
              ...(dateToStr && { dateTo: dateToStr }),
            }).toString()}`}
            className="btn btn-secondary"
          >
            Export CSV
          </a>
          <Link href="/dashboard" className="btn btn-secondary">
            Back to Home
          </Link>
        </div>
      </div>
      <p className="settings-hint" style={{ marginBottom: "1rem" }}>
        Tenant-wide audit log. Filter by user, event type, module, or date range.
      </p>

      <ActivityFilters
        users={users}
        modules={modules}
        currentUser={filterUser}
        currentEventType={filterEventType}
        currentModule={filterModule}
        currentDateFrom={dateFromStr}
        currentDateTo={dateToStr}
      />

      <table className="subscription-team-table" style={{ marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Time</th>
            <th>Event</th>
            <th>User</th>
            <th>Module / Record</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ color: "#64748b" }}>No events match the filters.</td>
            </tr>
          ) : (
            events.map((e) => (
              <tr key={e.id}>
                <td>{formatDateTime(e.createdAt, locale)}</td>
                <td>
                  <div>{e.eventType}</div>
                  {(() => {
                    const d = e.data as Record<string, unknown> | null;
                    const fc = readFieldChangesFromEventData(d);
                    const mc = readMetadataChangesFromEventData(d);
                    const n =
                      (fc ? Object.keys(fc).length : 0) + (mc ? Object.keys(mc).length : 0);
                    if (n === 0) return null;
                    return (
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem" }}>
                        {n} field{n === 1 ? "" : "s"} changed (see record activity)
                      </div>
                    );
                  })()}
                </td>
                <td>{formatEntityEventActorLabel(e.data as Record<string, unknown> | null, e.createdByUser)}</td>
                <td>
                  {e.entity ? (
                    <Link href={`/dashboard/m/${e.entity.module?.slug ?? ""}/${e.entity.id}`}>
                      {e.entity.module?.name ?? e.entity.module?.slug ?? "?"} / {e.entity.id.slice(0, 8)}…
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
