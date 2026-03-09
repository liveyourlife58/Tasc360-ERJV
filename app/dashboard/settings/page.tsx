import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings } from "@/lib/dashboard-settings";
import { getModulePaymentType } from "@/lib/module-settings";
import { updateDashboardSettings } from "../actions";
import { SettingsSectionCards } from "./SettingsSectionCards";

export default async function DashboardSettingsPage() {
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) redirect("/login");

  const [tenant, modules] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, settings: true },
    }),
    prisma.module.findMany({
      where: { tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        settings: true,
        fields: { orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true } },
      },
    }),
  ]);
  const dashboardSettings = getDashboardSettings(tenant?.settings ?? null);
  const settingsObj = (tenant?.settings as Record<string, unknown>) ?? {};
  const site = (settingsObj.site as Record<string, unknown>) ?? {};
  const pages = (settingsObj.pages as Record<string, unknown>) ?? {};
  const currentSiteName = (site.name as string) ?? "";
  const currentTagline = (site.tagline as string) ?? "";
  const currentHeroImage = (site.heroImage as string) ?? "";
  const currentMetaTitle = (site.metaTitle as string) ?? "";
  const currentMetaDescription = (site.metaDescription as string) ?? "";
  const currentOgImage = (site.ogImage as string) ?? "";
  const currentCanonicalBaseUrl = (site.canonicalBaseUrl as string) ?? "";
  const homepageSidebarModule = (site.homepageSidebarModule as string) ?? "";
  const homepageSidebarFieldSlugs = Array.isArray(site.homepageSidebarFieldSlugs)
    ? (site.homepageSidebarFieldSlugs as string[])
    : [];
  const currentHomeContent = (pages.home as string) ?? "";
  const publicModules = (site.publicModules as Record<string, { slug: string; showInNav?: boolean }>) ?? {};
  const modulePaymentTypes: Record<string, "payment" | "donation" | null> = {};
  for (const m of modules) {
    modulePaymentTypes[m.slug] = getModulePaymentType(m);
  }

  const viewsByModule: Record<string, { id: string; name: string }[]> = {};
  for (const m of modules) {
    const views = await prisma.view.findMany({
      where: { tenantId, moduleId: m.id },
      select: { id: true, name: true },
    });
    viewsByModule[m.slug] = views;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard settings</h1>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>
      <p className="settings-intro">Click a section to open its settings.</p>
      <SettingsSectionCards
        tenantId={tenantId}
        updateAction={updateDashboardSettings.bind(null, tenantId)}
        branding={dashboardSettings.branding}
        home={dashboardSettings.home}
        sidebarOrder={dashboardSettings.sidebarOrder}
        publicModules={publicModules}
        modulePaymentTypes={modulePaymentTypes}
        modules={modules}
        viewsByModule={viewsByModule}
        currentSiteName={currentSiteName}
        currentTagline={currentTagline}
        currentHeroImage={currentHeroImage}
        homepageSidebarModule={homepageSidebarModule}
        homepageSidebarFieldSlugs={homepageSidebarFieldSlugs}
        currentHomeContent={currentHomeContent}
        currentMetaTitle={currentMetaTitle}
        currentMetaDescription={currentMetaDescription}
        currentOgImage={currentOgImage}
        currentCanonicalBaseUrl={currentCanonicalBaseUrl}
      />
    </div>
  );
}
