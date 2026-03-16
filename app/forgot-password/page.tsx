import Link from "next/link";
import { requestPasswordReset } from "./actions";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="w-full max-w-[400px] p-8 bg-white rounded-xl shadow-sm border border-slate-200/80">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Forgot password</h1>
        <p className="text-slate-600 text-sm mb-6">
          Enter your workspace and email. We&apos;ll send you a link to reset your password.
        </p>
        <ForgotPasswordForm action={requestPasswordReset} />
        <p className="mt-6 text-[13px] text-slate-500 text-center">
          <Link href="/login" className="hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
