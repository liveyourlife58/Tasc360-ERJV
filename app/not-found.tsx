import Link from "next/link";

export default function NotFound() {
  return (
    <div className="not-found-page">
      <h1>404</h1>
      <p>This page could not be found.</p>
      <Link href="/" className="btn btn-primary">
        Go home
      </Link>
    </div>
  );
}
