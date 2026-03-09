"use client";

import { useActionState } from "react";
import type { login, LoginState } from "./actions";

export function LoginForm({
  action,
  from,
}: {
  action: (prev: LoginState | null, formData: FormData) => Promise<LoginState>;
  from?: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="login-form">
      {from && <input type="hidden" name="from" value={from} />}
      <div className="form-group">
        <label htmlFor="workspace">Workspace</label>
        <input
          id="workspace"
          name="workspace"
          type="text"
          autoComplete="username"
          placeholder="e.g. acme"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state?.error && (
        <p className="login-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary login-submit">
        Sign in
      </button>
    </form>
  );
}
