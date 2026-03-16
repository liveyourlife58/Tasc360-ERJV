"use client";

import { useState } from "react";
import type { ForgotPasswordState } from "./actions";

const inputClass =
  "w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="workspace" className={labelClass}>Workspace</label>
        <input
          id="workspace"
          name="workspace"
          type="text"
          autoComplete="username"
          placeholder="e.g. acme"
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>
      {state?.error && (
        <p className="p-2.5 px-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="p-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg" role="status">
          If an account exists for that workspace and email, we&apos;ve sent a reset link.
        </p>
      )}
      <button
        type="submit"
        className="w-full mt-2 py-2.5 px-4 rounded-lg font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none transition-colors"
        disabled={pending}
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
