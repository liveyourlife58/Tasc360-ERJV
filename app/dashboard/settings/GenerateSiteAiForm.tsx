"use client";

import { useActionState } from "react";
import { generateSiteFromAi } from "../actions";

export function GenerateSiteAiForm({
  tenantId,
  currentSiteName,
  currentTagline,
  currentHomeContent,
}: {
  tenantId: string;
  currentSiteName: string;
  currentTagline: string;
  currentHomeContent: string;
}) {
  const [state, formAction] = useActionState(
    generateSiteFromAi.bind(null, tenantId),
    null
  );
  const hasCurrent = currentSiteName || currentTagline || currentHomeContent;

  return (
    <form action={formAction} className="ai-create-module-form">
      <div className="ai-homepage-two-col">
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
          {state && typeof state === "object" && "error" in state && (
            <p className="view-error" role="alert">{(state as { error: string }).error}</p>
          )}
        </div>
        <div className="ai-generated-current-wrap">
          <label className="ai-prompt-label">Current generated text</label>
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
              <p className="ai-generated-current-empty">Generate to see preview here.</p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
