import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRoles } from "@/lib/roles";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getBillingConfig, computeMonthlyTotalUsd } from "@/lib/billing";
import { AddUserForm } from "./AddUserForm";
import { TeamTableWithEditModal } from "./TeamTableWithEditModal";
import { SubscriptionBillingBlock } from "./SubscriptionBillingBlock";

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; session_id?: string; gated?: string }>;
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
    redirect("/dashboard/subscription");
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
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const activeUserCount = users.filter((u) => u.isActive).length;
  const billing = getBillingConfig();
  const estimatedMonthlyUsd = computeMonthlyTotalUsd(activeUserCount);
  const subscriptionActive = tenant?.subscriptionStatus === "active" || tenant?.subscriptionStatus === "trialing";

  return (
    <div>
      <div className="page-header">
        <h1>Subscription &amp; team</h1>
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
          <p className="subscription-plan-line">
            <strong>Platform fee:</strong> ${billing.platformFeeUsd}/month
          </p>
          <p className="subscription-plan-line">
            <strong>Per user:</strong> ${billing.perUserFeeUsd}/user/month × {activeUserCount} active user{activeUserCount !== 1 ? "s" : ""} = ${(billing.perUserFeeUsd * activeUserCount).toFixed(2)}
          </p>
          <p className="subscription-plan-total">
            <strong>Estimated total (full month):</strong> ${estimatedMonthlyUsd.toFixed(2)}/month
          </p>
          <div className="subscription-plan-proration">
            <p className="subscription-plan-proration-intro">
              Both fees are prorated when you sign up mid-cycle, add/remove users, or cancel.
            </p>
          </div>
          <p className="subscription-next-invoice">
            <strong>Status:</strong>{" "}
            <span className="subscription-next-invoice-value">
              {tenant?.subscriptionStatus
                ? `${tenant.subscriptionStatus}${tenant.subscriptionCurrentPeriodEnd ? ` · Renews ${tenant.subscriptionCurrentPeriodEnd.toLocaleDateString()}` : ""}`
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

      <section className="subscription-section">
        <h2 className="subscription-heading">Team ({users.length} user{users.length !== 1 ? "s" : ""})</h2>
        <TeamTableWithEditModal
          users={users}
          roles={roles}
          tenantId={tenantId}
          currentUserId={userId}
          canManageUsers={canManageUsers}
        />

        {canManageUsers && (
          <>
            <h3 className="subscription-subheading">Add user</h3>
            <AddUserForm tenantId={tenantId} roles={roles} />
          </>
        )}

        {!canManageUsers && (
          <p className="settings-hint">Only admins can add or remove users. Ask an admin to change your role if needed.</p>
        )}
      </section>
    </div>
  );
}
