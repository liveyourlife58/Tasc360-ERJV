import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getAllowDeveloperSetup } from "@/lib/developer-setup";
import { isIntegrationEncryptionConfigured } from "@/lib/integration-credentials";
import { IntegrationList } from "./IntegrationList";

export default async function IntegrationsPage() {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) redirect("/login");

  const canManage = await hasPermission(userId, PERMISSIONS.settingsManage);
  if (!canManage) redirect("/dashboard");

  const [tenant, hasDeveloperPermission] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } }),
    hasPermission(userId, PERMISSIONS.settingsDeveloper),
  ]);
  const allowDeveloperSetup = getAllowDeveloperSetup(tenant?.settings ?? null);
  if (!allowDeveloperSetup || !hasDeveloperPermission) redirect("/dashboard");

  const [integrations, encryptionOk] = await Promise.all([
    prisma.integration.findMany({
      where: { tenantId },
      select: { id: true, provider: true, lastSyncedAt: true, createdAt: true },
      orderBy: { provider: "asc" },
    }),
    Promise.resolve(isIntegrationEncryptionConfigured()),
  ]);

  return (
    <div>
      <div className="page-header">
        <h1>Integrations</h1>
      </div>
      <p className="page-description">
        Connect accounting and other services to sync data. Connection flows (e.g. QuickBooks Online) will appear here when available.
      </p>
      {!encryptionOk && (
        <div className="integrations-admin-hint" role="status">
          To enable connecting integrations, set <code>INTEGRATION_ENCRYPTION_KEY</code> (32-byte hex) in your environment. Generate with: <code>openssl rand -hex 32</code>.
        </div>
      )}
      <IntegrationList integrations={integrations} encryptionOk={encryptionOk} />
    </div>
  );
}
