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
      const body = (await res.json().catch(() => null)) as LoginState | null;
      if (body?.error) setError(body.error);
      else if (res.ok && (body?.redirect ?? res.headers.get("Location"))) {
        window.location.href = body?.redirect ?? res.headers.get("Location") ?? "/dashboard";
        return;
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {from && <input type="hidden" name="from" value={from} />}
      <div>
        <label htmlFor="workspace" className="block text-sm font-medium text-slate-700 mb-1">Workspace</label>
        <input
          id="workspace"
          name="workspace"
          type="text"
          autoComplete="username"
          placeholder="e.g. acme"
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>
      {error && (
        <p className="p-2.5 px-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="w-full mt-2 py-2.5 px-4 rounded-lg font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none transition-colors"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
