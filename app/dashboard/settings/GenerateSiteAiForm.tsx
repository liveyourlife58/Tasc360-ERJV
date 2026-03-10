"use client";

import { useState } from "react";
import { useActionState } from "react";
import { generateSiteFromAi } from "../actions";

type HomepageFormProps = {
  tenantId: string;
  currentSiteName: string;
  currentTagline: string;
  currentHomeContent: string;
  updateAction?: (prev: unknown, formData: FormData) => Promise<unknown>;
  publicModules?: Record<string, { slug: string; showInNav?: boolean }>;
  modulePaymentTypes?: Record<string, "payment" | "donation" | null>;
  modules?: { id: string; name: string; slug: string }[];
  currentHeroImage?: string;
  homepageSidebarModule?: string;
  homepageSidebarFieldSlugs?: string[];
};

function HomepageHiddenInputs(props: {
  publicModules: Record<string, { slug: string; showInNav?: boolean }>;
  modulePaymentTypes: Record<string, "payment" | "donation" | null>;
  modules: { id: string; name: string; slug: string }[];
  siteHeroImage: string;
  homepageSidebarModule: string;
  homepageSidebarFieldSlugs: string[];
}) {
  const { publicModules, modulePaymentTypes, modules, siteHeroImage, homepageSidebarModule, homepageSidebarFieldSlugs } = props;
  return (
    <>
      <input type="hidden" name="siteHeroImage" value={siteHeroImage} />
      <input type="hidden" name="homepageSidebarModule" value={homepageSidebarModule} />
      {homepageSidebarFieldSlugs.map((s) => (
        <input key={s} type="hidden" name="homepageSidebarFieldSlugs" value={s} />
      ))}
      {modules.map((m) => {
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

export function GenerateSiteAiForm({
  tenantId,
  currentSiteName,
  currentTagline,
  currentHomeContent,
  updateAction,
  publicModules = {},
  modulePaymentTypes = {},
  modules = [],
  currentHeroImage = "",
  homepageSidebarModule = "",
  homepageSidebarFieldSlugs = [],
}: HomepageFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [aiState, aiFormAction] = useActionState(generateSiteFromAi.bind(null, tenantId), null);
  const [saveState, saveFormAction] = useActionState(updateAction ?? (async () => ({})), null);
  const hasCurrent = currentSiteName || currentTagline || currentHomeContent;
  const canEdit = typeof updateAction === "function";

  return (
    <div className="ai-homepage-two-col-wrap">
      <div className="ai-homepage-two-col">
        <form action={aiFormAction} className="ai-create-module-form ai-homepage-generate-form">
          <div className="ai-homepage-generate">
            <div className="ai-prompt-main">
              <label htmlFor="site-ai-prompt" className="ai-prompt-label">
                Generate homepage with AI
              </label>
              <textarea
                id="site-ai-prompt"
                name="prompt"
                placeholder="e.g. We sell handmade furniture. Quality and sustainability matter to us."
                rows={18}
                className="ai-prompt-input"
              />
            </div>
            <div className="ai-prompt-actions">
              <button type="submit" className="btn btn-primary ai-prompt-apply">
                Generate site name, tagline &amp; homepage
              </button>
            </div>
            {aiState && typeof aiState === "object" && "error" in aiState && (
              <p className="view-error" role="alert">{(aiState as { error: string }).error}</p>
            )}
          </div>
        </form>
        <div className="ai-generated-current-wrap">
          <div className="ai-generated-current-header">
            <label className="ai-prompt-label">Current homepage text</label>
            {canEdit && !isEditing && (
                <button
                  type="button"
                  className="ai-edit-icon-btn"
                  onClick={() => setIsEditing(true)}
                  title="Edit homepage text"
                  aria-label="Edit homepage text"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
              )}
          </div>
          {!isEditing ? (
            <div className="ai-generated-current">
              {hasCurrent ? (
                <>
                  {(currentSiteName || currentTagline) && (
                    <p className="ai-generated-current-meta">
                      {currentSiteName && <strong>{currentSiteName}</strong>}
                      {currentSiteName && currentTagline && " · "}
                      {currentTagline && <em>{currentTagline}</em>}
                    </p>
                  )}
                  {currentHomeContent ? (
                    <div
                      className="ai-generated-current-content site-prose"
                      dangerouslySetInnerHTML={{ __html: currentHomeContent }}
                    />
                  ) : null}
                </>
              ) : (
                <p className="ai-generated-current-empty">Generate to see preview here, or click Edit to write manually.</p>
              )}
            </div>
          ) : (
            <form action={saveFormAction} className="settings-form ai-manual-edit-form">
              <input type="hidden" name="settingsSection" value="customer" />
              <HomepageHiddenInputs
                publicModules={publicModules}
                modulePaymentTypes={modulePaymentTypes}
                modules={modules}
                siteHeroImage={currentHeroImage}
                homepageSidebarModule={homepageSidebarModule}
                homepageSidebarFieldSlugs={homepageSidebarFieldSlugs}
              />
              <div className="form-group">
                <label htmlFor="home-edit-siteName">Site name</label>
                <input id="home-edit-siteName" name="siteName" type="text" defaultValue={currentSiteName} placeholder="Your site name" className="form-control" />
              </div>
              <div className="form-group">
                <label htmlFor="home-edit-tagline">Tagline</label>
                <input id="home-edit-tagline" name="tagline" type="text" defaultValue={currentTagline} placeholder="Short tagline" className="form-control" />
              </div>
              <div className="form-group">
                <label htmlFor="home-edit-homeContent">Homepage content (HTML)</label>
                <textarea id="home-edit-homeContent" name="homeContent" rows={12} defaultValue={currentHomeContent} placeholder="<p>Welcome...</p>" className="form-control" />
              </div>
              {saveState && typeof saveState === "object" && "error" in saveState ? (
                <p className="view-error" role="alert">{String((saveState as { error: string }).error)}</p>
              ) : null}
              <div className="ai-edit-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
