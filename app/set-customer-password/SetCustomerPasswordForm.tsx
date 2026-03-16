"use client";

import { useActionState } from "react";
import type { setCustomerPassword, SetCustomerPasswordState } from "./actions";

const inputClass =
  "w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";
const labelClass = "block text-sm font-medium text-slate-700 mb-1";

export function SetCustomerPasswordForm({
  action,
  token,
}: {
  action: (prev: SetCustomerPasswordState | null, formData: FormData) => Promise<SetCustomerPasswordState>;
  token: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className={labelClass}>New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={inputClass}
        />
      </div>
      {state?.error && (
        <p className="p-2.5 px-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-100" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        className="w-full mt-2 py-2.5 px-4 rounded-lg font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
      >
        Set password
      </button>
    </form>
  );
}
