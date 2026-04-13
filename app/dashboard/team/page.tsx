import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRoles } from "@/lib/roles";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getBillingConfig, computeMonthlyTotalUsd } from "@/lib/billing";
import { getTrialDays } from "@/lib/app-config";
import { getDashboardFeatures } from "@/lib/dashboard-features";
import { AddUserForm } from "../subscription/AddUserForm";
import { TeamTableWithEditModal } from "../subscription/TeamTableWithEditModal";
import { SubscriptionBillingBlock } from "../subscription/SubscriptionBillingBlock";
import { RolesSection } from "./RolesSection";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; session_id?: string; gated?: string; cancel?: string }>;
}) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) redirect("/login");

  await ensureDefaultRoles(tenantId);

  const params = await searchParams;
  const isGated = params.gated === "1";
  if (params.success && params.session_id) {
    const { syncTenantSubscriptionFromCheckoutSession } = await import("@/lib/stripe-platform");
    await syncTenantSubscriptionFromCheckoutSession(params.session_id);
    redirect("/dashboard/team");
  }

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const dashboardFeatures = getDashboardFeatures(tenantRow?.settings ?? null);
  if (!dashboardFeatures.teamBilling) {
    redirect("/dashboard");
  }

  const canManageUsers = await hasPermission(userId, PERMISSIONS.usersManage);
  const canManageBilling = await hasPermission(userId, PERMISSIONS.settingsManage);

  const [tenant, users, roles] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
      },
    }),
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        roleId: true,
        role: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.role.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, name: true, description: true, permissions: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rolesForForms = roles.map((r) => ({ id: r.id, name: r.name }));

  const rolesWithCount =
    canManageUsers
      ? await Promise.all(
          roles.map(async (r) => {
            const count = await prisma.user.count({ where: { tenantId, roleId: r.id } });
            return { ...r, userCount: count };
          })
        )
      : [];

  const activeUserCount = users.filter((u) => u.isActive).length;
  const billing = getBillingConfig();
  const estimatedMonthlyUsd = computeMonthlyTotalUsd(activeUserCount);
  const subscriptionActive = tenant?.subscriptionStatus === "active" || tenant?.subscriptionStatus === "trialing";

  return (
    <div>
      <div className="page-header">
        <h1>Team &amp; billing</h1>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>

      {isGated && (
        <div className="view-error" style={{ marginBottom: "1rem", padding: "1rem" }} role="alert">
          Your subscription is not active. Subscribe or update your billing to access the dashboard.
        </div>
      )}

      <section className="subscription-section">
        <h2 className="subscription-heading">Plan &amp; billing</h2>
        <div className="subscription-plan-breakdown">
          {billing.platformFeeUsd > 0 && (
            <p className="subscription-plan-line">
              <strong>Platform fee:</strong> ${billing.platformFeeUsd}/month
            </p>
          )}
          <p className="subscription-plan-line">
            <strong>Per user:</strong> ${billing.perUserFeeUsd}/user/month × {activeUserCount} active user
            {activeUserCount !== 1 ? "s" : ""} = ${(billing.perUserFeeUsd * activeUserCount).toFixed(2)}
          </p>
          <p className="subscription-plan-total">
            <strong>Estimated total (full month):</strong> ${estimatedMonthlyUsd.toFixed(2)}/month
          </p>
          {getTrialDays() > 0 && (
            <p className="subscription-plan-line" style={{ marginTop: "0.5rem" }}>
              <strong>Free trial:</strong> New subscriptions include a {getTrialDays()}-day free trial. You won&apos;t be
              charged until it ends.
            </p>
          )}
          <div className="subscription-plan-proration">
            <p className="subscription-plan-proration-intro">
              {billing.platformFeeUsd > 0
                ? "Both fees are prorated when you sign up mid-cycle, add/remove users, or cancel."
                : "Per-user charges are prorated when you sign up mid-cycle, add/remove users, or cancel."}
            </p>
          </div>
          <p className="subscription-next-invoice">
            <strong>Status:</strong>{" "}
            <span className="subscription-next-invoice-value">
              {tenant?.subscriptionStatus
                ? `${tenant.subscriptionStatus}${
                    tenant.subscriptionCurrentPeriodEnd
                      ? ` · Renews ${tenant.subscriptionCurrentPeriodEnd.toLocaleDateString()}`
                      : ""
                  }`
                : "Not subscribed"}
            </span>
          </p>
        </div>
        {canManageBilling && (
          <SubscriptionBillingBlock
            hasSubscription={!!tenant?.stripeSubscriptionId}
            subscriptionActive={subscriptionActive}
          />
        )}
        <p className="settings-hint">
          Billing is managed by Stripe. Adding or removing users updates your next invoice automatically.
        </p>
      </section>

      <section className="subscription-section team-users-section">
        <h2 className="subscription-heading">Team ({users.length} user{users.length !== 1 ? "s" : ""})</h2>
        <div className="team-users-layout">
          {canManageUsers && (
            <aside className="team-add-user-card" aria-labelledby="team-add-user-heading">
              <h3 id="team-add-user-heading" className="team-add-user-card-title">
                Add member
              </h3>
              <p className="team-add-user-card-hint">Invite by email or create an account with a temporary password.</p>
              <AddUserForm tenantId={tenantId} roles={rolesForForms} />
            </aside>
          )}
          <div className="team-members-column">
            <TeamTableWithEditModal
              users={users}
              roles={rolesForForms}
              tenantId={tenantId}
              currentUserId={userId}
              canManageUsers={canManageUsers}
            />
            {!canManageUsers && (
              <p className="settings-hint">
                Only users with the right role can add or edit team members. Ask an admin to change your role.
              </p>
            )}
          </div>
        </div>
      </section>

      {canManageUsers && (
        <section className="subscription-section">
          <RolesSection tenantId={tenantId} roles={rolesWithCount} />
        </section>
      )}
    </div>
  );
}
