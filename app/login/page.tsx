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
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Sign in to Tasc360</h1>
        <p className="login-subtitle">
          Enter your workspace, email, and password.
        </p>
        {reset === "1" && (
          <p className="banner-success" role="status" style={{ marginBottom: "1rem" }}>
            Your password has been reset. You can sign in now.
          </p>
        )}
        <LoginForm action={login} from={from} />
        <p className="login-footer">
          <Link href="/forgot-password">Forgot password?</Link>
          {" · "}
          Don&apos;t have access? Ask your workspace admin.
        </p>
      </div>
    </div>
  );
}
