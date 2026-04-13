import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardSettings, orderModulesBySettings } from "@/lib/dashboard-settings";
import { getFeatureFlags } from "@/lib/feature-flags";
import { getDashboardFeatures } from "@/lib/dashboard-features";
import { getModulePaymentType } from "@/lib/module-settings";
import { getTenantConnectConfig } from "@/lib/stripe-connect";
import { listApiKeys } from "@/lib/api-keys";
import { getConsentTypes } from "@/lib/consent";
import { getAllowDeveloperSetup, isPlatformAdmin } from "@/lib/developer-setup";
import {
  updateTenantSettingsAsPlatformAdmin,
  updateTenantDeveloperSetupFormAction,
  updateConsentTypesAsPlatformAdmin,
  createApiKeyAsPlatformAdminFormAction,
  revokeApiKeyAsPlatformAdminFormAction,
} from "../../../actions";
import { SuccessBanner } from "@/components/dashboard/SuccessBanner";
import { SettingsSectionCards } from "@/app/dashboard/settings/SettingsSectionCards";
import { getTenantTimeZone } from "@/lib/tenant-timezone";

export default async function PlatformTenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const h = await headers();
  const userId = h.get("x-user-id");
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!isPlatformAdmin(user?.email ?? null)) redirect("/dashboard");

  const { tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, settings: true },
  });
  if (!tenant) notFound();

  const settingsObj = (tenant.settings as Record<string, unknown>) ?? {};
  const site = (settingsObj.site as Record<string, unknown>) ?? {};
  const pages = (settingsObj.pages as Record<string, unknown>) ?? {};
  const dashboardSettings = getDashboardSettings(tenant.settings ?? null);

  const currentSiteName = (site.name as string) ?? "";
  const currentTagline = (site.tagline as string) ?? "";
  const currentHeroImage = (site.heroImage as string) ?? "";
  const currentFooterHtml = (site.footerHtml as string) ?? "";
  const currentShowCookieBanner = (site.showCookieBanner as boolean) === true;
  const currentCookiePolicyUrl = (site.cookiePolicyUrl as string) ?? "";
  const currentMetaTitle = (site.metaTitle as string) ?? "";
  const currentMetaDescription = (site.metaDescription as string) ?? "";
  const currentOgImage = (site.ogImage as string) ?? "";
  const currentCanonicalBaseUrl = (site.canonicalBaseUrl as string) ?? "";
  const currentCustomDomain = (site.customDomain as string) ?? "";
  const currentFaviconUrl = (site.faviconUrl as string) ?? "";
  const waitlistRaw = site.waitlist as
    | { moduleSlug: string; eventFieldSlug: string; emailFieldSlug: string; quantityFieldSlug: string }
    | undefined;
  const currentWaitlist = waitlistRaw && waitlistRaw.moduleSlug ? waitlistRaw : null;
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

  const modules = await prisma.module.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      settings: true,
      fields: { orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true } },
    },
  });
  const modulePaymentTypes: Record<string, "payment" | "donation" | null> = {};
  for (const m of modules) {
    modulePaymentTypes[m.slug] = getModulePaymentType(m);
  }

  const hubOrderedModules = orderModulesBySettings(modules, dashboardSettings.sidebarOrder).map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
  }));

  const viewsByModule: Record<string, { id: string; name: string }[]> = {};
  for (const m of modules) {
    const views = await prisma.view.findMany({
      where: { tenantId, moduleId: m.id },
      select: { id: true, name: true },
    });
    viewsByModule[m.slug] = views;
  }

  const stripeConnectConfig = getTenantConnectConfig(tenant);
  const currentWebhookUrl = (settingsObj.webhookUrl as string) ?? "";
  const currentWebhookSecret = (settingsObj.webhookSecret as string) ?? "";
  const currentWebhookDeliveries = await prisma.webhookDelivery.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      event: true,
      url: true,
      success: true,
      statusCode: true,
      errorMessage: true,
      createdAt: true,
    },
  });
  const currentNotificationEmail = (settingsObj.notificationEmail as string) ?? "";
  const emailNotif = (settingsObj.emailNotifications as Record<string, boolean>) ?? {};
  const emailNotificationFlags = {
    approvalRequested: !!emailNotif.approvalRequested,
    paymentReceived: !!emailNotif.paymentReceived,
    paymentFailed: !!emailNotif.paymentFailed,
    webhookFailed: !!emailNotif.webhookFailed,
  };
  const currentEmailFromAddress = (settingsObj.emailFromAddress as string) ?? "";
  const currentEmailFromName = (settingsObj.emailFromName as string) ?? "";
  const currentEmailReplyTo = (settingsObj.emailReplyTo as string) ?? "";
  const currentLocale = (settingsObj.locale as string) ?? "";
  const currentTimeZone = getTenantTimeZone(tenant.settings ?? null);
  const featureFlags = getFeatureFlags(tenant.settings ?? null);
  const dashboardFeatures = getDashboardFeatures(tenant.settings ?? null);
  const apiKeys = await listApiKeys(tenantId);
  const currentConsentTypes = getConsentTypes(settingsObj);
  const allowDeveloperSetup = getAllowDeveloperSetup(tenant.settings ?? null);
  const success = (await searchParams).success;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  const platformUpdateAction = async (prev: unknown, formData: FormData) => {
    const fd = new FormData();
    formData.forEach((v, k) => fd.append(k, v));
    fd.set("targetTenantId", tenantId);
    return updateTenantSettingsAsPlatformAdmin(prev, fd);
  };

  return (
    <div>
      <Suspense fallback={null}>
        <SuccessBanner successKey={success} />
      </Suspense>
      <div className="page-header">
        <h1>{tenant.name ?? tenant.slug ?? "Tenant"}</h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/dashboard/platform" className="btn btn-secondary">
            Back to Platform admin
          </Link>
          {baseUrl && tenant.slug && dashboardFeatures.customerSite && (
            <a
              href={`${baseUrl}/s/${tenant.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              View public site
            </a>
          )}
        </div>
      </div>
      <dl className="subscription-section" style={{ marginBottom: "1.5rem" }}>
        <dt>Slug</dt>
        <dd>
          <code>{tenant.slug ?? "—"}</code>
        </dd>
      </dl>
      <p className="page-description" style={{ marginBottom: "1rem" }}>
        <Link href={`/dashboard/platform/tenant/${tenantId}/modules`} className="btn btn-secondary">
          Edit modules &amp; fields
        </Link>
      </p>
      <p className="settings-intro">Change this tenant&apos;s settings below. All sections are editable.</p>
      <SettingsSectionCards
        tenantId={tenantId}
        hubOrderedModules={hubOrderedModules}
        updateAction={updateTenantSettingsAsPlatformAdmin}
        extraFormFields={{
          targetTenantId: tenantId,
          returnTo: `/dashboard/platform/tenant/${tenantId}`,
        }}
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
        currentFooterHtml={currentFooterHtml}
        currentShowCookieBanner={currentShowCookieBanner}
        currentCookiePolicyUrl={currentCookiePolicyUrl}
        homepageSidebarModule={homepageSidebarModule}
        homepageSidebarFieldSlugs={homepageSidebarFieldSlugs}
        currentHomeContent={currentHomeContent}
        contactFields={contactFields}
        currentMetaTitle={currentMetaTitle}
        currentMetaDescription={currentMetaDescription}
        currentOgImage={currentOgImage}
        currentCanonicalBaseUrl={currentCanonicalBaseUrl}
        currentCustomDomain={currentCustomDomain}
        currentFaviconUrl={currentFaviconUrl}
        currentWaitlist={currentWaitlist}
        stripeConnectConfig={stripeConnectConfig}
        currentWebhookUrl={currentWebhookUrl}
        currentWebhookSecret={currentWebhookSecret}
        currentWebhookDeliveries={currentWebhookDeliveries}
        currentNotificationEmail={currentNotificationEmail}
        emailNotificationFlags={emailNotificationFlags}
        currentEmailFromAddress={currentEmailFromAddress}
        currentEmailFromName={currentEmailFromName}
        currentEmailReplyTo={currentEmailReplyTo}
        currentLocale={currentLocale}
        currentTimeZone={currentTimeZone}
        featureFlags={featureFlags}
        dashboardFeatures={dashboardFeatures}
        apiKeys={apiKeys}
        createApiKeyAction={createApiKeyAsPlatformAdminFormAction}
        revokeApiKeyAction={revokeApiKeyAsPlatformAdminFormAction}
        currentConsentTypes={currentConsentTypes}
        updateConsentTypesFormAction={updateConsentTypesAsPlatformAdmin}
        showDeveloperSections={true}
        isPlatformAdmin={true}
        allowDeveloperSetup={allowDeveloperSetup}
        updateAllowDeveloperSetupFormAction={updateTenantDeveloperSetupFormAction}
      />
    </div>
  );
}
