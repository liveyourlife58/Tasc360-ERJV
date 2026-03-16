import Link from "next/link";
import { resetPassword } from "./actions";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token?.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
        <div className="w-full max-w-[400px] p-8 bg-white rounded-xl shadow-sm border border-slate-200/80">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Invalid link</h1>
          <p className="text-slate-600 text-sm mb-6">This reset link is missing or invalid.</p>
          <Link href="/forgot-password" className="inline-flex items-center justify-center py-2.5 px-4 rounded-lg font-medium text-white bg-teal-600 hover:bg-teal-700">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="w-full max-w-[400px] p-8 bg-white rounded-xl shadow-sm border border-slate-200/80">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Set new password</h1>
        <p className="text-slate-600 text-sm mb-6">Enter your new password below.</p>
        <ResetPasswordForm action={resetPassword} token={token} />
        <p className="mt-6 text-[13px] text-slate-500 text-center">
          <Link href="/login" className="hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
