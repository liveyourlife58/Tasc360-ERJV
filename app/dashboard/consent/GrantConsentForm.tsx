"use client";

import { useActionState } from "react";

type User = { id: string; email: string | null; name: string | null };

export function GrantConsentForm({
  users,
  consentTypes,
  grantAction,
}: {
  users: User[];
  consentTypes: string[];
  grantAction: (prev: unknown, formData: FormData) => Promise<{ error?: string }>;
}) {
  const [state, formAction] = useActionState(grantAction, null as { error?: string } | null);

  return (
    <details className="consent-grant-details" style={{ marginBottom: "1.5rem" }}>
      <summary style={{ cursor: "pointer", fontWeight: 500 }}>Record consent (grant)</summary>
      <form action={formAction} className="settings-form" style={{ marginTop: "0.75rem", maxWidth: 400 }}>
        <div className="form-group">
          <label htmlFor="consent-user">User</label>
          <select id="consent-user" name="userId" required>
            <option value="">— Select —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email || u.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="consent-type">Consent type</label>
          <select id="consent-type" name="consentType" required>
            <option value="">— Select —</option>
            {consentTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="consent-source">Source (optional)</label>
          <input
            id="consent-source"
            name="source"
            type="text"
            placeholder="e.g. signup_form, preferences_page"
          />
        </div>
        {state?.error && (
          <p className="view-error" role="alert">{state.error}</p>
        )}
        <button type="submit" className="btn btn-primary">
          Grant consent
        </button>
      </form>
    </details>
  );
}
