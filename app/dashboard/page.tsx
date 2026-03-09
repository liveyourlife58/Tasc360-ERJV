import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings, orderModulesBySettings } from "@/lib/dashboard-settings";
import { CreateModuleAiForm } from "@/components/dashboard/CreateModuleAiForm";

export default async function DashboardHome() {
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) redirect("/login");

  const [tenant, modules] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    }),
    prisma.module.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, description: true },
    }),
  ]);
  const dashboardSettings = getDashboardSettings(tenant?.settings ?? null);
  const orderedModules = orderModulesBySettings(
    modules,
    dashboardSettings.sidebarOrder
  );

  const home = dashboardSettings.home;
  if (home?.type === "module") {
    const m = modules.find((x) => x.slug === home.moduleSlug);
    if (m) redirect(`/dashboard/m/${m.slug}`);
  }
  if (home?.type === "view") {
    redirect(`/dashboard/m/${home.moduleSlug}?view=${home.viewId}`);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Modules</h1>
      </div>
      <CreateModuleAiForm tenantId={tenantId} />
      {orderedModules.length === 0 ? (
        <p style={{ color: "#6b7280", marginTop: "1rem" }}>
          No modules yet. Describe one above with AI, or create via the API or seed data.
        </p>
      ) : (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {orderedModules.map((m) => (
            <li key={m.id}>
              <Link
                href={`/dashboard/m/${m.slug}`}
                style={{
                  display: "block",
                  padding: "0.75rem 1rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  background: "#fff",
                }}
              >
                <span style={{ fontWeight: 600 }}>{m.name}</span>
                {m.description && (
                  <span style={{ display: "block", fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
                    {m.description}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
