"use client";

import { useActionState } from "react";
import { generateSiteFromAi } from "../actions";

export function GenerateSiteAiForm({ tenantId }: { tenantId: string }) {
  const [state, formAction] = useActionState(
    generateSiteFromAi.bind(null, tenantId),
    null
  );
  return (
    <form action={formAction} className="ai-generate-form">
      <div className="form-group">
        <label htmlFor="site-ai-prompt">Generate homepage with AI</label>
        <textarea
          id="site-ai-prompt"
          name="prompt"
          placeholder="e.g. We sell handmade furniture. Quality and sustainability matter to us."
          rows={2}
          className="ai-prompt-input"
        />
      </div>
      {state && typeof state === "object" && "error" in state && (
        <p className="view-error" role="alert">{(state as { error: string }).error}</p>
      )}
      <button type="submit" className="btn btn-primary">
        Generate site name, tagline &amp; homepage
      </button>
    </form>
  );
}
