import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRoles } from "@/lib/roles";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getBillingConfig, computeMonthlyTotalUsd } from "@/lib/billing";
import { AddUserForm } from "./AddUserForm";
import { TeamTableWithEditModal } from "./TeamTableWithEditModal";

export default async function SubscriptionPage() {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) redirect("/login");

  await ensureDefaultRoles(tenantId);

  const canManageUsers = await hasPermission(userId, PERMISSIONS.usersManage);

  const [users, roles] = await Promise.all([
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

  return (
    <div>
      <div className="page-header">
        <h1>Subscription &amp; team</h1>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>

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
            <p className="subscription-plan-proration-example-title">Example (March 1–31):</p>
            <ul className="subscription-plan-proration-list">
              <li>Sign up March 15 → platform <strong>${(billing.platformFeeUsd * (17 / 31)).toFixed(2)}</strong></li>
              <li>Add user March 15 → <strong>${(billing.perUserFeeUsd * (17 / 31)).toFixed(2)}</strong></li>
              <li>Remove user March 20 → <strong>${(billing.perUserFeeUsd * (11 / 31)).toFixed(2)}</strong> credit</li>
            </ul>
            <p className="subscription-plan-proration-hint">(Remove example when Stripe is live.)</p>
          </div>
          <p className="subscription-next-invoice">
            <strong>Next invoice:</strong> <span className="subscription-next-invoice-value">— (connect Stripe to see)</span>
          </p>
        </div>
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
