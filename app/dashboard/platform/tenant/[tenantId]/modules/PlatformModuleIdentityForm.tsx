"use client";

import { useActionState } from "react";
import { updateModuleIdentityAsPlatformAdminFormAction } from "@/app/dashboard/actions";

export function PlatformModuleIdentityForm({
  tenantId,
  moduleSlug,
  initialName,
  initialSlug,
}: {
  tenantId: string;
  moduleSlug: string;
  initialName: string;
  initialSlug: string;
}) {
  const [state, formAction] = useActionState(updateModuleIdentityAsPlatformAdminFormAction, null);
  const error = state && typeof state === "object" && "error" in state ? (state as { error: string }).error : null;

  return (
    <form action={formAction} className="settings-form" style={{ maxWidth: 520 }}>
      <input type="hidden" name="targetTenantId" value={tenantId} />
      <input type="hidden" name="moduleSlug" value={moduleSlug} />
      <div className="form-group">
        <label htmlFor="platform-module-name">Module name</label>
        <input
          id="platform-module-name"
          name="name"
          type="text"
          required
          defaultValue={initialName}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label htmlFor="platform-module-slug">Module slug (URL segment)</label>
        <input
          id="platform-module-slug"
          name="slug"
          type="text"
          required
          defaultValue={initialSlug}
          className="form-control"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="form-hint">
          Tenant URLs look like <code>/dashboard/m/your-slug</code>. Changing the slug does not update relation field
          settings elsewhere—those still point at the old slug until you edit each relation field.
        </span>
      </div>
      {error && (
        <p className="view-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        Save name &amp; slug
      </button>
    </form>
  );
}
