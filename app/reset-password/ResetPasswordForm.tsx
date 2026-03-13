"use client";

import { useActionState } from "react";
import type { resetPassword, ResetPasswordState } from "./actions";

export function ResetPasswordForm({
  action,
  token,
}: {
  action: (prev: ResetPasswordState | null, formData: FormData) => Promise<ResetPasswordState>;
  token: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="login-form">
      <input type="hidden" name="token" value={token} />
      <div className="form-group">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {state?.error && (
        <p className="login-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary login-submit">
        Set password
      </button>
    </form>
  );
}
