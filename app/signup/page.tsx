import Link from "next/link";
import { signup } from "./actions";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="w-full max-w-[400px] p-8 bg-white rounded-xl shadow-sm border border-slate-200/80">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your workspace</h1>
        <p className="text-slate-600 text-sm mb-6">
          Set up a new workspace and become the admin. You can invite your team later.
        </p>
        <SignupForm action={signup} />
        <p className="mt-6 text-[13px] text-slate-500 text-center">
          Already have a workspace? <Link href="/login" className="hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
