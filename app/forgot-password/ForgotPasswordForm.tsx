"use client";

import { useState } from "react";
import type { ForgotPasswordState } from "./actions";

export function ForgotPasswordForm({
  action: _action,
}: {
  action: (prev: ForgotPasswordState | null, formData: FormData) => Promise<ForgotPasswordState>;
}) {
  const [state, setState] = useState<ForgotPasswordState | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        body: formData,
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setState({ error: body?.error ?? "Too many reset requests from this address. Try again in 15 minutes." });
        setPending(false);
        return;
      }
      const body = (await res.json().catch(() => null)) as ForgotPasswordState | null;
      setState(body ?? {});
    } catch {
      setState({ error: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
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
      {state?.error && (
        <p className="login-error" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="banner-success" role="status">
          If an account exists for that workspace and email, we&apos;ve sent a reset link.
        </p>
      )}
      <button type="submit" className="btn btn-primary login-submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
