"use client";

import { useActionState } from "react";

type Branding = { name?: string; logo?: string; primaryColor?: string };
type Home =
  | { type: "module"; moduleSlug: string }
  | { type: "view"; moduleSlug: string; viewId: string }
  | undefined;

export function DashboardSettingsForm({
  tenantId,
  action,
  branding,
  home,
  sidebarOrder,
  publicModules = {},
  modulePaymentTypes = {},
  modules,
  viewsByModule,
}: {
  tenantId: string;
  action: (prev: unknown, formData: FormData) => Promise<unknown>;
  branding?: Branding;
  home?: Home;
  sidebarOrder?: string[];
  publicModules?: Record<string, { slug: string; showInNav?: boolean }>;
  modulePaymentTypes?: Record<string, "payment" | "donation" | null>;
  modules: { id: string; name: string; slug: string }[];
  viewsByModule: Record<string, { id: string; name: string }[]>;
}) {
  const [state, formAction] = useActionState(action, null);

  const homeModuleSlug = home?.type ? home.moduleSlug : "";
  const homeViewId = home?.type === "view" ? home.viewId : "";

  return (
    <form action={formAction} className="settings-form">
      <input type="hidden" name="sidebarOrder" value={JSON.stringify(sidebarOrder ?? modules.map((m) => m.slug))} />

      <div className="settings-group settings-group-inline">
        <h3 className="settings-group-title">Public modules</h3>
        <p className="settings-group-desc">Show these modules on your public site at /s/your-slug/[url-slug]. Set payment type where submissions require payment or donation.</p>
        <section className="settings-section">
          {modules.map((m) => (
            <div key={m.id} className="settings-public-module">
              <label className="settings-check-label">
                <input type="checkbox" name={`publicModule_enabled_${m.slug}`} value="1" defaultChecked={!!publicModules[m.slug]} />
                <strong>{m.name}</strong>
              </label>
              <input id={`pub_slug_${m.slug}`} name={`publicModule_slug_${m.slug}`} type="text" defaultValue={publicModules[m.slug]?.slug ?? m.slug} placeholder="URL slug" className="settings-public-slug" />
              <label className="settings-check-label">
                <input type="checkbox" name={`publicModule_nav_${m.slug}`} value="1" defaultChecked={publicModules[m.slug]?.showInNav !== false} />
                Show in nav
              </label>
              <label htmlFor={`pub_payment_${m.slug}`} className="settings-check-label" style={{ marginLeft: "0.5rem" }}>Payment type:</label>
              <select id={`pub_payment_${m.slug}`} name={`publicModule_paymentType_${m.slug}`} defaultValue={modulePaymentTypes[m.slug] ?? ""} style={{ minWidth: "8rem" }}>
                <option value="">None</option>
                <option value="payment">Payment</option>
                <option value="donation">Donation</option>
              </select>
            </div>
          ))}
        </section>
      </div>

      <div className="settings-group settings-group-inline">
        <h3 className="settings-group-title">Dashboard & backend</h3>
        <p className="settings-group-desc">Dashboard branding, default home after login, and API access.</p>
        <section className="settings-section">
          <h4 className="settings-heading">Branding</h4>
        <div className="form-group">
          <label htmlFor="brandingName">Dashboard name</label>
          <input
            id="brandingName"
            name="brandingName"
            type="text"
            defaultValue={branding?.name}
            placeholder="Shown in sidebar"
          />
        </div>
        <div className="form-group">
          <label htmlFor="brandingLogo">Logo URL</label>
          <input
            id="brandingLogo"
            name="brandingLogo"
            type="url"
            defaultValue={branding?.logo}
            placeholder="https://..."
          />
        </div>
        <div className="form-group">
          <label htmlFor="brandingPrimaryColor">Primary color</label>
          <input
            id="brandingPrimaryColor"
            name="brandingPrimaryColor"
            type="text"
            defaultValue={branding?.primaryColor}
            placeholder="#4f46e5"
          />
        </div>
      </section>
        <section className="settings-section">
          <h4 className="settings-heading">Default home</h4>
        <div className="form-group">
          <label>After login, go to</label>
          <select name="homeType" id="homeType" defaultValue={home?.type ?? "none"}>
            <option value="none">Module list (or first module)</option>
            <option value="module">A specific module</option>
            <option value="view">A specific view</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="homeModuleSlug">Module</label>
          <select id="homeModuleSlug" name="homeModuleSlug" defaultValue={homeModuleSlug}>
            <option value="">—</option>
            {modules.map((m) => (
              <option key={m.id} value={m.slug}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="homeViewId">View (if “A specific view”)</label>
          <select id="homeViewId" name="homeViewId" defaultValue={homeViewId}>
            <option value="">—</option>
            {modules.flatMap((m) =>
              (viewsByModule[m.slug] ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {m.name} → {v.name}
                </option>
              ))
            )}
          </select>
        </div>
        </section>
        <section className="settings-section">
          <h4 className="settings-heading">API access</h4>
        <p className="settings-hint">Use X-API-Key header with the same value to call the REST API (e.g. GET/POST /api/v1/tenants/:tenantId/modules/...).</p>
        <div className="form-group">
          <label htmlFor="apiKey">API key</label>
          <input
            id="apiKey"
            name="apiKey"
            type="password"
            placeholder="Leave blank to keep current key"
            autoComplete="off"
            className="settings-api-key"
          />
        </div>
        </section>
      </div>

      {(() => {
        const err = state && typeof state === "object" && "error" in state ? (state as { error: string }).error : null;
        return err ? <p className="view-error" role="alert">{err}</p> : null;
      })()}
      <button type="submit" className="btn btn-primary">
        Save settings
      </button>
    </form>
  );
}
