import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getConsentTypes } from "@/lib/consent";
import { listConsents, revokeConsent, grantConsentFormAction } from "@/app/dashboard/actions";
import { ConsentFilters } from "./ConsentFilters";
import { ConsentList } from "./ConsentList";
import { GrantConsentForm } from "./GrantConsentForm";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; type?: string; activeOnly?: string }>;
}) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) redirect("/login");

  const canRead = await hasPermission(userId, PERMISSIONS.entitiesRead);
  const canManage = await hasPermission(userId, PERMISSIONS.settingsManage);
  if (!canRead) redirect("/dashboard");

  const params = await searchParams;
  const filterUser = params.user?.trim() || undefined;
  const filterType = params.type?.trim() || undefined;
  const activeOnly = params.activeOnly !== "0";

  const [tenant, result, users] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    }),
    listConsents({
      userId: filterUser,
      consentType: filterType,
      activeOnly,
    }),
    canRead
      ? prisma.user.findMany({
          where: { tenantId },
          select: { id: true, email: true, name: true },
          orderBy: { email: "asc" },
        })
      : [],
  ]);

  const consentTypes = getConsentTypes(tenant?.settings as Record<string, unknown> ?? null);
  const consents = result.error ? [] : result.consents ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>Consent</h1>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>
      <p className="settings-intro" style={{ marginBottom: "1rem" }}>
        Manage consent records (e.g. marketing, essential, analytics). Configure consent types in{" "}
        <Link href="/dashboard/settings">Settings</Link>. Revoking sets the revocation date; it does not delete the record.
      </p>
      <ConsentFilters
        users={users}
        consentTypes={consentTypes}
        currentUser={filterUser}
        currentType={filterType}
        activeOnly={activeOnly}
      />
      {canManage && (
        <GrantConsentForm
          users={users}
          consentTypes={consentTypes}
          grantAction={grantConsentFormAction}
        />
      )}
      <ConsentList
        consents={consents}
        onRevoke={canManage ? revokeConsent : undefined}
      />
    </div>
  );
}
