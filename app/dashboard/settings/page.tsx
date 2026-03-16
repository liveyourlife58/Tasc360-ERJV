import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SuccessBanner } from "@/components/dashboard/SuccessBanner";
import { getDashboardSettings } from "@/lib/dashboard-settings";
import { getFeatureFlags } from "@/lib/feature-flags";
import { getModulePaymentType } from "@/lib/module-settings";
import { getTenantConnectConfig } from "@/lib/stripe-connect";
import { listApiKeys } from "@/lib/api-keys";
import { getConsentTypes } from "@/lib/consent";
import { getAllowDeveloperSetup, isPlatformAdmin } from "@/lib/developer-setup";
import { getCustomerLoginSettings } from "@/lib/customer-login-settings";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { updateDashboardSettings, connectStripeFormAction, sendTestWebhookFormAction, createApiKeyAction, revokeApiKeyFormAction, updateConsentTypesFormAction, updateAllowDeveloperSetupForCurrentTenantFormAction, inviteEndUserAction, deactivateEndUserFormAction, sendEndUserPasswordResetFormAction } from "../actions";
import { SettingsSectionCards } from "./SettingsSectionCards";

export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe_connect?: string; success?: string }>;
}) {
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) redirect("/login");

  const params = await searchParams;
  if (params.stripe_connect === "return" || params.stripe_connect === "refresh") {
    const { setConnectOnboardingComplete } = await import("@/lib/stripe-connect");
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const config = tenant ? getTenantConnectConfig(tenant) : null;
    if (config?.accountId) {
      try {
        const Stripe = (await import("stripe")).default;
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
        const account = await stripe.accounts.retrieve(config.accountId);
        const complete = account.charges_enabled === true;
        await setConnectOnboardingComplete(tenantId, complete);
      } catch {
        await setConnectOnboardingComplete(tenantId, false);
      }
    }
    redirect("/dashboard/settings");
  }

  const userId = (await headers()).get("x-user-id");
  const [tenant, user, hasDeveloperPermission, modules] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, settings: true, slug: true },
    }),
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { email: true } }) : null,
    userId ? hasPermission(userId, PERMISSIONS.settingsDeveloper) : false,
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
  const currentFooterHtml = (site.footerHtml as string) ?? "";
  const currentShowCookieBanner = (site.showCookieBanner as boolean) === true;
  const currentCookiePolicyUrl = (site.cookiePolicyUrl as string) ?? "";
  const currentMetaTitle = (site.metaTitle as string) ?? "";
  const currentMetaDescription = (site.metaDescription as string) ?? "";
  const currentOgImage = (site.ogImage as string) ?? "";
  const currentCanonicalBaseUrl = (site.canonicalBaseUrl as string) ?? "";
  const currentCustomDomain = (site.customDomain as string) ?? "";
  const currentFaviconUrl = (site.faviconUrl as string) ?? "";
  const waitlistRaw = site.waitlist as { moduleSlug: string; eventFieldSlug: string; emailFieldSlug: string; quantityFieldSlug: string } | undefined;
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

  const stripeConnectConfig = tenant ? getTenantConnectConfig(tenant) : null;
  const currentWebhookUrl = (settingsObj.webhookUrl as string) ?? "";
  const currentWebhookSecret = (settingsObj.webhookSecret as string) ?? "";
  const currentWebhookDeliveries = await prisma.webhookDelivery.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, event: true, url: true, success: true, statusCode: true, errorMessage: true, createdAt: true },
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
  const featureFlags = getFeatureFlags(tenant?.settings ?? null);
  const apiKeys = await listApiKeys(tenantId);
  const customerLogin = getCustomerLoginSettings(tenant?.settings ?? null);
  const endUsers = await prisma.tenantEndUser.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true, createdAt: true, inviteToken: true },
  });
  const currentConsentTypes = getConsentTypes(tenant?.settings as Record<string, unknown> ?? null);
  const allowDeveloperSetup = getAllowDeveloperSetup(tenant?.settings ?? null);
  const showDeveloperSections = allowDeveloperSetup && hasDeveloperPermission;
  const platformAdmin = isPlatformAdmin(user?.email ?? null);

  return (
    <div>
      <Suspense fallback={null}>
        <SuccessBanner successKey={params.success} />
      </Suspense>
      <div className="page-header">
        <h1>Dashboard settings</h1>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>
      <p className="settings-intro">Click a section to open its settings.</p>
      <SettingsSectionCards
        tenantId={tenantId}
        tenantSlug={tenant?.slug ?? null}
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
        connectStripeAction={connectStripeFormAction}
        currentWebhookUrl={currentWebhookUrl}
        currentWebhookSecret={currentWebhookSecret}
        currentWebhookDeliveries={currentWebhookDeliveries}
        sendTestWebhookAction={sendTestWebhookFormAction}
        currentNotificationEmail={currentNotificationEmail}
        emailNotificationFlags={emailNotificationFlags}
        currentEmailFromAddress={currentEmailFromAddress}
        currentEmailFromName={currentEmailFromName}
        currentEmailReplyTo={currentEmailReplyTo}
        currentLocale={currentLocale}
        featureFlags={featureFlags}
        apiKeys={apiKeys}
        createApiKeyAction={createApiKeyAction.bind(null, tenantId)}
        revokeApiKeyAction={revokeApiKeyFormAction.bind(null, tenantId)}
        customerLoginEnabled={customerLogin.enabled}
        customerLoginAllowSelfSignup={customerLogin.allowSelfSignup}
        endUsers={endUsers}
        inviteEndUserAction={(prev, formData) => inviteEndUserAction(tenantId, prev, formData)}
        deactivateEndUserFormAction={(formData) => deactivateEndUserFormAction(tenantId, formData)}
        sendEndUserPasswordResetFormAction={(formData) => sendEndUserPasswordResetFormAction(tenantId, formData)}
        currentConsentTypes={currentConsentTypes}
        updateConsentTypesFormAction={updateConsentTypesFormAction}
        showDeveloperSections={showDeveloperSections}
        isPlatformAdmin={platformAdmin}
        allowDeveloperSetup={allowDeveloperSetup}
        updateAllowDeveloperSetupFormAction={updateAllowDeveloperSetupForCurrentTenantFormAction}
      />
    </div>
  );
}
