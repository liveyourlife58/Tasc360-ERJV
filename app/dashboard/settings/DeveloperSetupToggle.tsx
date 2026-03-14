"use client";

import { useActionState } from "react";

type State = { error?: string } | null;

export function DeveloperSetupToggle({
  allowDeveloperSetup,
  formAction,
  extraFormFields,
}: {
  allowDeveloperSetup: boolean;
  formAction: (prev: State, formData: FormData) => Promise<State>;
  extraFormFields?: Record<string, string>;
}) {
  const [state, submitAction] = useActionState(formAction, null as State);
  const error = state?.error ?? null;

  return (
    <div className="settings-developer-access-card" style={{ marginBottom: "1rem" }}>
      <p className="settings-card-desc" style={{ marginBottom: "0.5rem" }}>
        Allow this workspace to manage API keys, webhooks and integrations. When off, those options are hidden from everyone.
      </p>
      <form action={submitAction} style={{ display: "inline-block" }}>
        {extraFormFields && Object.entries(extraFormFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="enabled" value={allowDeveloperSetup ? "false" : "true"} />
        <button type="submit" className="btn btn-secondary">
          {allowDeveloperSetup ? "Turn off developer setup" : "Turn on developer setup"}
        </button>
      </form>
      {error && (
        <p className="view-error" role="alert" style={{ marginTop: "0.5rem" }}>
          {error}
        </p>
      )}
    </div>
  );
}
