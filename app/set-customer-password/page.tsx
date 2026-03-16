import Link from "next/link";
import { setCustomerPassword } from "./actions";
import { SetCustomerPasswordForm } from "./SetCustomerPasswordForm";

export default async function SetCustomerPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; success?: string }>;
}) {
  const { token, success } = await searchParams;

  if (success === "1") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
        <div className="w-full max-w-[400px] p-8 bg-white rounded-xl shadow-sm border border-slate-200/80">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Password set</h1>
          <p className="text-slate-600 text-sm">You can now log in to the site using your email and this password.</p>
        </div>
      </div>
    );
  }

  if (!token?.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
        <div className="w-full max-w-[400px] p-8 bg-white rounded-xl shadow-sm border border-slate-200/80">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Invalid link</h1>
          <p className="text-slate-600 text-sm mb-6">This link is missing or has expired.</p>
          <p className="text-slate-600 text-sm">Ask the site owner to send you a new invite or password reset email.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="w-full max-w-[400px] p-8 bg-white rounded-xl shadow-sm border border-slate-200/80">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Set your password</h1>
        <p className="text-slate-600 text-sm mb-6">Enter your new password below.</p>
        <SetCustomerPasswordForm action={setCustomerPassword} token={token} />
      </div>
    </div>
  );
}
