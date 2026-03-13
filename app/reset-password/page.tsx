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
      <div className="login-page">
        <div className="login-card">
          <h1 className="login-title">Invalid link</h1>
          <p className="login-subtitle">This reset link is missing or invalid.</p>
          <Link href="/forgot-password" className="btn btn-primary">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Set new password</h1>
        <p className="login-subtitle">Enter your new password below.</p>
        <ResetPasswordForm action={resetPassword} token={token} />
        <p className="login-footer">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
