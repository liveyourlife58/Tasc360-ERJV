"use client";

import { useState } from "react";
import { useActionState } from "react";
import { GenerateSiteAiForm } from "./GenerateSiteAiForm";
import { BlobUploadInput } from "@/components/dashboard/BlobUploadInput";

type Branding = { name?: string; logo?: string; primaryColor?: string };
type Home =
  | { type: "module"; moduleSlug: string }
  | { type: "view"; moduleSlug: string; viewId: string }
  | undefined;

type SectionId =
  | "customer-ai"
  | "customer-contact"
  | "customer-hero"
  | "customer-sidebar"
  | "customer-modules"
  | "customer-seo"
  | "backend-branding"
  | "backend-home"
  | "backend-api";

const SECTION_TITLES: Record<SectionId, string> = {
  "customer-ai": "Homepage Text",
  "customer-contact": "Contact",
  "customer-hero": "Homepage hero image",
  "customer-sidebar": "Homepage right column",
  "customer-modules": "Public modules",
  "customer-seo": "SEO",
  "backend-branding": "Branding",
  "backend-home": "Default home",
  "backend-api": "API access",
};

type Props = {
  tenantId: string;
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
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
  } = props;

  const homeModuleSlug = home?.type ? home.moduleSlug : "";
  const homeViewId = home?.type === "view" ? home.viewId : "";

  const customerSections: { id: SectionId; title: string; desc: string }[] = [
    { id: "customer-ai", title: "Homepage Text", desc: "Site name, tagline & homepage copy" },
    { id: "customer-contact", title: "Contact", desc: "Contact page: email, phone, address for the public site" },
    { id: "customer-hero", title: "Homepage hero image", desc: "Optional banner image URL" },
    { id: "customer-sidebar", title: "Homepage right column", desc: "Entity list sidebar" },
    { id: "customer-modules", title: "Public modules", desc: "Which modules appear on the public site" },
    { id: "customer-seo", title: "SEO", desc: "Meta title, description, social image & canonical URL" },
  ];
  const backendSections: { id: SectionId; title: string; desc: string }[] = [
    { id: "backend-branding", title: "Branding", desc: "Dashboard name, logo, primary color" },
    { id: "backend-home", title: "Default home", desc: "Where to go after login" },
    { id: "backend-api", title: "API access", desc: "API key for REST API" },
  ];

  return (
    <>
      <div className="settings-cards-group">
        <h2 className="settings-cards-group-title">Customer site</h2>
        <div className="settings-cards settings-subcards">
          {customerSections.map(({ id, title, desc }) => (
            <button
              key={id}
              type="button"
              className="settings-card settings-subcard"
              onClick={() => setOpenSection(id)}
            >
              <h3 className="settings-card-title">{title}</h3>
              <p className="settings-card-desc">{desc}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="settings-cards-group">
        <h2 className="settings-cards-group-title">Dashboard & backend</h2>
        <div className="settings-cards settings-subcards">
          {backendSections.map(({ id, title, desc }) => (
            <button
              key={id}
              type="button"
              className="settings-card settings-subcard"
              onClick={() => setOpenSection(id)}
            >
              <h3 className="settings-card-title">{title}</h3>
              <p className="settings-card-desc">{desc}</p>
            </button>
          ))}
        </div>
      </div>

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
            updateAction={updateAction}
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
    updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
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
  }
) {
  const { sectionId } = props;
  if (sectionId === "customer-ai") {
    return (
      <div className="settings-modal-body">
        <GenerateSiteAiForm
          tenantId={props.tenantId}
          updateAction={props.updateAction}
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
  if (sectionId === "backend-branding") {
    return <BackendBrandingForm {...props} />;
  }
  if (sectionId === "backend-home") {
    return <BackendHomeForm {...props} />;
  }
  if (sectionId === "backend-api") {
    return <BackendApiForm {...props} />;
  }
  return null;
}

function CustomerContactForm({
  updateAction,
  publicModules,
  modulePaymentTypes,
  modules,
  currentHeroImage,
  homepageSidebarModule,
  homepageSidebarFieldSlugs,
  contactFields,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
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
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
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
        exclude="seo"
      />
      <div className="settings-single-section">
        <p className="settings-hint">Optional. Overrides used for search results and social sharing. Leave blank to use site name and tagline.</p>
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
  branding,
  home,
  homeModuleSlug,
  homeViewId,
  sidebarOrder,
  modules,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
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
          <input id="modal-brandingPrimaryColor" name="brandingPrimaryColor" type="text" defaultValue={branding?.primaryColor} placeholder="#4f46e5" />
        </div>
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}

function BackendHomeForm({
  updateAction,
  branding,
  home,
  homeModuleSlug,
  homeViewId,
  sidebarOrder,
  modules,
  viewsByModule,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
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

function BackendApiForm({
  updateAction,
  branding,
  home,
  homeModuleSlug,
  homeViewId,
  sidebarOrder,
  modules,
}: {
  updateAction: (prev: unknown, formData: FormData) => Promise<unknown>;
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
      <input type="hidden" name="settingsSection" value="backend" />
      <input type="hidden" name="sidebarOrder" value={JSON.stringify(sidebarOrder ?? modules.map((m) => m.slug))} />
      <input type="hidden" name="brandingName" value={branding?.name ?? ""} />
      <input type="hidden" name="brandingLogo" value={branding?.logo ?? ""} />
      <input type="hidden" name="brandingPrimaryColor" value={branding?.primaryColor ?? ""} />
      <input type="hidden" name="homeType" value={home?.type ?? "none"} />
      <input type="hidden" name="homeModuleSlug" value={homeModuleSlug} />
      <input type="hidden" name="homeViewId" value={homeViewId} />
      <div className="settings-single-section">
        <p className="settings-hint">Use X-API-Key header with the same value to call the REST API.</p>
        <div className="form-group">
          <label htmlFor="modal-apiKey">API key</label>
          <input id="modal-apiKey" name="apiKey" type="password" placeholder="Leave blank to keep current key" autoComplete="off" className="settings-api-key" />
        </div>
      </div>
      {state && typeof state === "object" && "error" in state ? <p className="view-error" role="alert">{String((state as { error: string }).error)}</p> : null}
      <button type="submit" className="btn btn-primary">Save</button>
    </form>
  );
}


