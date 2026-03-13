import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings } from "@/lib/dashboard-settings";
import { getSubscriptionGraceDays } from "@/lib/app-config";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardSidebarToggle } from "@/components/dashboard/DashboardSidebarToggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  const pathname = h.get("x-pathname") ?? "";
  if (!tenantId || !userId) redirect("/login");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, settings: true, subscriptionStatus: true, subscriptionCurrentPeriodEnd: true },
  });
  const dashboardSettings = getDashboardSettings(tenant?.settings ?? null);
  const primaryColor =
    dashboardSettings.branding?.primaryColor ?? "#4f46e5";

  const isSubscriptionPage = pathname === "/dashboard/subscription" || pathname.startsWith("/dashboard/subscription/");
  const allowedStatuses = ["active", "trialing"];
  const graceDays = getSubscriptionGraceDays();
  const periodEnd = tenant?.subscriptionCurrentPeriodEnd ? new Date(tenant.subscriptionCurrentPeriodEnd) : null;
  const graceEnd = periodEnd ? new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000) : null;
  const isPastDueWithGrace =
    tenant?.subscriptionStatus === "past_due" && graceEnd && new Date() <= graceEnd;
  const hasSubscription = !!tenant?.subscriptionStatus;
  const isAllowed =
    !hasSubscription ||
    allowedStatuses.includes(tenant!.subscriptionStatus!) ||
    isPastDueWithGrace;

  if (!isSubscriptionPage && !isAllowed) {
    redirect("/dashboard/subscription?gated=1");
  }

  return (
    <div
      id="dashboard-layout"
      className="dashboard-layout"
      style={{ ["--dashboard-primary" as string]: primaryColor }}
    >
      <a href="#dashboard-main-content" className="skip-link">Skip to main content</a>
      <Sidebar tenantId={tenantId} tenant={tenant} dashboardSettings={dashboardSettings} tenantSlug={tenant?.slug} pathname={pathname} />
      <main id="dashboard-main-content" className="dashboard-main" tabIndex={-1}>
        <DashboardSidebarToggle />
        {isPastDueWithGrace && (
          <div className="banner-warning" role="alert">
            <span>Your payment is past due. Please update your payment method to avoid losing access.</span>
            <a href="/dashboard/subscription" className="btn btn-primary banner-warning-cta">
              Update payment method
            </a>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
