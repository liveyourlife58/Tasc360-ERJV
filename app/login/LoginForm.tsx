"use client";

import { useState } from "react";
import type { LoginState } from "./actions";

export function LoginForm({
  action: _action,
  from,
}: {
  action: (prev: LoginState | null, formData: FormData) => Promise<LoginState>;
  from?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
        redirect: "manual",
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Too many login attempts from this address. Try again in 15 minutes.");
        setPending(false);
        return;
      }
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("Location");
        if (location) {
          window.location.href = location;
          return;
        }
      }
      const body = (await res.json().catch(() => null)) as LoginState | null;
      if (body?.error) setError(body.error);
      else if (res.ok) {
        const location = res.headers.get("Location");
        if (location) window.location.href = location;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
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
      {error && (
        <p className="login-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn btn-primary login-submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
