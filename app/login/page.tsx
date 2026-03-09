import Link from "next/link";
import { login } from "./actions";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Sign in to Tasc360</h1>
        <p className="login-subtitle">
          Enter your workspace, email, and password.
        </p>
        <LoginForm action={login} from={from} />
        <p className="login-footer">
          Don&apos;t have access? Ask your workspace admin.
        </p>
      </div>
    </div>
  );
}
