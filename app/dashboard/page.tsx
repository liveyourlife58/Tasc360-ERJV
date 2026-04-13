import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings, orderModulesBySettings } from "@/lib/dashboard-settings";
import { getDashboardFeatures } from "@/lib/dashboard-features";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getTenantLocale, formatDate } from "@/lib/format";
import { getTenantTimeZone } from "@/lib/tenant-timezone";
import { fetchDeadlineAttentionRows } from "@/lib/dashboard-overview";
import { DashboardHomeOverview } from "@/components/dashboard/DashboardHomeOverview";

function buildSubscriptionOverviewCard(
  subscriptionEnabled: boolean,
  tenant: {
    subscriptionStatus: string | null;
    subscriptionCurrentPeriodEnd: Date | null;
  } | null,
  locale: string | undefined
): { title: string; body: string; href?: string } | null {
  if (!subscriptionEnabled || !tenant?.subscriptionStatus) return null;
  const st = tenant.subscriptionStatus;
  if (st === "active") return null;
  const href = "/dashboard/subscription";
  if (st === "trialing") {
    const end = tenant.subscriptionCurrentPeriodEnd;
    const endStr = end ? formatDate(end, locale) : "soon";
    return {
      title: "Subscription",
      body: `Trial in progress. Current period ends ${endStr}.`,
      href,
    };
  }
  if (st === "past_due") {
    return {
      title: "Subscription",
      body: "Payment is past due. Update your payment method to avoid losing access.",
      href,
    };
  }
  if (st === "canceled") {
    return { title: "Subscription", body: "This workspace’s subscription is canceled.", href };
  }
  if (st === "unpaid" || st === "incomplete" || st === "incomplete_expired") {
    return {
      title: "Subscription",
      body: "Billing needs attention — finish setup or resolve payment.",
      href,
    };
  }
  return { title: "Subscription", body: `Billing status: ${st}.`, href };
}

export default async function DashboardHome() {
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId || !userId) redirect("/login");

  const [tenant, modulesWithFields, canReadEntities] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        settings: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
      },
    }),
    prisma.module.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        fields: {
          orderBy: { sortOrder: "asc" },
          select: { slug: true, fieldType: true, sortOrder: true, settings: true },
        },
      },
    }),
    hasPermission(userId, PERMISSIONS.entitiesRead),
  ]);

  const dashboardSettings = getDashboardSettings(tenant?.settings ?? null);
  const orderedModules = orderModulesBySettings(modulesWithFields, dashboardSettings.sidebarOrder);

  const home = dashboardSettings.home;
  if (home?.type === "module") {
    const m = orderedModules.find((x) => x.slug === home.moduleSlug);
    if (m) redirect(`/dashboard/m/${m.slug}`);
  }
  if (home?.type === "view") {
    redirect(`/dashboard/m/${home.moduleSlug}?view=${home.viewId}`);
  }

  if (orderedModules.length === 0) {
    return (
      <div>
        <div className="page-header">
          <h1>Dashboard</h1>
        </div>
        <p className="settings-hint" style={{ maxWidth: "36rem", lineHeight: 1.5 }}>
          No modules yet. Open{" "}
          <Link href="/dashboard/settings" className="module-list-link">
            Dashboard settings
          </Link>{" "}
          and choose <strong>Modules &amp; data</strong> (under Dashboard &amp; backend) to start from a template, use AI, or
          import data.
        </p>
      </div>
    );
  }

  const features = getDashboardFeatures(tenant?.settings ?? null);
  const locale = getTenantLocale(tenant?.settings ?? null);
  const tenantTz = getTenantTimeZone(tenant?.settings);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [approvalPendingCount, activityLast7dCount, deadlineAttention] = await Promise.all([
    canReadEntities && features.approvals
      ? prisma.approval.count({ where: { tenantId, status: "pending" } })
      : Promise.resolve(0),
    canReadEntities && features.activity
      ? prisma.event.count({ where: { tenantId, createdAt: { gte: weekAgo } } })
      : Promise.resolve(0),
    canReadEntities
      ? fetchDeadlineAttentionRows(prisma, {
          tenantId,
          modules: orderedModules,
          tenantTimeZone: tenantTz,
        })
      : Promise.resolve([]),
  ]);

  const subscriptionCard = buildSubscriptionOverviewCard(features.subscription, tenant, locale);

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="settings-hint" style={{ marginTop: "0.35rem", marginBottom: 0, maxWidth: "42rem" }}>
          Summary of what needs attention. Open <strong>Modules &amp; data</strong> in settings for templates, AI, and import/export.
        </p>
      </div>
      <DashboardHomeOverview
        canReadEntities={canReadEntities}
        features={{
          approvals: features.approvals,
          activity: features.activity,
          subscription: features.subscription,
        }}
        approvalPendingCount={approvalPendingCount}
        activityLast7dCount={activityLast7dCount}
        subscriptionCard={subscriptionCard}
        deadlineAttention={deadlineAttention}
        orderedModules={orderedModules.map((m) => ({ id: m.id, name: m.name, slug: m.slug }))}
      />
    </div>
  );
}
