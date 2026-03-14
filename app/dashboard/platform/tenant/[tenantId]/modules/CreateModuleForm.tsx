"use client";

import { useActionState } from "react";

export function CreateModuleForm({
  tenantId,
  action,
}: {
  tenantId: string;
  action: (prev: unknown, formData: FormData) => Promise<unknown>;
}) {
  const [state, formAction] = useActionState(action, null);
  const error = state && typeof state === "object" && "error" in state ? (state as { error: string }).error : null;

  return (
    <form action={formAction} className="settings-form" style={{ maxWidth: 420, marginBottom: "2rem" }}>
      <input type="hidden" name="targetTenantId" value={tenantId} />
      <h2 className="subscription-subheading">Create module</h2>
      <p className="settings-hint" style={{ marginBottom: "1rem" }}>
        Add a new module (table) for this tenant. You can add fields on the next screen.
      </p>
      <div className="form-group">
        <label htmlFor="platform-module-name">Name</label>
        <input id="platform-module-name" name="name" type="text" required placeholder="e.g. Events" className="form-control" />
      </div>
      <div className="form-group">
        <label htmlFor="platform-module-slug">Slug (optional, auto from name)</label>
        <input id="platform-module-slug" name="slug" type="text" placeholder="e.g. events" className="form-control" />
      </div>
      {error && <p className="view-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary">Create module</button>
    </form>
  );
}
