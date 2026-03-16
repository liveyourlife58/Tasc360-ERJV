"use client";

import { useState } from "react";
import type { SignupState } from "./actions";

const inputClass =
  "w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";
const hintClass = "text-xs text-slate-500 mt-1";

export function SignupForm({
  action: _action,
}: {
  action: (prev: SignupState | null, formData: FormData) => Promise<SignupState>;
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        body: formData,
        redirect: "manual",
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setError(
          body?.error ?? "Too many signup attempts from this address. Try again in 15 minutes."
        );
        setPending(false);
        return;
      }
      const body = (await res.json().catch(() => null)) as SignupState | null;
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
      <div>
        <label htmlFor="workspaceName" className={labelClass}>Workspace name</label>
        <input
          id="workspaceName"
          name="workspaceName"
          type="text"
          autoComplete="organization"
          placeholder="e.g. Acme Corp"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="workspaceSlug" className={labelClass}>Workspace URL</label>
        <input
          id="workspaceSlug"
          name="workspaceSlug"
          type="text"
          autoComplete="username"
          placeholder="e.g. acme (you'll sign in with this)"
          pattern="[a-z0-9][a-z0-9-]*[a-z0-9]|[a-z0-9]"
          title="Letters, numbers, and hyphens only (2–100 characters)"
          className={inputClass}
        />
        <p className={hintClass}>Letters, numbers, and hyphens. Used to sign in (e.g. acme).</p>
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>Your email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="name" className={labelClass}>Your name</label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Optional"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClass}
        />
        <p className={hintClass}>At least 8 characters.</p>
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
        {pending ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
