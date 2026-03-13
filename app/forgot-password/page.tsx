import Link from "next/link";
import { requestPasswordReset } from "./actions";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Forgot password</h1>
        <p className="login-subtitle">
          Enter your workspace and email. We&apos;ll send you a link to reset your password.
        </p>
        <ForgotPasswordForm action={requestPasswordReset} />
        <p className="login-footer">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
