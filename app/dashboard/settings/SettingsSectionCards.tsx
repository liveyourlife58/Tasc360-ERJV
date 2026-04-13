"use client";

import { useState } from "react";
import { useActionState } from "react";
import { DeveloperSetupToggle } from "./DeveloperSetupToggle";
import { GenerateSiteAiForm } from "./GenerateSiteAiForm";
import { BlobUploadInput } from "@/components/dashboard/BlobUploadInput";
import { DashboardModulesHubPanel } from "@/components/dashboard/DashboardModulesHubPanel";
import { TENANT_TIME_ZONE_PRESETS } from "@/lib/tenant-timezone";
import {
  DASHBOARD_FEATURE_KEYS,
  getDashboardFeatures,
  type DashboardFeatureKey,
  type DashboardFeatures,
} from "@/lib/dashboard-features";
import {
  SETTINGS_HUB_GROUPS,
  getSectionMeta,
  type SettingsHubSectionId,
} from "@/lib/dashboard-settings-sections";

type Branding = { name?: string; logo?: string; primaryColor?: string };
type Home =
  | { type: "module"; moduleSlug: string }
  | { type: "view"; moduleSlug: string; viewId: string }
  | undefined;

type SectionId = SettingsHubSectionId | "platform-dashboard-features";

const SECTION_TITLES: Record<SectionId, string> = {
  "customer-ai": "Homepage Text",
  "customer-contact": "Contact",
  "customer-hero": "Homepage hero image",
  "customer-sidebar": "Homepage right column",
  "customer-modules": "Public modules",
  "customer-seo": "SEO",
  "customer-waitlist": "Waitlist",
  "customer-footer": "Footer",
  "customer-cookie-banner": "Cookie banner",
  "backend-branding": "Branding",
  "backend-home": "Default home",
  "backend-modules-hub": "Modules & data",
  "backend-payments": "Payments (Stripe)",
  "backend-api": "API access",
  "backend-customer-logins": "End-user accounts",
  "backend-features": "Feature flags",
  "backend-webhooks": "Webhooks",
  "backend-locale": "Locale & format",
  "email-notifications": "Email notifications",
  "consent-types": "Consent types",
  "platform-dashboard-features": "Dashboard features",
};

/** Renders hidden inputs for platform admin (e.g. targetTenantId). Safe to pass undefined. */
function FormExtraFields({ fields }: { fields?: Record<string, string> }) {
  if (!fields || Object.keys(fields).length === 0) return null;
  return (
    <>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

type Props = {
  tenantId: string;
  tenantSlug?: string | null;
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  /** When set (e.g. platform admin editing another tenant), these are added to every form so the action receives them. */
  extraFormFields?: Record<string, string>;
  branding?: Branding;
  home?: Home;
  sidebarOrder?: string[];
  publicModules?: Record<string, { slug: string; showInNav?: boolean }>;
  modulePaymentTypes?: Record<string, "payment" | "donation" | null>;
  modules: { id: string; name: string; slug: string; fields: { id: string; slug: string; name: string }[] }[];
  viewsByModule: Record<string, { id: string; name: string }[]>;
  currentSiteName: string;
  currentTagline: string;
  currentHeroImage?: string;
  currentFooterHtml?: string;
  currentShowCookieBanner?: boolean;
  currentCookiePolicyUrl?: string;
  homepageSidebarModule?: string;
  homepageSidebarFieldSlugs?: string[];
  currentHomeContent: string;
  contactFields?: {
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    extraContent?: string;
  };
  currentMetaTitle?: string;
  currentMetaDescription?: string;
  currentOgImage?: string;
  currentCanonicalBaseUrl?: string;
  currentCustomDomain?: string;
  currentFaviconUrl?: string;
  currentWaitlist?: { moduleSlug: string; eventFieldSlug: string; emailFieldSlug: string; quantityFieldSlug: string } | null;
  stripeConnectConfig?: { accountId: string; onboardingComplete: boolean } | null;
  connectStripeAction?: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  currentWebhookUrl?: string;
  currentWebhookSecret?: string;
  currentWebhookDeliveries?: { id: string; event: string; url: string; success: boolean; statusCode: number | null; errorMessage: string | null; createdAt: Date }[];
  sendTestWebhookAction?: (prev: unknown, formData: FormData) => Promise<{ success: boolean; statusCode?: number; error?: string }>;
  currentNotificationEmail?: string;
  emailNotificationFlags?: { approvalRequested?: boolean; paymentReceived?: boolean; paymentFailed?: boolean; webhookFailed?: boolean };
  currentEmailFromAddress?: string;
  currentEmailFromName?: string;
  currentEmailReplyTo?: string;
  currentLocale?: string;
  /** Tenant IANA timezone for dates / deadlines (default UTC). */
  currentTimeZone?: string;
  featureFlags?: { myOrders: boolean; refunds: boolean };
  apiKeys?: { id: string; name: string; keyPrefix: string; lastUsedAt: Date | null; createdAt: Date }[];
  createApiKeyAction?: (prev: unknown, formData: FormData) => Promise<{ key?: string; error?: string }>;
  revokeApiKeyAction?: (formData: FormData) => Promise<void>;
  customerLoginEnabled?: boolean;
  customerLoginAllowSelfSignup?: boolean;
  endUsers?: { id: string; email: string; name: string | null; isActive: boolean; lastLoginAt: Date | null; createdAt: Date; inviteToken: string | null }[];
  inviteEndUserAction?: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  deactivateEndUserFormAction?: (formData: FormData) => Promise<void>;
  sendEndUserPasswordResetFormAction?: (formData: FormData) => Promise<void>;
  currentConsentTypes?: string[];
  updateConsentTypesFormAction?: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  showDeveloperSections?: boolean;
  isPlatformAdmin?: boolean;
  allowDeveloperSetup?: boolean;
  updateAllowDeveloperSetupFormAction?: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  /** Platform admin only: enable/disable dashboard areas for this tenant. */
  dashboardFeatures?: DashboardFeatures;
  /** Same order as dashboard home / sidebar (templates, AI, import/export, shortcuts). */
  hubOrderedModules: { id: string; name: string; slug: string }[];
};

export function SettingsSectionCards(props: Props) {
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const {
    tenantId,
    updateAction,
    branding,
    home,
    sidebarOrder,
    publicModules = {},
    modulePaymentTypes = {},
    modules,
    viewsByModule,
    currentSiteName,
    currentTagline,
    currentHeroImage = "",
    homepageSidebarModule = "",
    homepageSidebarFieldSlugs = [],
    currentHomeContent,
    contactFields = {},
    currentMetaTitle = "",
    currentMetaDescription = "",
    currentOgImage = "",
    currentCanonicalBaseUrl = "",
    currentCustomDomain = "",
    currentFaviconUrl = "",
    currentWaitlist = null,
    stripeConnectConfig = null,
    connectStripeAction,
    currentWebhookUrl = "",
    currentWebhookSecret = "",
    currentWebhookDeliveries = [],
    sendTestWebhookAction,
    currentNotificationEmail = "",
    emailNotificationFlags = {},
    currentEmailFromAddress = "",
    currentEmailFromName = "",
    currentEmailReplyTo = "",
    currentLocale = "",
    currentTimeZone = "UTC",
  } = props;

  const homeModuleSlug = home?.type ? home.moduleSlug : "";
  const homeViewId = home?.type === "view" ? home.viewId : "";

  /** Stored tenant flags — used as-is for the “Dashboard features” form checkboxes. */
  const rawDashboardFeatures = props.dashboardFeatures ?? getDashboardFeatures(null);
  /** Hub card visibility: platform admins always see Settings-backed cards regardless of tenant flag. */
  const df =
    props.isPlatformAdmin === true ? { ...rawDashboardFeatures, settings: true } : rawDashboardFeatures;
  const showDeveloperSections = props.showDeveloperSections ?? false;
  const extraFormFields = props.extraFormFields;

  const sectionVisible = (id: SettingsHubSectionId): boolean => {
    const meta = getSectionMeta(id);
    if (!meta) return false;
    if (meta.developerOnly && !showDeveloperSections) return false;
    return df[meta.feature];
  };

  return (
    <>
      {SETTINGS_HUB_GROUPS.map((group) => {
        const visibleIds = group.ids.filter((id) => sectionVisible(id));
        const isWorkspace = group.title === "Workspace";
        const showDeveloperToggle =
          isWorkspace && props.isPlatformAdmin && props.updateAllowDeveloperSetupFormAction;
        if (visibleIds.length === 0 && !showDeveloperToggle) return null;
        return (
          <div key={group.title} className="settings-cards-group">
            <h2 className="settings-cards-group-title">{group.title}</h2>
            {showDeveloperToggle && props.updateAllowDeveloperSetupFormAction && (
              <DeveloperSetupToggle
                allowDeveloperSetup={props.allowDeveloperSetup ?? false}
                formAction={props.updateAllowDeveloperSetupFormAction}
                extraFormFields={extraFormFields}
              />
            )}
            {visibleIds.length > 0 ? (
              <div className="settings-cards settings-subcards">
                {visibleIds.map((id) => {
                  const meta = getSectionMeta(id)!;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="settings-card settings-subcard"
                      onClick={() => setOpenSection(id)}
                    >
                      <h3 className="settings-card-title">{meta.title}</h3>
                      <p className="settings-card-desc">{meta.desc}</p>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      {props.isPlatformAdmin && (
        <div className="settings-cards-group">
          <h2 className="settings-cards-group-title">Platform: tenant dashboard</h2>
          <p className="settings-cards-group-desc" style={{ marginBottom: "0.75rem" }}>
            Enable or disable areas of the dashboard for this tenant. Only platform admins see this section.
          </p>
          <div className="settings-cards settings-subcards">
            <button
              type="button"
              className="settings-card settings-subcard"
              onClick={() => setOpenSection("platform-dashboard-features")}
            >
              <h3 className="settings-card-title">Dashboard features</h3>
              <p className="settings-card-desc">
                Show or hide workspace areas (sidebar, home summaries, deadline list, settings sections, and public site) for this tenant.
              </p>
            </button>
          </div>
        </div>
      )}

      {openSection && (
        <SettingsModal
          title={SECTION_TITLES[openSection]}
          onClose={() => setOpenSection(null)}
          size="wide"
        >
          <SectionModalContent
            sectionId={openSection}
            onClose={() => setOpenSection(null)}
            tenantId={tenantId}
            tenantSlug={props.tenantSlug}
            updateAction={updateAction}
            extraFormFields={extraFormFields}
            branding={branding}
            home={home}
            homeModuleSlug={homeModuleSlug}
            homeViewId={homeViewId}
            sidebarOrder={sidebarOrder}
            modules={modules}
            viewsByModule={viewsByModule}
            publicModules={publicModules}
            modulePaymentTypes={modulePaymentTypes}
            currentHeroImage={currentHeroImage}
            currentFooterHtml={props.currentFooterHtml ?? ""}
            currentShowCookieBanner={props.currentShowCookieBanner}
            currentCookiePolicyUrl={props.currentCookiePolicyUrl}
            homepageSidebarModule={homepageSidebarModule}
            homepageSidebarFieldSlugs={homepageSidebarFieldSlugs}
            currentSiteName={currentSiteName}
            currentTagline={currentTagline}
            currentHomeContent={currentHomeContent}
            contactFields={contactFields}
            currentMetaTitle={currentMetaTitle}
            currentMetaDescription={currentMetaDescription}
            currentOgImage={currentOgImage}
            currentCanonicalBaseUrl={currentCanonicalBaseUrl}
            currentCustomDomain={currentCustomDomain}
            currentFaviconUrl={currentFaviconUrl}
            stripeConnectConfig={stripeConnectConfig}
            connectStripeAction={connectStripeAction}
    currentWebhookUrl={currentWebhookUrl}
    currentWebhookSecret={currentWebhookSecret}
    currentWebhookDeliveries={currentWebhookDeliveries}
    sendTestWebhookAction={sendTestWebhookAction}
    currentNotificationEmail={currentNotificationEmail}
    emailNotificationFlags={emailNotificationFlags}
    currentEmailFromAddress={currentEmailFromAddress}
    currentEmailFromName={currentEmailFromName}
    currentEmailReplyTo={currentEmailReplyTo}
    currentLocale={currentLocale}
    currentTimeZone={currentTimeZone}
    featureFlags={props.featureFlags}
    apiKeys={props.apiKeys}
    createApiKeyAction={props.createApiKeyAction}
    revokeApiKeyAction={props.revokeApiKeyAction}
    customerLoginEnabled={props.customerLoginEnabled}
    customerLoginAllowSelfSignup={props.customerLoginAllowSelfSignup}
    endUsers={props.endUsers}
    inviteEndUserAction={props.inviteEndUserAction}
    deactivateEndUserFormAction={props.deactivateEndUserFormAction}
    sendEndUserPasswordResetFormAction={props.sendEndUserPasswordResetFormAction}
            currentConsentTypes={props.currentConsentTypes}
            updateConsentTypesFormAction={props.updateConsentTypesFormAction}
            dashboardFeatures={props.dashboardFeatures}
            hubOrderedModules={props.hubOrderedModules}
          />
        </SettingsModal>
      )}
    </>
  );
}

function SettingsModal({
  title,
  onClose,
  children,
  size = "default",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "default" | "wide";
}) {
  return (
    <div
      className="settings-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={"settings-modal" + (size === "wide" ? " settings-modal--wide" : "")}>
        <div className="settings-modal-header">
          <h2 className="settings-modal-title">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="settings-modal-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="settings-modal-content">{children}</div>
      </div>
    </div>
  );
}

function SectionModalContent(
  props: {
    sectionId: SectionId;
    onClose: () => void;
    tenantId: string;
    tenantSlug?: string | null;
    updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
    extraFormFields?: Record<string, string>;
    branding?: Branding;
    home?: Home;
    homeModuleSlug: string;
    homeViewId: string;
    sidebarOrder?: string[];
    modules: { id: string; name: string; slug: string; fields?: { id: string; slug: string; name: string }[] }[];
    viewsByModule: Record<string, { id: string; name: string }[]>;
    publicModules: Record<string, { slug: string; showInNav?: boolean }>;
    modulePaymentTypes: Record<string, "payment" | "donation" | null>;
    currentHeroImage: string;
    currentFooterHtml: string;
    currentShowCookieBanner?: boolean;
    currentCookiePolicyUrl?: string;
    homepageSidebarModule: string;
    homepageSidebarFieldSlugs: string[];
    currentSiteName: string;
    currentTagline: string;
    currentHomeContent: string;
    contactFields: { email?: string; phone?: string; addressLine1?: string; addressLine2?: string; city?: string; state?: string; postalCode?: string; country?: string; extraContent?: string };
    currentMetaTitle: string;
    currentMetaDescription: string;
    currentOgImage: string;
    currentCanonicalBaseUrl: string;
    currentCustomDomain?: string;
    currentFaviconUrl?: string;
    stripeConnectConfig?: { accountId: string; onboardingComplete: boolean } | null;
    connectStripeAction?: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
    currentWebhookUrl?: string;
    currentWebhookSecret?: string;
    currentWebhookDeliveries?: { id: string; event: string; url: string; success: boolean; statusCode: number | null; errorMessage: string | null; createdAt: Date }[];
    sendTestWebhookAction?: (prev: unknown, formData: FormData) => Promise<{ success: boolean; statusCode?: number; error?: string }>;
    currentNotificationEmail?: string;
    emailNotificationFlags?: { approvalRequested?: boolean; paymentReceived?: boolean; paymentFailed?: boolean; webhookFailed?: boolean };
    currentEmailFromAddress?: string;
    currentEmailFromName?: string;
    currentEmailReplyTo?: string;
    currentLocale?: string;
    currentTimeZone?: string;
    featureFlags?: { myOrders: boolean; refunds: boolean };
    apiKeys?: { id: string; name: string; keyPrefix: string; lastUsedAt: Date | null; createdAt: Date }[];
    createApiKeyAction?: (prev: unknown, formData: FormData) => Promise<{ key?: string; error?: string }>;
    revokeApiKeyAction?: (formData: FormData) => Promise<void>;
    customerLoginEnabled?: boolean;
    customerLoginAllowSelfSignup?: boolean;
    endUsers?: { id: string; email: string; name: string | null; isActive: boolean; lastLoginAt: Date | null; createdAt: Date; inviteToken: string | null }[];
    inviteEndUserAction?: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
    deactivateEndUserFormAction?: (formData: FormData) => Promise<void>;
    sendEndUserPasswordResetFormAction?: (formData: FormData) => Promise<void>;
    currentConsentTypes?: string[];
    updateConsentTypesFormAction?: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
    dashboardFeatures?: DashboardFeatures;
    hubOrderedModules: { id: string; name: string; slug: string }[];
  }
) {
  const { sectionId } = props;
  if (sectionId === "platform-dashboard-features") {
    const features = props.dashboardFeatures ?? getDashboardFeatures(null);
    return (
      <PlatformDashboardFeaturesForm
        key={`dashboard-features-${JSON.stringify(features)}`}
        updateAction={props.updateAction}
        extraFormFields={props.extraFormFields}
        dashboardFeatures={features}
      />
    );
  }
  if (sectionId === "customer-ai") {
    return (
      <div className="settings-modal-body">
        <GenerateSiteAiForm
          tenantId={props.tenantId}
          updateAction={props.updateAction}
          extraFormFields={props.extraFormFields}
          currentSiteName={props.currentSiteName}
          currentTagline={props.currentTagline}
          currentHomeContent={props.currentHomeContent}
          publicModules={props.publicModules}
          modulePaymentTypes={props.modulePaymentTypes}
          modules={props.modules}
          currentHeroImage={props.currentHeroImage}
          homepageSidebarModule={props.homepageSidebarModule}
          homepageSidebarFieldSlugs={props.homepageSidebarFieldSlugs}
        />
      </div>
    );
  }
  if (sectionId === "customer-contact") {
    return <CustomerContactForm {...props} />;
  }
  if (sectionId === "customer-hero") {
    return <CustomerHeroForm {...props} />;
  }
  if (sectionId === "customer-sidebar") {
    return <CustomerSidebarForm {...props} />;
  }
  if (sectionId === "customer-modules") {
    return <CustomerModulesForm {...props} />;
  }
  if (sectionId === "customer-seo") {
    return <CustomerSeoForm {...props} />;
  }
  if (sectionId === "customer-waitlist") {
    return <CustomerWaitlistForm {...props} />;
  }
  if (sectionId === "customer-footer") {
    return (
      <CustomerFooterForm
        updateAction={props.updateAction}
        extraFormFields={props.extraFormFields}
        currentFooterHtml={props.currentFooterHtml ?? ""}
      />
    );
  }
  if (sectionId === "customer-cookie-banner") {
    return (
      <CustomerCookieBannerForm
        updateAction={props.updateAction}
        currentShowCookieBanner={props.currentShowCookieBanner ?? false}
        currentCookiePolicyUrl={props.currentCookiePolicyUrl ?? ""}
      />
    );
  }
  if (sectionId === "backend-branding") {
    return <BackendBrandingForm {...props} />;
  }
  if (sectionId === "backend-home") {
    return <BackendHomeForm {...props} />;
  }
  if (sectionId === "backend-modules-hub") {
    return (
      <div className="settings-modal-body">
        <DashboardModulesHubPanel tenantId={props.tenantId} orderedModules={props.hubOrderedModules} />
      </div>
    );
  }
  if (sectionId === "backend-payments") {
    return <BackendPaymentsForm stripeConnectConfig={props.stripeConnectConfig} connectStripeAction={props.connectStripeAction} />;
  }
  if (sectionId === "backend-api") {
    return (
      <BackendApiForm
        {...props}
        extraFormFields={props.extraFormFields}
        apiKeys={props.apiKeys ?? []}
        createApiKeyAction={props.createApiKeyAction}
        revokeApiKeyAction={props.revokeApiKeyAction}
        tenantSlug={props.tenantSlug}
        tenantId={props.tenantId}
      />
    );
  }
  if (sectionId === "backend-customer-logins") {
    return (
      <BackendCustomerLoginsForm
        updateAction={props.updateAction}
        extraFormFields={props.extraFormFields}
        customerLoginEnabled={props.customerLoginEnabled ?? false}
        customerLoginAllowSelfSignup={props.customerLoginAllowSelfSignup ?? false}
        endUsers={props.endUsers ?? []}
        inviteEndUserAction={props.inviteEndUserAction}
        deactivateEndUserFormAction={props.deactivateEndUserFormAction}
        sendEndUserPasswordResetFormAction={props.sendEndUserPasswordResetFormAction}
      />
    );
  }
  if (sectionId === "backend-features") {
    return (
      <BackendFeaturesForm
        updateAction={props.updateAction}
        extraFormFields={props.extraFormFields}
        myOrders={props.featureFlags?.myOrders ?? true}
        refunds={props.featureFlags?.refunds ?? true}
      />
    );
  }
  if (sectionId === "backend-webhooks") {
    return (
      <BackendWebhooksForm
        updateAction={props.updateAction}
        extraFormFields={props.extraFormFields}
        currentWebhookUrl={props.currentWebhookUrl ?? ""}
        currentWebhookSecret={props.currentWebhookSecret ?? ""}
        currentWebhookDeliveries={props.currentWebhookDeliveries ?? []}
        sendTestWebhookAction={props.sendTestWebhookAction}
      />
    );
  }
  if (sectionId === "backend-locale") {
    return (
      <BackendLocaleForm
        updateAction={props.updateAction}
        extraFormFields={props.extraFormFields}
        currentLocale={props.currentLocale ?? ""}
        currentTimeZone={props.currentTimeZone ?? "UTC"}
      />
    );
  }
  if (sectionId === "email-notifications") {
    return (
      <EmailNotificationsForm
        updateAction={props.updateAction}
        extraFormFields={props.extraFormFields}
        currentNotificationEmail={props.currentNotificationEmail ?? ""}
        approvalRequested={props.emailNotificationFlags?.approvalRequested ?? false}
        paymentReceived={props.emailNotificationFlags?.paymentReceived ?? false}
        paymentFailed={props.emailNotificationFlags?.paymentFailed ?? false}
        webhookFailed={props.emailNotificationFlags?.webhookFailed ?? false}
        currentEmailFromAddress={props.currentEmailFromAddress ?? ""}
        currentEmailFromName={props.currentEmailFromName ?? ""}
        currentEmailReplyTo={props.currentEmailReplyTo ?? ""}
      />
    );
  }
  if (sectionId === "consent-types") {
    return (
      <ConsentTypesForm
        updateConsentTypesFormAction={props.updateConsentTypesFormAction!}
        extraFormFields={props.extraFormFields}
        currentConsentTypes={props.currentConsentTypes ?? []}
      />
    );
  }
  return null;
}

const DASHBOARD_FEATURE_LABELS: Record<DashboardFeatureKey, string> = {
  help: "Help",
  workspaceHome: "Workspace home (/dashboard summary)",
  approvals: "Approvals",
  activity: "Activity",
  consent: "Consent",
  finance: "Finance",
  integrations: "Integrations",
  teamBilling: "Team & billing (plan, team, roles)",
  settings: "Settings",
  customerSite: "Customer site (public at /s/your-slug)",
};

function PlatformDashboardFeaturesForm({
  updateAction,
  extraFormFields,
  dashboardFeatures,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  dashboardFeatures: DashboardFeatures;
}) {
  const [state, formAction] = useActionState(updateAction, null);
  return (
    <div className="settings-modal-body">
      <p className="settings-hint" style={{ marginBottom: "1rem" }}>
        When disabled, the corresponding dashboard item is hidden or the route is inaccessible. Disabling{" "}
        <strong>Workspace home</strong> sends users to their default module (or first module) instead of the summary page at{" "}
        <code>/dashboard</code>. Disabling <strong>Customer site</strong> turns off the public site at <code>/s/[slug]</code>{" "}
        (cart, public modules, contact).
      </p>
      <form action={formAction} className="settings-form">
        <FormExtraFields fields={extraFormFields} />
        <input type="hidden" name="settingsSection" value="dashboard-features" />
        <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {DASHBOARD_FEATURE_KEYS.map((key) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                name={`featureDashboard${key.charAt(0).toUpperCase()}${key.slice(1)}`}
                value="1"
                defaultChecked={dashboardFeatures[key]}
                key={`${key}-${dashboardFeatures[key]}`}
              />
              <span>{DASHBOARD_FEATURE_LABELS[key]}</span>
            </label>
          ))}
        </div>
        {state && typeof state === "object" && "error" in state ? (
          <p className="view-error" role="alert">{String((state as { error: string }).error)}</p>
        ) : null}
        <button type="submit" className="btn btn-primary">Save</button>
      </form>
    </div>
  );
}

function CustomerContactForm({
  updateAction,
  extraFormFields,
  publicModules,
  modulePaymentTypes,
  modules,
  currentHeroImage,
  homepageSidebarModule,
  homepageSidebarFieldSlugs,
  contactFields,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  publicModules: Record<string, { slug: string; showInNav?: boolean }>;
  modulePaymentTypes: Record<string, "payment" | "donation" | null>;
  modules: { id: string; name: string; slug: string }[];
  currentHeroImage: string;
  homepageSidebarModule: string;
  homepageSidebarFieldSlugs: string[];
  contactFields: { email?: string; phone?: string; addressLine1?: string; addressLine2?: string; city?: string; state?: string; postalCode?: string; country?: string; extraContent?: string };
}) {
  const [state, formAction] = useActionState(updateAction, null);
  const c = contactFields;
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="customer" />
      <CustomerHiddenInputs
        publicModules={publicModules}
        modulePaymentTypes={modulePaymentTypes}
        modules={modules}
        siteHeroImage={currentHeroImage}
        homepageSidebarModule={homepageSidebarModule}
        homepageSidebarFieldSlugs={homepageSidebarFieldSlugs}
        exclude="pages"
      />
      <div className="settings-single-section">
        <p className="settings-hint">Dedicated fields shown on your public Contact page. All optional.</p>
        <div className="form-group">
          <label htmlFor="contact-email">Email</label>
          <input id="contact-email" name="contactEmail" type="email" defaultValue={c.email ?? ""} placeholder="contact@example.com" className="form-control" />
        </div>
        <div className="form-group">
          <label htmlFor="contact-phone">Phone</label>
          <input id="contact-phone" name="contactPhone" type="tel" defaultValue={c.phone ?? ""} placeholder="+1 (555) 000-0000" className="form-control" />
        </div>
        <div className="form-group">
          <label htmlFor="contact-address-line1">Address line 1</label>
          <input id="contact-address-line1" name="contactAddressLine1" type="text" defaultValue={c.addressLine1 ?? ""} placeholder="Street address" className="form-control" />
        </div>
        <div className="form-group">
          <label htmlFor="contact-address-line2">Address line 2</label>
          <input id="contact-address-line2" name="contactAddressLine2" type="text" defaultValue={c.addressLine2 ?? ""} placeholder="Suite, unit, etc." className="form-control" />
        </div>
        <div className="form-row" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: "1 1 8rem" }}>
            <label htmlFor="contact-city">City</label>
            <input id="contact-city" name="contactCity" type="text" defaultValue={c.city ?? ""} placeholder="City" className="form-control" />
          </div>
          <div className="form-group" style={{ flex: "0 1 6rem" }}>
            <label htmlFor="contact-state">State / Province</label>
            <input id="contact-state" name="contactState" type="text" defaultValue={c.state ?? ""} placeholder="State" className="form-control" />
          </div>
          <div className="form-group" style={{ flex: "0 1 6rem" }}>
            <label htmlFor="contact-postal">Postal code</label>
            <input id="contact-postal" name="contactPostalCode" type="text" defaultValue={c.postalCode ?? ""} placeholder="ZIP / Postal" className="form-control" />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="contact-country">Country</label>
          <input id="contact-country" name="contactCountry" type="text" defaultValue={c.country ?? ""} placeholder="Country" className="form-control" />
        </div>
        <div className="form-group">
          <label htmlFor="contact-extra">Additional content (optional HTML)</label>
          <textarea id="contact-extra" name="contactExtraContent" rows={4} defaultValue={c.extraContent ?? ""} placeholder="Extra text or HTML below the contact details" className="form-control" />
        </div>
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function CustomerHeroForm({
  tenantId,
  updateAction,
  extraFormFields,
  publicModules,
  modulePaymentTypes,
  modules,
  currentHeroImage,
  homepageSidebarModule,
  homepageSidebarFieldSlugs,
}: {
  tenantId: string;
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  publicModules: Record<string, { slug: string; showInNav?: boolean }>;
  modulePaymentTypes: Record<string, "payment" | "donation" | null>;
  modules: { id: string; name: string; slug: string }[];
  currentHeroImage: string;
  homepageSidebarModule: string;
  homepageSidebarFieldSlugs: string[];
}) {
  const [state, formAction] = useActionState(updateAction, null);
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="customer" />
      <CustomerHiddenInputs
        publicModules={publicModules}
        modulePaymentTypes={modulePaymentTypes}
        modules={modules}
        siteHeroImage={currentHeroImage}
        homepageSidebarModule={homepageSidebarModule}
        homepageSidebarFieldSlugs={homepageSidebarFieldSlugs}
        exclude="hero"
      />
      <div className="settings-single-section">
        <p className="settings-hint">Optional image shown at the top of your public site homepage. Use a URL to an image (e.g. from your own hosting or a CDN).</p>
        <BlobUploadInput
          name="siteHeroImage"
          id="site-hero-image"
          label="Hero image URL"
          defaultValue={currentHeroImage}
          placeholder="https://... or upload below"
        />
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function CustomerSidebarForm({
  tenantId,
  updateAction,
  extraFormFields,
  publicModules,
  modulePaymentTypes,
  modules,
  currentHeroImage,
  homepageSidebarModule,
  homepageSidebarFieldSlugs,
}: {
  tenantId: string;
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  publicModules: Record<string, { slug: string; showInNav?: boolean }>;
  modulePaymentTypes: Record<string, "payment" | "donation" | null>;
  modules: { id: string; name: string; slug: string; fields?: { id: string; slug: string; name: string }[] }[];
  currentHeroImage: string;
  homepageSidebarModule: string;
  homepageSidebarFieldSlugs: string[];
}) {
  const [state, formAction] = useActionState(updateAction, null);
  const publicModuleList = modules.filter((m) => publicModules[m.slug]);
  const sidebarModule = homepageSidebarModule ? modules.find((m) => m.slug === homepageSidebarModule) : null;
  const sidebarFields = sidebarModule?.fields ?? [];
  const selectedFieldSlugs = new Set(homepageSidebarFieldSlugs ?? []);
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="customer" />
      <CustomerHiddenInputs
        publicModules={publicModules}
        modulePaymentTypes={modulePaymentTypes}
        modules={modules}
        siteHeroImage={currentHeroImage}
        homepageSidebarModule={homepageSidebarModule}
        homepageSidebarFieldSlugs={homepageSidebarFieldSlugs}
        exclude="sidebar"
      />
      <div className="settings-single-section">
        <p className="settings-hint">Optionally show an entity list in a sidebar to the right of the homepage content.</p>
        <div className="form-group">
          <label htmlFor="homepage-sidebar-module">Show entity list</label>
          <select id="homepage-sidebar-module" name="homepageSidebarModule" defaultValue={homepageSidebarModule}>
            <option value="">None</option>
            {publicModuleList.map((m) => <option key={m.id} value={m.slug}>{m.name}</option>)}
          </select>
        </div>
        {sidebarFields.length > 0 && (
          <div className="form-group" style={{ marginTop: "0.75rem" }}>
            <span className="settings-field-label">Fields to show in sidebar</span>
            <div className="settings-sidebar-fields">
              {sidebarFields.map((f) => (
                <label key={f.id} className="settings-check-label">
                  <input type="checkbox" name="homepageSidebarFieldSlugs" value={f.slug} defaultChecked={selectedFieldSlugs.has(f.slug)} />
                  {f.name}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function CustomerModulesForm({
  tenantId,
  updateAction,
  publicModules,
  modulePaymentTypes,
  modules,
  currentHeroImage,
  homepageSidebarModule,
  homepageSidebarFieldSlugs,
}: {
  tenantId: string;
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  publicModules: Record<string, { slug: string; showInNav?: boolean }>;
  modulePaymentTypes: Record<string, "payment" | "donation" | null>;
  modules: { id: string; name: string; slug: string }[];
  currentHeroImage: string;
  homepageSidebarModule: string;
  homepageSidebarFieldSlugs: string[];
}) {
  const [state, formAction] = useActionState(updateAction, null);
  return (
    <form action={formAction} className="settings-form">
      <input type="hidden" name="settingsSection" value="customer" />
      <CustomerHiddenInputs
        publicModules={publicModules}
        modulePaymentTypes={modulePaymentTypes}
        modules={modules}
        siteHeroImage={currentHeroImage}
        homepageSidebarModule={homepageSidebarModule}
        homepageSidebarFieldSlugs={homepageSidebarFieldSlugs}
        exclude="modules"
      />
      <div className="settings-single-section">
        <p className="settings-hint">Show these modules on your public site at /s/your-slug/[url-slug]. Set payment type where applicable.</p>
        {modules.map((m) => (
          <div key={m.id} className="settings-public-module">
            <label className="settings-check-label">
              <input type="checkbox" name={`publicModule_enabled_${m.slug}`} value="1" defaultChecked={!!publicModules[m.slug]} />
              <strong>{m.name}</strong>
            </label>
            <input name={`publicModule_slug_${m.slug}`} type="text" defaultValue={publicModules[m.slug]?.slug ?? m.slug} placeholder="URL slug" className="settings-public-slug" />
            <label className="settings-check-label">
              <input type="checkbox" name={`publicModule_nav_${m.slug}`} value="1" defaultChecked={publicModules[m.slug]?.showInNav !== false} />
              Show in nav
            </label>
            <select name={`publicModule_paymentType_${m.slug}`} defaultValue={modulePaymentTypes[m.slug] ?? ""} style={{ minWidth: "8rem" }}>
              <option value="">None</option>
              <option value="payment">Payment</option>
              <option value="donation">Donation</option>
            </select>
          </div>
        ))}
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function CustomerSeoForm({
  updateAction,
  extraFormFields,
  publicModules,
  modulePaymentTypes,
  modules,
  currentHeroImage,
  homepageSidebarModule,
  homepageSidebarFieldSlugs,
  currentMetaTitle,
  currentMetaDescription,
  currentOgImage,
  currentCanonicalBaseUrl,
  currentCustomDomain,
  currentFaviconUrl,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  publicModules: Record<string, { slug: string; showInNav?: boolean }>;
  modulePaymentTypes: Record<string, "payment" | "donation" | null>;
  modules: { id: string; name: string; slug: string }[];
  currentHeroImage: string;
  homepageSidebarModule: string;
  homepageSidebarFieldSlugs: string[];
  currentMetaTitle: string;
  currentMetaDescription: string;
  currentOgImage: string;
  currentCanonicalBaseUrl: string;
  currentCustomDomain?: string;
  currentFaviconUrl?: string;
}) {
  const [state, formAction] = useActionState(updateAction, null);
  const customDomain = currentCustomDomain ?? "";
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="customer" />
      <CustomerHiddenInputs
        publicModules={publicModules}
        modulePaymentTypes={modulePaymentTypes}
        modules={modules}
        siteHeroImage={currentHeroImage}
        homepageSidebarModule={homepageSidebarModule}
        homepageSidebarFieldSlugs={homepageSidebarFieldSlugs}
        exclude="seo"
      />
      <div className="settings-single-section">
        <p className="settings-hint">Optional. Overrides used for search results and social sharing. Leave blank to use site name and tagline.</p>
        <div className="form-group">
          <label htmlFor="seo-faviconUrl">Favicon URL</label>
          <input id="seo-faviconUrl" name="faviconUrl" type="url" defaultValue={currentFaviconUrl ?? ""} placeholder="https://.../favicon.ico" className="form-control" />
          <span className="form-hint">Shown in browser tabs. Use a square image (e.g. 32×32 or 64×64).</span>
        </div>
        <div className="form-group">
          <label htmlFor="seo-metaTitle">Meta title</label>
          <input id="seo-metaTitle" name="metaTitle" type="text" defaultValue={currentMetaTitle} placeholder="e.g. My Site – Tagline" className="form-control" />
        </div>
        <div className="form-group">
          <label htmlFor="seo-metaDescription">Meta description</label>
          <textarea id="seo-metaDescription" name="metaDescription" rows={2} defaultValue={currentMetaDescription} placeholder="Short description for search results (e.g. 150–160 chars)" className="form-control" />
        </div>
        <div className="form-group">
          <label htmlFor="seo-ogImage">OG / social image URL</label>
          <input id="seo-ogImage" name="ogImage" type="url" defaultValue={currentOgImage} placeholder="https://..." className="form-control" />
        </div>
        <div className="form-group">
          <label htmlFor="seo-canonicalBaseUrl">Canonical base URL</label>
          <input id="seo-canonicalBaseUrl" name="canonicalBaseUrl" type="url" defaultValue={currentCanonicalBaseUrl} placeholder="https://yourdomain.com" className="form-control" />
        </div>
        <div className="form-group">
          <label htmlFor="seo-customDomain">Custom domain</label>
          <input id="seo-customDomain" name="customDomain" type="text" defaultValue={customDomain} placeholder="e.g. donate.yourorg.org" className="form-control" />
          <span className="form-hint">Point your domain&apos;s DNS to this app; visitors to this host will be shown your customer site.</span>
        </div>
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function CustomerWaitlistForm({
  updateAction,
  extraFormFields,
  modules = [],
  currentWaitlist = null,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  modules?: { id: string; name: string; slug: string; fields?: { id: string; slug: string; name: string }[] }[];
  currentWaitlist?: { moduleSlug: string; eventFieldSlug: string; emailFieldSlug: string; quantityFieldSlug: string } | null;
}) {
  const [state, formAction] = useActionState(updateAction, null);
  const wl = currentWaitlist ?? { moduleSlug: "", eventFieldSlug: "", emailFieldSlug: "", quantityFieldSlug: "" };
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="customer" />
      <p className="settings-hint" style={{ marginBottom: "1rem" }}>
        When an event or ticket type is sold out, visitors can join a waitlist. Create a module (e.g. &quot;Waitlist entries&quot;) with a relation to your events module, plus email and quantity fields. Enter the module and field slugs below.
      </p>
      <div className="form-group">
        <label htmlFor="waitlistModuleSlug">Waitlist module slug</label>
        <select id="waitlistModuleSlug" name="waitlistModuleSlug" defaultValue={wl.moduleSlug}>
          <option value="">— None —</option>
          {modules.map((m) => (
            <option key={m.id} value={m.slug}>{m.name} ({m.slug})</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="waitlistEventFieldSlug">Event / entity relation field slug</label>
        <input id="waitlistEventFieldSlug" name="waitlistEventFieldSlug" type="text" defaultValue={wl.eventFieldSlug} placeholder="e.g. event" />
      </div>
      <div className="form-group">
        <label htmlFor="waitlistEmailFieldSlug">Email field slug</label>
        <input id="waitlistEmailFieldSlug" name="waitlistEmailFieldSlug" type="text" defaultValue={wl.emailFieldSlug} placeholder="e.g. email" />
      </div>
      <div className="form-group">
        <label htmlFor="waitlistQuantityFieldSlug">Quantity field slug</label>
        <input id="waitlistQuantityFieldSlug" name="waitlistQuantityFieldSlug" type="text" defaultValue={wl.quantityFieldSlug} placeholder="e.g. quantity" />
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function CustomerFooterForm({
  updateAction,
  extraFormFields,
  currentFooterHtml,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  currentFooterHtml: string;
}) {
  const [state, formAction] = useActionState(updateAction, null);
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="customer" />
      <div className="form-group">
        <label htmlFor="footerHtml">Footer HTML (optional)</label>
        <textarea
          id="footerHtml"
          name="footerHtml"
          rows={6}
          defaultValue={currentFooterHtml}
          placeholder={'e.g. <p>© 2025 My Site. <a href="/s/your-slug/contact">Contact</a></p>'}
          className="form-control"
        />
        <span className="form-hint">Shown at the bottom of every page on your customer site. Leave blank for default &quot;© year Site name. All rights reserved.&quot; plus a Sitemap link. You can add a sitemap link in your HTML: <code>/s/your-slug/sitemap.xml</code></span>
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function CustomerCookieBannerForm({
  updateAction,
  extraFormFields,
  currentShowCookieBanner,
  currentCookiePolicyUrl,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  currentShowCookieBanner: boolean;
  currentCookiePolicyUrl: string;
}) {
  const [state, formAction] = useActionState(updateAction, null);
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="customer" />
      <input type="hidden" name="cookieBannerSection" value="1" />
      <div className="form-group">
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            name="showCookieBanner"
            value="1"
            defaultChecked={currentShowCookieBanner}
          />
          Show cookie consent banner
        </label>
        <span className="form-hint">When enabled, visitors see a banner about cookie use and can dismiss it. The choice is stored in their browser.</span>
      </div>
      <div className="form-group">
        <label htmlFor="cookiePolicyUrl">Privacy / cookie policy URL (optional)</label>
        <input
          id="cookiePolicyUrl"
          name="cookiePolicyUrl"
          type="url"
          defaultValue={currentCookiePolicyUrl}
          placeholder="https://yoursite.com/privacy"
          className="form-control"
        />
        <span className="form-hint">Link shown in the banner. Leave blank to show a link to the Contact page instead.</span>
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function CustomerHiddenInputs({
  publicModules,
  modulePaymentTypes,
  modules,
  siteHeroImage,
  homepageSidebarModule,
  homepageSidebarFieldSlugs,
  exclude,
}: {
  publicModules: Record<string, { slug: string; showInNav?: boolean }>;
  modulePaymentTypes: Record<string, "payment" | "donation" | null>;
  modules: { id: string; name: string; slug: string }[];
  siteHeroImage: string;
  homepageSidebarModule: string;
  homepageSidebarFieldSlugs: string[];
  exclude: "hero" | "sidebar" | "modules" | "seo" | "pages" | "home";
}) {
  return (
    <>
      {exclude !== "hero" && <input type="hidden" name="siteHeroImage" value={siteHeroImage} />}
      {exclude !== "sidebar" && (
        <>
          <input type="hidden" name="homepageSidebarModule" value={homepageSidebarModule} />
          {homepageSidebarFieldSlugs.map((s) => <input key={s} type="hidden" name="homepageSidebarFieldSlugs" value={s} />)}
        </>
      )}
      {exclude !== "modules" &&
        modules.map((m) => {
          const pub = publicModules[m.slug];
          if (!pub) return null;
          return (
            <span key={m.slug}>
              <input type="hidden" name={`publicModule_enabled_${m.slug}`} value="1" />
              <input type="hidden" name={`publicModule_slug_${m.slug}`} value={pub.slug} />
              {pub.showInNav !== false && <input type="hidden" name={`publicModule_nav_${m.slug}`} value="1" />}
              <input type="hidden" name={`publicModule_paymentType_${m.slug}`} value={modulePaymentTypes[m.slug] ?? ""} />
            </span>
          );
        })}
    </>
  );
}

function BackendBrandingForm({
  updateAction,
  extraFormFields,
  branding,
  home,
  homeModuleSlug,
  homeViewId,
  sidebarOrder,
  modules,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  branding?: Branding;
  home?: Home;
  homeModuleSlug: string;
  homeViewId: string;
  sidebarOrder?: string[];
  modules: { id: string; name: string; slug: string }[];
}) {
  const [state, formAction] = useActionState(updateAction, null);
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="backend" />
      <input type="hidden" name="sidebarOrder" value={JSON.stringify(sidebarOrder ?? modules.map((m) => m.slug))} />
      <input type="hidden" name="homeType" value={home?.type ?? "none"} />
      <input type="hidden" name="homeModuleSlug" value={homeModuleSlug} />
      <input type="hidden" name="homeViewId" value={homeViewId} />
      <div className="settings-single-section">
        <div className="form-group">
          <label htmlFor="modal-brandingName">Dashboard name</label>
          <input id="modal-brandingName" name="brandingName" type="text" defaultValue={branding?.name} placeholder="Shown in sidebar" />
        </div>
        <div className="form-group">
          <label htmlFor="modal-brandingLogo">Logo URL</label>
          <input id="modal-brandingLogo" name="brandingLogo" type="url" defaultValue={branding?.logo} placeholder="https://..." />
        </div>
        <div className="form-group">
          <label htmlFor="modal-brandingPrimaryColor">Primary color</label>
          <input id="modal-brandingPrimaryColor" name="brandingPrimaryColor" type="text" defaultValue={branding?.primaryColor} placeholder="#0d9488" />
        </div>
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function BackendHomeForm({
  updateAction,
  extraFormFields,
  branding,
  home,
  homeModuleSlug,
  homeViewId,
  sidebarOrder,
  modules,
  viewsByModule,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  branding?: Branding;
  home?: Home;
  homeModuleSlug: string;
  homeViewId: string;
  sidebarOrder?: string[];
  modules: { id: string; name: string; slug: string }[];
  viewsByModule: Record<string, { id: string; name: string }[]>;
}) {
  const [state, formAction] = useActionState(updateAction, null);
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="backend" />
      <input type="hidden" name="sidebarOrder" value={JSON.stringify(sidebarOrder ?? modules.map((m) => m.slug))} />
      <input type="hidden" name="brandingName" value={branding?.name ?? ""} />
      <input type="hidden" name="brandingLogo" value={branding?.logo ?? ""} />
      <input type="hidden" name="brandingPrimaryColor" value={branding?.primaryColor ?? ""} />
      <div className="settings-single-section">
        <div className="form-group">
          <label>After login, go to</label>
          <select name="homeType" id="modal-homeType" defaultValue={home?.type ?? "none"}>
            <option value="none">Module list (or first module)</option>
            <option value="module">A specific module</option>
            <option value="view">A specific view</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="modal-homeModuleSlug">Module</label>
          <select id="modal-homeModuleSlug" name="homeModuleSlug" defaultValue={homeModuleSlug}>
            <option value="">—</option>
            {modules.map((m) => <option key={m.id} value={m.slug}>{m.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="modal-homeViewId">View (if “A specific view”)</label>
          <select id="modal-homeViewId" name="homeViewId" defaultValue={homeViewId}>
            <option value="">—</option>
            {modules.flatMap((m) =>
              (viewsByModule[m.slug] ?? []).map((v) => <option key={v.id} value={v.id}>{m.name} → {v.name}</option>)
            )}
          </select>
        </div>
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function BackendPaymentsForm({
  stripeConnectConfig = null,
  connectStripeAction,
}: {
  stripeConnectConfig?: { accountId: string; onboardingComplete: boolean } | null;
  connectStripeAction?: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [state, formAction] = useActionState(connectStripeAction ?? (async () => ({ error: "Not configured" })), null as { error?: string } | null);
  return (
    <div className="settings-form">
      <p className="settings-hint" style={{ marginBottom: "1rem" }}>
        Connect your Stripe account to accept payments from your customers (tickets, products, donations) on your public site.
      </p>
      {stripeConnectConfig ? (
        <p style={{ marginBottom: "1rem", color: "#059669" }}>
          {stripeConnectConfig.onboardingComplete
            ? "Stripe connected. You can accept payments on checkout."
            : "Stripe account created. Complete onboarding to accept payments."}
        </p>
      ) : null}
      <form action={formAction}>
        <button type="submit" className="btn btn-primary">
          {stripeConnectConfig ? "Complete onboarding" : "Connect Stripe"}
        </button>
      </form>
      {state?.error && <p className="view-error" style={{ marginTop: "0.5rem" }} role="alert">{state.error}</p>}
    </div>
  );
}

function BackendWebhooksForm({
  updateAction,
  extraFormFields,
  currentWebhookUrl = "",
  currentWebhookSecret = "",
  currentWebhookDeliveries = [],
  sendTestWebhookAction,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  currentWebhookUrl: string;
  currentWebhookSecret: string;
  currentWebhookDeliveries?: { id: string; event: string; url: string; success: boolean; statusCode: number | null; errorMessage: string | null; createdAt: Date }[];
  sendTestWebhookAction?: (prev: unknown, formData: FormData) => Promise<{ success: boolean; statusCode?: number; error?: string }>;
}) {
  const [state, formAction] = useActionState(updateAction, null);
  const [testState, testFormAction] = useActionState(sendTestWebhookAction ?? (async () => ({ success: false, error: "Not configured" })), null as { success: boolean; statusCode?: number; error?: string } | null);
  return (
    <div className="settings-form">
      <form action={formAction}>
        <FormExtraFields fields={extraFormFields} />
        <input type="hidden" name="settingsSection" value="backend-webhooks" />
        <p className="settings-hint" style={{ marginBottom: "1rem" }}>
          When entity create/update/delete events occur, a POST request is sent to your URL with a JSON payload. Include X-Webhook-Event and, if set, X-Webhook-Signature (HMAC-SHA256 of the body).
        </p>
        <div className="form-group">
          <label htmlFor="modal-webhookUrl">Webhook URL</label>
          <input
            id="modal-webhookUrl"
            name="webhookUrl"
            type="url"
            placeholder="https://your-server.com/webhooks/tasc360"
            defaultValue={currentWebhookUrl}
            className="form-control"
          />
        </div>
        <div className="form-group">
          <label htmlFor="modal-webhookSecret">Webhook secret (optional)</label>
          <input
            id="modal-webhookSecret"
            name="webhookSecret"
            type="password"
            placeholder="Leave blank to keep current"
            autoComplete="off"
            className="form-control"
          />
        </div>
        {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
        <button type="submit" className="btn btn-primary">Save</button>
      </form>

      {sendTestWebhookAction && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Send test event</h3>
          <form action={testFormAction}>
            <button type="submit" className="btn btn-secondary">Send test event</button>
          </form>
          {testState !== null && (
            <p style={{ marginTop: "0.5rem", color: testState.success ? "#059669" : "#dc2626" }} role="alert">
              {testState.success ? `Success (${testState.statusCode ?? 200})` : `Failed: ${testState.error ?? "Unknown"}`}
            </p>
          )}
        </div>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Recent deliveries</h3>
        {currentWebhookDeliveries.length === 0 ? (
          <p className="settings-hint">No deliveries yet. Save a URL and send a test event, or trigger entity changes.</p>
        ) : (
          <table className="subscription-team-table" style={{ fontSize: "0.875rem" }}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {currentWebhookDeliveries.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.createdAt).toLocaleString()}</td>
                  <td>{d.event}</td>
                  <td>{d.success ? "OK" : "Failed"}</td>
                  <td>{d.success ? (d.statusCode != null ? String(d.statusCode) : "—") : (d.errorMessage ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const LOCALE_OPTIONS = [
  { value: "", label: "Default (browser)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "fr-FR", label: "French (France)" },
  { value: "de-DE", label: "German" },
  { value: "es-ES", label: "Spanish" },
];

function BackendLocaleForm({
  updateAction,
  extraFormFields,
  currentLocale,
  currentTimeZone,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  currentLocale: string;
  currentTimeZone: string;
}) {
  const [state, formAction] = useActionState(updateAction, null);
  const presetValues = new Set(TENANT_TIME_ZONE_PRESETS.map((p) => p.value));
  const timeZoneOptions =
    currentTimeZone && !presetValues.has(currentTimeZone)
      ? [{ value: currentTimeZone, label: currentTimeZone }, ...TENANT_TIME_ZONE_PRESETS]
      : TENANT_TIME_ZONE_PRESETS;
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="backend-locale" />
      <p className="settings-hint" style={{ marginBottom: "1rem" }}>
        Locale controls how dates and numbers are written. Time zone controls which calendar day is &quot;today&quot; for
        deadline highlights and overdue sorting on lists and exports.
      </p>
      <div className="form-group">
        <label htmlFor="modal-locale">Locale</label>
        <select id="modal-locale" name="locale" className="form-control" defaultValue={currentLocale}>
          {LOCALE_OPTIONS.map((o) => (
            <option key={o.value || "default"} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="modal-timezone">Time zone</label>
        <select id="modal-timezone" name="timeZone" className="form-control" defaultValue={currentTimeZone}>
          {timeZoneOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="settings-hint" style={{ marginTop: "0.35rem", marginBottom: 0 }}>
          IANA name (e.g. America/Chicago). Used for everyone on this tenant.
        </p>
      </div>
      {state && typeof state === "object" && "error" in state ? (
        <p className="view-error" role="alert">{String((state as { error: string }).error)}</p>
      ) : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function BackendFeaturesForm({
  updateAction,
  extraFormFields,
  myOrders,
  refunds,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  myOrders: boolean;
  refunds: boolean;
}) {
  const [state, formAction] = useActionState(updateAction, null);
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="backend-features" />
      <p className="settings-hint" style={{ marginBottom: "1rem" }}>
        Turn customer-facing features on or off. Disabled features are hidden or blocked.
      </p>
      <div className="form-group">
        <label className="form-check">
          <input type="checkbox" name="featureMyOrders" defaultChecked={myOrders} />
          <span>My orders — show &quot;My orders&quot; link on the public site and allow customers to view orders by email.</span>
        </label>
      </div>
      <div className="form-group">
        <label className="form-check">
          <input type="checkbox" name="featureRefunds" defaultChecked={refunds} />
          <span>Refunds — allow refunding orders from the dashboard (Stripe Connect).</span>
        </label>
      </div>
      {state && typeof state === "object" && "error" in state ? (
        <p className="view-error" role="alert">{String((state as { error: string }).error)}</p>
      ) : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function EmailNotificationsForm({
  updateAction,
  extraFormFields,
  currentNotificationEmail,
  approvalRequested,
  paymentReceived,
  paymentFailed = false,
  webhookFailed,
  currentEmailFromAddress,
  currentEmailFromName,
  currentEmailReplyTo,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  currentNotificationEmail: string;
  approvalRequested: boolean;
  paymentReceived: boolean;
  paymentFailed: boolean;
  webhookFailed: boolean;
  currentEmailFromAddress?: string;
  currentEmailFromName?: string;
  currentEmailReplyTo?: string;
}) {
  const [state, formAction] = useActionState(updateAction, null);
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <input type="hidden" name="settingsSection" value="email-notifications" />
      <p className="settings-hint" style={{ marginBottom: "1rem" }}>
        Optional emails via Resend. Set notification email and check the events you want to be notified about.
      </p>
      <div className="form-group">
        <label htmlFor="modal-notificationEmail">Notification email (who receives)</label>
        <input
          id="modal-notificationEmail"
          name="notificationEmail"
          type="email"
          placeholder="admin@example.com"
          defaultValue={currentNotificationEmail}
          className="form-control"
        />
      </div>
      <p className="settings-hint" style={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
        Sender (emails appear from your tenant). Leave blank to use platform default with your tenant name; set a custom address only if that domain is verified in Resend.
      </p>
      <div className="form-group">
        <label htmlFor="modal-emailFromName">From name</label>
        <input
          id="modal-emailFromName"
          name="emailFromName"
          type="text"
          placeholder="Your company name"
          defaultValue={currentEmailFromName}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label htmlFor="modal-emailFromAddress">From address (optional)</label>
        <input
          id="modal-emailFromAddress"
          name="emailFromAddress"
          type="email"
          placeholder="notifications@yourdomain.com"
          defaultValue={currentEmailFromAddress}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label htmlFor="modal-emailReplyTo">Reply-To (optional)</label>
        <input
          id="modal-emailReplyTo"
          name="emailReplyTo"
          type="email"
          placeholder="support@yourdomain.com"
          defaultValue={currentEmailReplyTo}
          className="form-control"
        />
      </div>
      <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <label>Notify me when</label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" name="approvalRequested" defaultChecked={approvalRequested} />
          Approval requested
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" name="paymentReceived" defaultChecked={paymentReceived} />
          Payment received
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" name="paymentFailed" defaultChecked={paymentFailed} />
          Subscription payment failed (dunning)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" name="webhookFailed" defaultChecked={webhookFailed} />
          Webhook delivery failed
        </label>
      </div>
      {state && typeof state === "object" && "error" in state ? (
        <p className="view-error" role="alert">{String((state as { error: string }).error)}</p>
      ) : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function ConsentTypesForm({
  updateConsentTypesFormAction,
  extraFormFields,
  currentConsentTypes,
}: {
  updateConsentTypesFormAction: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  extraFormFields?: Record<string, string>;
  currentConsentTypes: string[];
}) {
  const [state, formAction] = useActionState(updateConsentTypesFormAction, null as { error?: string } | null);
  return (
    <form action={formAction} className="settings-form">
      <FormExtraFields fields={extraFormFields} />
      <div className="form-group">
        <label htmlFor="consent-types-input">Consent types (comma-separated)</label>
        <input
          id="consent-types-input"
          name="consentTypes"
          type="text"
          defaultValue={currentConsentTypes.join(", ")}
          placeholder="marketing, essential, analytics"
          className="form-control"
        />
        <span className="form-hint">Used when recording or revoking consent. Manage consent records on the Consent page.</span>
      </div>
      {state?.error && <p className="view-error" role="alert">{state.error}</p>}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function BackendApiForm({
  extraFormFields,
  apiKeys,
  createApiKeyAction,
  revokeApiKeyAction,
  tenantSlug,
  tenantId,
}: {
  extraFormFields?: Record<string, string>;
  apiKeys: { id: string; name: string; keyPrefix: string; lastUsedAt: Date | null; createdAt: Date }[];
  createApiKeyAction?: (prev: unknown, formData: FormData) => Promise<{ key?: string; error?: string }>;
  revokeApiKeyAction?: (formData: FormData) => Promise<void>;
  tenantSlug?: string | null;
  tenantId?: string;
}) {
  const [createState, createFormAction] = useActionState(createApiKeyAction ?? (async () => ({ error: "Not configured" })), null);
  return (
    <div className="settings-form">
      {createApiKeyAction && revokeApiKeyAction && (
        <div className="settings-single-section" style={{ marginBottom: "1.5rem" }}>
          <h3 className="settings-subheading">API keys</h3>
          <p className="settings-hint">Create multiple keys (e.g. per integration). Each key can be revoked. Use the X-API-Key header when calling the REST API.</p>
          {(tenantSlug || tenantId) && (
            <p className="settings-hint" style={{ marginTop: "0.5rem" }}>
              <strong>Tenant for API:</strong> Use slug <code>{tenantSlug ?? "—"}</code> or tenant ID <code>{tenantId ?? "—"}</code> in the request path. For the Tasc360 API tester, set <code>NEXT_PUBLIC_TENANT_ID</code> to the slug or ID above.
            </p>
          )}
          {apiKeys.length > 0 && (
            <table className="entity-table" style={{ marginBottom: "1rem", maxWidth: "100%" }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Last used</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.id}>
                    <td>{k.name}</td>
                    <td><code>{k.keyPrefix}…</code></td>
                    <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "—"}</td>
                    <td>
                      <form action={revokeApiKeyAction} style={{ display: "inline" }}>
                        <FormExtraFields fields={extraFormFields} />
                        <input type="hidden" name="apiKeyId" value={k.id} />
                        <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }} onClick={(e) => { if (!confirm("Revoke this key? It will stop working immediately.")) e.preventDefault(); }}>Revoke</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <form action={createFormAction} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <FormExtraFields fields={extraFormFields} />
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="apiKeyName">New key name</label>
              <input id="apiKeyName" name="apiKeyName" type="text" placeholder="e.g. Production" className="form-control" style={{ maxWidth: "200px" }} />
            </div>
            <button type="submit" className="btn btn-primary">Create key</button>
          </form>
          {createState?.key && (
            <p className="banner-success" role="alert" style={{ marginTop: "0.5rem" }}>
              Key created. Copy it now — we won&apos;t show it again: <code style={{ wordBreak: "break-all", fontSize: "0.875rem" }}>{createState.key}</code>
            </p>
          )}
          {createState?.error && <p className="view-error" role="alert">{createState.error}</p>}
        </div>
      )}
    </div>
  );
}

function BackendCustomerLoginsForm({
  updateAction,
  extraFormFields,
  customerLoginEnabled,
  customerLoginAllowSelfSignup,
  endUsers,
  inviteEndUserAction,
  deactivateEndUserFormAction,
  sendEndUserPasswordResetFormAction,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
  extraFormFields?: Record<string, string>;
  customerLoginEnabled: boolean;
  customerLoginAllowSelfSignup: boolean;
  endUsers: { id: string; email: string; name: string | null; isActive: boolean; lastLoginAt: Date | null; createdAt: Date; inviteToken: string | null }[];
  inviteEndUserAction?: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
  deactivateEndUserFormAction?: (formData: FormData) => Promise<void>;
  sendEndUserPasswordResetFormAction?: (formData: FormData) => Promise<void>;
}) {
  const [settingsState, settingsFormAction] = useActionState(updateAction, null);
  const [inviteState, inviteFormAction] = useActionState(inviteEndUserAction ?? (async () => ({ error: "Not configured" })), null);
  return (
    <div className="settings-form">
      <form action={settingsFormAction} className="settings-form">
        <FormExtraFields fields={extraFormFields} />
        <input type="hidden" name="settingsSection" value="backend-customer-logins" />
        <div className="settings-single-section" style={{ marginBottom: "1.5rem" }}>
          <h3 className="settings-subheading">Settings</h3>
          <p className="settings-hint">Allow your customers to log in to your custom frontend (or the template). When enabled, you can invite users and optionally allow self-signup.</p>
          <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" name="customerLoginEnabled" value="1" defaultChecked={customerLoginEnabled} />
              <span>Allow customer logins</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" name="customerLoginAllowSelfSignup" value="1" defaultChecked={customerLoginAllowSelfSignup} />
              <span>Allow self-signup (anyone can create an account)</span>
            </label>
          </div>
          {settingsState && typeof settingsState === "object" && "error" in settingsState ? (
            <p className="view-error" role="alert">{String((settingsState as { error: string }).error)}</p>
          ) : null}
          <button type="submit" className="btn btn-primary" style={{ marginTop: "0.75rem" }}>Save</button>
        </div>
      </form>

      <div className="settings-single-section" style={{ marginBottom: "1.5rem" }}>
        <h3 className="settings-subheading">Customer accounts</h3>
        <p className="settings-hint">Invite people by email; they receive a link to set their password. Then they can log in on your custom frontend.</p>
        {endUsers.length > 0 && (
          <table className="entity-table" style={{ marginBottom: "1rem", maxWidth: "100%" }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Last login</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {endUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.name ?? "—"}</td>
                  <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                  <td>
                    {!u.isActive ? "Inactive" : u.inviteToken ? "Pending invite" : "Active"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {u.isActive && !u.inviteToken && deactivateEndUserFormAction && (
                      <form action={deactivateEndUserFormAction} style={{ display: "inline", marginRight: "0.5rem" }}>
                        <FormExtraFields fields={extraFormFields} />
                        <input type="hidden" name="endUserId" value={u.id} />
                        <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }} onClick={(e) => { if (!confirm("Deactivate this account? They will not be able to log in.")) e.preventDefault(); }}>Deactivate</button>
                      </form>
                    )}
                    {u.isActive && sendEndUserPasswordResetFormAction && (
                      <form action={sendEndUserPasswordResetFormAction} style={{ display: "inline" }}>
                        <FormExtraFields fields={extraFormFields} />
                        <input type="hidden" name="endUserId" value={u.id} />
                        <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>Send reset email</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {inviteEndUserAction && (
          <form action={inviteFormAction} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "0.5rem" }}>
            <FormExtraFields fields={extraFormFields} />
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="endUserEmail">Email</label>
              <input id="endUserEmail" name="email" type="email" placeholder="customer@example.com" className="form-control" style={{ maxWidth: "240px" }} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="endUserName">Name (optional)</label>
              <input id="endUserName" name="name" type="text" placeholder="Jane" className="form-control" style={{ maxWidth: "160px" }} />
            </div>
            <button type="submit" className="btn btn-primary">Invite</button>
          </form>
        )}
        {inviteState?.error && <p className="view-error" role="alert" style={{ marginTop: "0.5rem" }}>{inviteState.error}</p>}
      </div>
    </div>
  );
}


