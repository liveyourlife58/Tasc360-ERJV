import Link from "next/link";
import { login } from "./actions";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; reset?: string }>;
}) {
  const { from, reset } = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-200">
      <div className="w-full max-w-[400px] p-8 bg-white rounded-xl shadow-sm border border-slate-200/80">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Sign in to Tasc360</h1>
        <p className="text-slate-600 text-sm mb-6">
          Enter your workspace, email, and password.
        </p>
        {reset === "1" && (
          <p className="mb-4 p-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg" role="status">
            Your password has been reset. You can sign in now.
          </p>
        )}
        <LoginForm action={login} from={from} />
        <p className="mt-6 text-[13px] text-slate-500 text-center">
          <Link href="/forgot-password" className="hover:underline">Forgot password?</Link>
          {" · "}
          <Link href="/signup" className="hover:underline">Create your workspace</Link>
        </p>
      </div>
    </div>
  );
}
