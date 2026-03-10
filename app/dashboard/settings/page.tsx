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
  const rawContact = pages.contact;
  const contactFields =
    typeof rawContact === "object" && rawContact !== null && !Array.isArray(rawContact)
      ? {
          email: (rawContact as Record<string, unknown>).email as string | undefined,
          phone: (rawContact as Record<string, unknown>).phone as string | undefined,
          addressLine1: (rawContact as Record<string, unknown>).addressLine1 as string | undefined,
          addressLine2: (rawContact as Record<string, unknown>).addressLine2 as string | undefined,
          city: (rawContact as Record<string, unknown>).city as string | undefined,
          state: (rawContact as Record<string, unknown>).state as string | undefined,
          postalCode: (rawContact as Record<string, unknown>).postalCode as string | undefined,
          country: (rawContact as Record<string, unknown>).country as string | undefined,
          extraContent: (rawContact as Record<string, unknown>).extraContent as string | undefined,
        }
      : typeof rawContact === "string" && rawContact.trim() !== ""
        ? { extraContent: rawContact }
        : {};
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
        contactFields={contactFields}
        currentMetaTitle={currentMetaTitle}
        currentMetaDescription={currentMetaDescription}
        currentOgImage={currentOgImage}
        currentCanonicalBaseUrl={currentCanonicalBaseUrl}
      />
    </div>
  );
}
